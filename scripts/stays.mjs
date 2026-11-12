#!/usr/bin/env node
// The holiday letting desk. Every slash command in .claude/commands runs one of these.
//   npm run stays -- <report> [--flags]           attention, turnovers, arrivals, night-caps, statement, ... (see help)
//   npm run stays -- <action> <args> [--flags]    book, check-in, check-out, assign-clean, clean-done, block, ...
// Human tables by default, --json for machines. Names match exactly, then by fragment; ambiguous lists candidates and exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table, heading, money } from './lib/format.mjs';
import { importGuesty, toDate, cents } from './lib/import.mjs';

const BOOLEAN_FLAGS = ['json', 'apply', 'help', 'force', 'save', 'issue', 'paid', 'all', 'hosted'];

export function parseArgs(args) {
  const flags = {}, pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq >= 0) flags[a.slice(2, eq).replaceAll('-', '_')] = a.slice(eq + 1);
    else if (BOOLEAN_FLAGS.includes(a.slice(2))) flags[a.slice(2).replaceAll('-', '_')] = true;
    else if (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) flags[a.slice(2).replaceAll('-', '_')] = args[++i];
    else throw Error(`Flag ${a} needs a value`);
  }
  return { flags, pos };
}

class Ambiguous extends Error {}
const required = (v, what) => { if (v === undefined || v === null || String(v).trim() === '') throw Error(`Required: ${what}`); return String(v).trim(); };
const today = async (db) => (await db.query('select stay_today()::text d'))[0].d;
const settingsOf = async (db) => (await db.query('select * from settings'))[0];
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const day = (v, what) => toDate(v, 'dmy', what);
const amount = (v, what) => { const c = cents(required(v, what)); if (c < 0) throw Error(`${what} cannot be negative`); return c; };
const $ = (c) => (c === null || c === undefined ? '' : (Number(c) / 100).toFixed(2));
const pct = (v) => (v === null || v === undefined ? '' : `${Number(v).toFixed(1)}%`);

// Resolve a record by exact name (or code), then by fragment. Ambiguous: list and exit 1.
async function resolve(db, kind, term) {
  const spec = {
    home: ['homes', 'name'], owner: ['owners', 'name'], cleaner: ['cleaners', 'name'], guest: ['guests', 'name'],
    channel: ['channels', 'name'], reservation: ['reservations', 'code'],
  }[kind];
  const [t, col] = spec;
  const q = required(term, kind);
  let rows = await db.query(`select * from ${t} where lower(${col}) = lower($1)`, [q]);
  if (!rows.length && /^[0-9a-f]{6,}$/i.test(q)) rows = await db.query(`select * from ${t} where id::text like $1`, [`${q.toLowerCase()}%`]);
  if (!rows.length) rows = await db.query(`select * from ${t} where ${col} ilike $1 order by ${col}`, [`%${q}%`]);
  if (kind === 'reservation' && !rows.length) {
    rows = await db.query(`select r.* from reservations r join guests g on g.id = r.guest_id where g.name ilike $1 and r.status <> 'cancelled' order by abs(r.arrive_on - stay_today())`, [`%${q}%`]);
  }
  if (!rows.length) throw Error(`No ${kind} matches "${q}"`);
  if (rows.length > 1) throw new Ambiguous(`"${q}" matches ${rows.length} ${kind} records: ${rows.slice(0, 12).map((r) => r[col]).join(', ')}. Say which one.`);
  return rows[0];
}

async function audit(db, action, id, detail) {
  await db.query('insert into audit (action, record_id, detail) values ($1, $2, $3)', [action, id || null, JSON.stringify(detail)]);
}

// --------------------------------------------------------------- reports
// Each returns { title, rows, columns } or a list of them. --json prints the rows.

const reports = {
  async attention(db) {
    const rows = await db.query('select reason, home, ref, detail from v_attention order by severity, reason, home');
    return { title: `Needs attention (${rows.length})`, rows, columns: ['reason', 'home', 'ref', 'detail'] };
  },

  async arrivals(db, f) {
    const days = Number(f.days ?? 2);
    const rows = await db.query(`select arrive_on, home, code, guest, guests_count as guests, nights, channel, eta, case when channel_kind = 'direct' then round(balance_cents / 100.0, 2) end as to_collect
      from v_stays where status = 'confirmed' and arrive_on between stay_today() and stay_today() + $1::int order by arrive_on, home`, [days]);
    return { title: `Arrivals, next ${days} days`, rows, columns: ['arrive_on', 'home', 'code', 'guest', 'guests', 'nights', 'channel', 'eta', 'to_collect'] };
  },

  async departures(db, f) {
    const days = Number(f.days ?? 2);
    const rows = await db.query(`select depart_on, home, code, guest, status from v_stays where status in ('confirmed', 'checked_in') and depart_on between stay_today() - 1 and stay_today() + $1::int order by depart_on, home`, [days]);
    return { title: `Departures, next ${days} days`, rows, columns: ['depart_on', 'home', 'code', 'guest', 'status'] };
  },

  async turnovers(db, f) {
    const days = Number(f.days ?? 3);
    const rows = await db.query(`select depart_on, home, code as departing, turnaround, next_arrive_on as next_arrival, coalesce(cleaner, case when clean_id is null then 'NOT BOOKED' else 'no cleaner' end) as cleaner, coalesce(clean_status, '') as clean
      from v_turnovers where depart_on between stay_today() - 1 and stay_today() + $1::int order by depart_on, case when turnaround = 'same day' then 0 else 1 end, home`, [days]);
    return { title: `Turnovers, next ${days} days`, rows, columns: ['depart_on', 'home', 'departing', 'turnaround', 'next_arrival', 'cleaner', 'clean'] };
  },

  async cleans(db, f) {
    const days = Number(f.days ?? 3);
    const params = [days];
    let where = '';
    if (f.cleaner) { params.push((await resolve(db, 'cleaner', f.cleaner)).id); where = ' and c.cleaner_id = $2'; }
    const rows = await db.query(`select c.due_on, h.name as home, coalesce(cr.name, 'unassigned') as cleaner, c.status, r.code as after,
        (select n.arrive_on from reservations n where n.home_id = c.home_id and n.arrive_on >= c.due_on and n.status in ('confirmed', 'checked_in') order by n.arrive_on limit 1) as next_arrival,
        h.check_in_time as ready_by, h.clean_minutes as minutes, coalesce(c.notes, '') as notes
      from cleans c join homes h on h.id = c.home_id left join cleaners cr on cr.id = c.cleaner_id left join reservations r on r.id = c.reservation_id
      where c.status in ('scheduled', 'issue') and c.due_on <= stay_today() + $1::int${where} order by c.due_on, cr.name nulls first, h.name`, params);
    return { title: 'Clean run sheet', rows, columns: ['due_on', 'home', 'cleaner', 'status', 'after', 'next_arrival', 'ready_by', 'minutes', 'notes'] };
  },

  async calendar(db, f, pos) {
    const home = await resolve(db, 'home', pos[0]);
    const weeks = Number(f.weeks ?? 6);
    const rows = await db.query(`select d::date as night, to_char(d, 'Dy') as dow,
        coalesce((select l.code || ' ' || l.guest || ' (' || l.channel || ')' from v_live l where l.home_id = $1 and d::date >= l.arrive_on and d::date < l.depart_on and l.status <> 'checked_out' limit 1),
                 (select 'BLOCK ' || k.kind || coalesce(': ' || k.note, '') from blocks k where k.home_id = $1 and d::date >= k.starts_on and d::date < k.ends_on limit 1), 'free') as booked
      from generate_series(stay_today(), stay_today() + ($2 * 7 - 1), interval '1 day') d order by 1`, [home.id, weeks]);
    return { title: `${home.name}: the next ${weeks} weeks`, rows, columns: ['night', 'dow', 'booked'] };
  },

  async reservations(db, f) {
    const params = [];
    const where = ["status <> 'cancelled'"];
    if (f.home) { params.push((await resolve(db, 'home', f.home)).id); where.push(`home_id = $${params.length}`); }
    if (f.owner) { params.push((await resolve(db, 'owner', f.owner)).id); where.push(`owner_id = $${params.length}`); }
    if (f.status) { params.push(f.status); where.push(`status = $${params.length}`); }
    params.push(f.from ? day(f.from, '--from') : await today(db)); where.push(`depart_on >= $${params.length}`);
    if (f.to) { params.push(day(f.to, '--to')); where.push(`arrive_on <= $${params.length}`); }
    const rows = await db.query(`select code, home, guest, arrive_on, depart_on, nights, channel, status, round(total_cents / 100.0, 2) as total, round(balance_cents / 100.0, 2) as balance
      from v_stays where ${where.join(' and ')} order by arrive_on limit 200`, params);
    return { title: `Reservations (${rows.length})`, rows, columns: ['code', 'home', 'guest', 'arrive_on', 'depart_on', 'nights', 'channel', 'status', 'total', 'balance'] };
  },

  async 'night-caps'(db) {
    const rows = await db.query(`select home, rules, night_cap as cap, year_start, nights_used as used, nights_booked_ahead as booked_ahead, nights_total as total, night_cap - nights_total as left, coalesce(approval_ref, '') as approval
      from v_night_cap order by (nights_total::numeric / night_cap) desc`);
    return { title: 'Night caps this counting year (bookings of 21+ nights and owner blocks not counted)', rows, columns: ['home', 'rules', 'cap', 'year_start', 'used', 'booked_ahead', 'total', 'left', 'approval'] };
  },

  async compliance(db) {
    const rows = await db.query(`select rule, state, home, detail from v_compliance where state <> 'clean' or $1 order by case state when 'breached' then 0 when 'due' then 1 else 2 end, rule, home`, [false]);
    const clean = await db.query(`select rule, count(*) as checked from v_compliance where state = 'clean' group by rule order by rule`);
    return [
      { title: `Compliance: ${rows.length} to act on (sources in docs/compliance.md)`, rows, columns: ['rule', 'state', 'home', 'detail'] },
      { title: 'Clean', rows: clean, columns: ['rule', 'checked'] },
    ];
  },

  async levy(db, f) {
    const s = await settingsOf(db);
    const from = f.from ? day(f.from, '--from') : (await db.query(`select date_trunc('quarter', stay_today())::date::text d`))[0].d;
    const to = f.to ? day(f.to, '--to') : (await db.query(`select (date_trunc('quarter', stay_today()) + interval '3 months')::date::text d`))[0].d;
    const rows = await db.query(`select depart_on as completed, home, code, channel, nights, round(total_cents / 100.0, 2) as booking_fee,
        round(total_cents * $3::numeric / 10000.0, 2) as levy_due, coalesce(round(levy_cents / 100.0, 2)::text, 'NOT RECORDED') as levy_recorded
      from v_live where rules = 'vic' and not collects_levy and nights < 28 and depart_on >= $1 and depart_on < $2 order by depart_on`, [from, to, Number(s.levy_rate_pct)]);
    return { title: `Victorian short stay levy on bookings you took directly, stays completed ${from} to ${to}`, rows, columns: ['completed', 'home', 'code', 'channel', 'nights', 'booking_fee', 'levy_due', 'levy_recorded'] };
  },

  async owners(db) {
    const rows = await db.query(`select o.name as owner, count(h.id) as homes, string_agg(h.name, ', ' order by h.name) as home_names,
        (select max(period_start) from statements s where s.owner_id = o.id and s.status in ('issued', 'paid')) as last_statement,
        coalesce((select round(sum(payout_cents) / 100.0, 2) from statements s where s.owner_id = o.id and s.status = 'issued'), 0) as unpaid
      from owners o left join homes h on h.owner_id = o.id and h.active where o.active group by o.id, o.name order by o.name`);
    return { title: 'Owners', rows, columns: ['owner', 'homes', 'home_names', 'last_statement', 'unpaid'] };
  },

  async homes(db) {
    const rows = await db.query(`select h.name as home, o.name as owner, h.area, h.rules, h.bedrooms, h.max_guests as sleeps, coalesce(h.registration_no, '') as registration,
        coalesce(h.fee_pct, s.default_fee_pct) as fee_pct, round(h.guest_cleaning_fee_cents / 100.0, 2) as cleaning_fee
      from homes h join owners o on o.id = h.owner_id cross join settings s where h.active order by h.name`);
    return { title: 'Homes', rows, columns: ['home', 'owner', 'area', 'rules', 'bedrooms', 'sleeps', 'registration', 'fee_pct', 'cleaning_fee'] };
  },

  async owner(db, f, pos) {
    const o = await resolve(db, 'owner', pos[0]);
    const homes = await db.query(`select p.home, p.nights_let, p.occupancy_pct, round(p.rent_cents / 100.0, 2) as rent_12m, round(p.owner_cents / 100.0, 2) as owner_share_12m, p.avg_rating
      from v_home_performance p join homes h on h.id = p.home_id where h.owner_id = $1 order by p.home`, [o.id]);
    const st = await db.query(`select to_char(period_start, 'YYYY-MM') as month, status, stays, round(payout_cents / 100.0, 2) as payout, issued_on, paid_on from statements where owner_id = $1 order by period_start desc limit 6`, [o.id]);
    const issues = await db.query(`select h.name as home, i.title, i.priority, i.status, round(i.quote_cents / 100.0, 2) as quote, i.reported_on from issues i join homes h on h.id = i.home_id where h.owner_id = $1 and i.status <> 'done' order by i.reported_on`, [o.id]);
    const notes = await db.query(`select logged_on, kind, body from activity where subject_type = 'owner' and subject_id = $1 order by logged_on desc limit 5`, [o.id]);
    return [
      { title: `${o.name}${o.notes ? ` (${o.notes})` : ''}`, rows: homes, columns: ['home', 'nights_let', 'occupancy_pct', 'rent_12m', 'owner_share_12m', 'avg_rating'] },
      { title: 'Statements', rows: st, columns: ['month', 'status', 'stays', 'payout', 'issued_on', 'paid_on'] },
      { title: 'Open repairs', rows: issues, columns: ['home', 'title', 'priority', 'status', 'quote', 'reported_on'] },
      { title: 'Recent notes', rows: notes, columns: ['logged_on', 'kind', 'body'] },
    ];
  },

  async statements(db, f) {
    const rows = await db.query(`select o.name as owner, to_char(s.period_start, 'YYYY-MM') as month, s.status, s.stays, round(s.rent_cents / 100.0, 2) as rent,
        round((s.fee_cents + s.fee_gst_cents) / 100.0, 2) as fees, round(s.expenses_cents / 100.0, 2) as expenses, round(s.payout_cents / 100.0, 2) as payout, s.issued_on, s.paid_on
      from statements s join owners o on o.id = s.owner_id where s.period_start >= (date_trunc('month', stay_today()) - ($1 || ' months')::interval)::date order by s.period_start desc, o.name`, [String(f.months ?? 3)]);
    const missing = await db.query(`select reason, home as owner, ref as month, detail from v_attention where reason in ('owner statement not issued', 'owner not paid') order by 2`);
    return [
      { title: 'Owner statements', rows, columns: ['owner', 'month', 'status', 'stays', 'rent', 'fees', 'expenses', 'payout', 'issued_on', 'paid_on'] },
      { title: 'Late', rows: missing, columns: ['reason', 'owner', 'month', 'detail'] },
    ];
  },

  async performance(db) {
    const rows = await db.query(`select home, owner, nights_let, occupancy_pct, round(rent_cents / 100.0, 2) as rent, round(owner_cents / 100.0, 2) as owner_share,
        round(margin_cents / 100.0, 2) as our_margin, round(expenses_cents / 100.0, 2) as expenses, avg_rating
      from v_home_performance order by margin_cents desc`);
    return { title: 'Homes, last twelve months (our margin = management fee + cleaning fees - cleaner pay)', rows, columns: ['home', 'owner', 'nights_let', 'occupancy_pct', 'rent', 'owner_share', 'our_margin', 'expenses', 'avg_rating'] };
  },

  async channels(db) {
    const rows = await db.query(`select channel, channel_kind as kind, count(*) as stays, sum(nights) as nights, round(sum(rent_cents) / 100.0, 2) as rent,
        round(sum(commission_cents) / 100.0, 2) as commission, round(100.0 * sum(commission_cents) / nullif(sum(rent_cents), 0), 1) as commission_pct,
        round(sum(owner_cents) / 100.0 / nullif(sum(nights), 0), 2) as owner_per_night, round(avg(arrive_on - booked_on)) as lead_days
      from v_live where arrive_on > stay_today() - 365 and arrive_on <= stay_today() group by channel, channel_kind order by sum(owner_cents) desc`);
    return { title: 'Channels, last twelve months of arrivals, after commission', rows, columns: ['channel', 'kind', 'stays', 'nights', 'rent', 'commission', 'commission_pct', 'owner_per_night', 'lead_days'] };
  },

  async cleaners(db) {
    const rows = await db.query(`select cr.name as cleaner, count(*) as cleans, count(rv.id) as next_guest_reviewed, round(avg(rv.cleanliness), 2) as next_guest_cleanliness,
        count(rv.id) filter (where rv.cleanliness < 4.5) as low_scores, round(sum(c.cost_cents) / 100.0, 2) as paid
      from cleans c join cleaners cr on cr.id = c.cleaner_id
      left join lateral (select r.id from reservations r where r.home_id = c.home_id and r.arrive_on >= c.due_on and r.status <> 'cancelled' order by r.arrive_on limit 1) nx on true
      left join reviews rv on rv.reservation_id = nx.id
      where c.status = 'done' and c.done_on > stay_today() - 365 group by cr.name order by next_guest_cleanliness nulls last`);
    return { title: 'Cleaners: what the next guest said about cleanliness, last twelve months', rows, columns: ['cleaner', 'cleans', 'next_guest_reviewed', 'next_guest_cleanliness', 'low_scores', 'paid'] };
  },

  async pace(db) {
    const rows = await db.query(`select w::date as week_of, count(n.night_on) as nights_on_books,
        round(100.0 * count(n.night_on) / nullif((select count(*) from homes where active) * 7, 0), 1) as occupancy_pct,
        round(coalesce(sum(n.nightly_cents), 0) / 100.0, 2) as rent_on_books
      from generate_series(date_trunc('week', stay_today()), date_trunc('week', stay_today()) + interval '11 weeks', interval '1 week') w
      left join v_nights n on n.night_on >= w::date and n.night_on < w::date + 7 group by w order by w`);
    return { title: 'The next twelve weeks on the books', rows, columns: ['week_of', 'nights_on_books', 'occupancy_pct', 'rent_on_books'] };
  },

  async issues(db, f) {
    const rows = await db.query(`select h.name as home, o.name as owner, i.title, i.priority, i.status, round(i.quote_cents / 100.0, 2) as quote, i.reported_on, stay_today() - i.reported_on as days_open
      from issues i join homes h on h.id = i.home_id join owners o on o.id = h.owner_id where i.status <> 'done' or $1 order by case i.priority when 'urgent' then 0 when 'normal' then 1 else 2 end, i.reported_on`, [Boolean(f.all)]);
    return { title: 'Repairs and issues', rows, columns: ['home', 'owner', 'title', 'priority', 'status', 'quote', 'reported_on', 'days_open'] };
  },

  async 'repeat-guests'(db) {
    const rows = await db.query(`select g.name as guest, g.email, count(*) as stays, string_agg(distinct l.home, ', ') as homes, max(l.depart_on) as last_stay,
        round(sum(l.commission_cents) / 100.0, 2) as commission_paid
      from v_live l join guests g on g.id = l.guest_id where l.depart_on <= stay_today() group by g.id, g.name, g.email having count(*) > 1 order by sum(l.commission_cents) desc limit 25`);
    return { title: 'Repeat guests (commission paid to channels on their stays)', rows, columns: ['guest', 'email', 'stays', 'homes', 'last_stay', 'commission_paid'] };
  },

  async reservation(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    const v = (await db.query('select * from v_stays where id = $1', [r.id]))[0];
    const pay = await db.query('select received_on, method, reference, round(amount_cents / 100.0, 2) as amount from payments where reservation_id = $1 order by received_on', [r.id]);
    const cl = await db.query('select c.due_on, c.status, coalesce(cr.name, \'unassigned\') as cleaner, c.notes from cleans c left join cleaners cr on cr.id = c.cleaner_id where c.reservation_id = $1', [r.id]);
    const facts = [
      ['home', v.home], ['guest', v.guest], ['dates', `${v.arrive_on} to ${v.depart_on} (${v.nights} nights)`], ['status', v.status], ['channel', v.channel],
      ['rent', $(v.rent_cents)], ['cleaning fee', $(v.cleaning_fee_cents)], ['commission', $(v.commission_cents)], ['management fee + GST', $(Number(v.fee_cents) + Number(v.fee_gst_cents))],
      ['owner share', $(v.owner_cents)], ['paid', $(v.paid_cents)], ['balance', $(v.balance_cents)], ['notes', r.notes || ''],
    ].map(([k, val]) => ({ field: k, value: val }));
    return [
      { title: `${v.code}`, rows: facts, columns: ['field', 'value'] },
      { title: 'Payments', rows: pay, columns: ['received_on', 'method', 'reference', 'amount'] },
      { title: 'Clean', rows: cl, columns: ['due_on', 'status', 'cleaner', 'notes'] },
    ];
  },

  async 'weekly-review'(db) {
    const out = [];
    for (const name of ['attention', 'turnovers', 'night-caps', 'pace', 'statements']) {
      const r = await reports[name](db, { days: 7 }, []);
      out.push(...(Array.isArray(r) ? r : [r]));
    }
    return out;
  },
};

// --------------------------------------------------------------- statements

async function statementFor(db, ownerTerm, month) {
  const o = await resolve(db, 'owner', ownerTerm);
  const start = `${required(month, '--month=YYYY-MM').slice(0, 7)}-01`;
  if (!/^\d{4}-\d{2}-01$/.test(start)) throw Error('--month must look like 2026-10');
  const end = (await db.query(`select (($1::date + interval '1 month')::date - 1)::text d`, [start]))[0].d;
  const stays = await db.query(`select home, code, guest, arrive_on, depart_on, nights, channel, rent_cents, commission_cents, fee_cents, fee_gst_cents, owner_cents
    from v_live where owner_id = $1 and depart_on between $2 and $3 and (status = 'checked_out' or depart_on <= stay_today()) order by home, depart_on`, [o.id, start, end]);
  const existing = (await db.query('select * from statements where owner_id = $1 and period_start = $2', [o.id, start]))[0];
  const expenses = await db.query(`select e.id, h.name as home, e.incurred_on, e.description, e.category, e.amount_cents from expenses e join homes h on h.id = e.home_id
    where h.owner_id = $1 and e.incurred_on between $2 and $3 and (e.statement_id is null or e.statement_id = $4) order by e.incurred_on`, [o.id, start, end, existing?.id ?? null]);
  const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k]), 0);
  const totals = {
    stays: stays.length, rent_cents: sum(stays, 'rent_cents'), commission_cents: sum(stays, 'commission_cents'), fee_cents: sum(stays, 'fee_cents'),
    fee_gst_cents: sum(stays, 'fee_gst_cents'), expenses_cents: sum(expenses, 'amount_cents'),
  };
  totals.payout_cents = sum(stays, 'owner_cents') - totals.expenses_cents;
  return { owner: o, start, end, stays, expenses, totals, existing };
}

async function statementAction(db, f, pos) {
  const s = await statementFor(db, pos[0], f.month);
  if (s.existing && s.existing.status !== 'draft' && (f.save || f.issue)) {
    if (!f.paid) throw Error(`${s.owner.name} ${s.start.slice(0, 7)} is already ${s.existing.status}. Use --paid to record the payout.`);
  }
  let saved = s.existing;
  if ((f.save || f.issue) && (!s.existing || s.existing.status === 'draft')) {
    const t = s.totals;
    saved = (await db.query(`insert into statements (owner_id, period_start, period_end, status, stays, rent_cents, commission_cents, fee_cents, fee_gst_cents, expenses_cents, payout_cents, issued_on)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, case when $4 = 'issued' then stay_today() end)
      on conflict (owner_id, period_start) do update set status = excluded.status, stays = excluded.stays, rent_cents = excluded.rent_cents, commission_cents = excluded.commission_cents,
        fee_cents = excluded.fee_cents, fee_gst_cents = excluded.fee_gst_cents, expenses_cents = excluded.expenses_cents, payout_cents = excluded.payout_cents, issued_on = excluded.issued_on
      returning *`, [s.owner.id, s.start, s.end, f.issue ? 'issued' : 'draft', t.stays, t.rent_cents, t.commission_cents, t.fee_cents, t.fee_gst_cents, t.expenses_cents, t.payout_cents]))[0];
    for (const e of s.expenses) await db.query('update expenses set statement_id = $1 where id = $2', [saved.id, e.id]);
    await audit(db, f.issue ? 'statement.issue' : 'statement.save', saved.id, { owner: s.owner.name, month: s.start, payout_cents: t.payout_cents });
  }
  if (f.paid) {
    if (!saved || saved.status === 'draft') throw Error('Issue the statement before recording the payout (--issue).');
    saved = (await db.query(`update statements set status = 'paid', paid_on = stay_today() where id = $1 returning *`, [saved.id]))[0];
    await audit(db, 'statement.paid', saved.id, { owner: s.owner.name, month: s.start });
  }
  const t = s.totals;
  return [
    { title: `Owner statement: ${s.owner.name}, ${s.start} to ${s.end}${saved ? ` (${saved.status})` : ' (not saved: --save or --issue)'}`,
      rows: s.stays.map((r) => ({ home: r.home, code: r.code, guest: r.guest, dates: `${r.arrive_on} to ${r.depart_on}`, nights: r.nights, channel: r.channel,
        rent: $(r.rent_cents), commission: $(r.commission_cents), fee: $(Number(r.fee_cents) + Number(r.fee_gst_cents)), owner: $(r.owner_cents) })),
      columns: ['home', 'code', 'guest', 'dates', 'nights', 'channel', 'rent', 'commission', 'fee', 'owner'] },
    { title: 'Expenses charged to the owner', rows: s.expenses.map((e) => ({ home: e.home, date: e.incurred_on, description: e.description, amount: $(e.amount_cents) })), columns: ['home', 'date', 'description', 'amount'] },
    { title: 'Totals', rows: [{ stays: t.stays, rent: $(t.rent_cents), commission: $(t.commission_cents), management_fee: $(t.fee_cents), fee_gst: $(t.fee_gst_cents), expenses: $(t.expenses_cents), payout: $(t.payout_cents) }],
      columns: ['stays', 'rent', 'commission', 'management_fee', 'fee_gst', 'expenses', 'payout'] },
  ];
}

// --------------------------------------------------------------- actions

async function freeCheck(db, homeId, arrive, depart, except = null) {
  const clash = await db.query(`select code as what from v_live where home_id = $1 and status <> 'checked_out' and arrive_on < $3 and $2 < depart_on and id is distinct from $4::uuid
    union all select 'owner block ' || starts_on || ' to ' || ends_on from blocks where home_id = $1 and starts_on < $3 and $2 < ends_on`, [homeId, arrive, depart, except]);
  return clash.map((c) => c.what);
}

const actions = {
  async book(db, f, pos) {
    const home = await resolve(db, 'home', pos[0]);
    const arrive = day(f.arrive, '--arrive');
    const depart = f.nights ? addDays(arrive, Number(f.nights)) : day(f.depart, '--depart or --nights');
    if (depart <= arrive) throw Error('Departure must be after arrival');
    const clash = await freeCheck(db, home.id, arrive, depart);
    if (clash.length && !f.force) throw Error(`${home.name} is taken on those nights: ${clash.join(', ')}. Use --force to book anyway.`);
    const guestName = required(f.guest, '--guest');
    let guest = (await db.query('select * from guests where lower(name) = lower($1) or (email is not null and lower(email) = lower($2)) limit 1', [guestName, f.email ?? '']))[0];
    if (!guest) guest = (await db.query('insert into guests (name, email, phone) values ($1, $2, $3) returning *', [guestName, f.email ?? null, f.phone ?? null]))[0];
    const channel = await resolve(db, 'channel', f.channel ?? 'Direct');
    const s = await settingsOf(db);
    const rent = amount(f.rent, '--rent (the accommodation total)');
    const cleaning = f.cleaning_fee !== undefined ? amount(f.cleaning_fee, '--cleaning-fee') : Number(home.guest_cleaning_fee_cents);
    const nights = (Date.parse(depart) - Date.parse(arrive)) / 86400000;
    const levy = home.rules === 'vic' && !channel.collects_levy && nights < 28 ? Math.round((rent + cleaning) * Number(s.levy_rate_pct) / 100) : null;
    const seq = (await db.query(`select coalesce(max(substring(code from 4)::int), 0) + 1 as n from reservations where code ~ '^CR-[0-9]+$'`))[0].n;
    const code = f.code ?? `CR-${String(seq).padStart(5, '0')}`;
    const r = (await db.query(`insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, levy_cents, booked_on, eta, notes)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, stay_today(), $12, $13) returning *`,
      [code, home.id, guest.id, channel.id, f.enquiry ? 'enquiry' : 'confirmed', arrive, depart, Number(f.guests ?? 2), rent, cleaning, levy, f.eta ?? null, f.notes ?? null]))[0];
    if (!f.enquiry) await db.query('insert into cleans (home_id, reservation_id, due_on, cost_cents) values ($1, $2, $3, $4)', [home.id, r.id, depart, home.clean_cost_cents]);
    await audit(db, 'book', r.id, { code, home: home.name, arrive, depart });
    return `Booked ${code}: ${guest.name} at ${home.name}, ${arrive} to ${depart} (${nights} nights), ${channel.name}.${levy !== null ? ` Victorian levy ${$(levy)} recorded.` : ''} Departure clean added, no cleaner yet.`;
  },

  async cancel(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    await db.query(`update reservations set status = 'cancelled', notes = concat_ws(' | ', notes, $2::text) where id = $1`, [r.id, f.reason ? `Cancelled: ${f.reason}` : null]);
    await db.query(`update cleans set status = 'cancelled' where reservation_id = $1 and status = 'scheduled'`, [r.id]);
    await audit(db, 'cancel', r.id, { reason: f.reason ?? null });
    return `Cancelled ${r.code}. Its departure clean is cancelled too. Refunds happen in the channel or your bank, not here.`;
  },

  async 'check-in'(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    if (r.status !== 'confirmed') throw Error(`${r.code} is ${r.status}`);
    await db.query(`update reservations set status = 'checked_in' where id = $1`, [r.id]);
    await audit(db, 'check-in', r.id, {});
    return `${r.code} checked in.`;
  },

  async 'check-out'(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    if (!['confirmed', 'checked_in'].includes(r.status)) throw Error(`${r.code} is ${r.status}`);
    await db.query(`update reservations set status = 'checked_out' where id = $1`, [r.id]);
    const cl = await db.query(`select id from cleans where reservation_id = $1 and status <> 'cancelled'`, [r.id]);
    if (!cl.length) {
      const h = (await db.query('select * from homes where id = $1', [r.home_id]))[0];
      await db.query('insert into cleans (home_id, reservation_id, due_on, cost_cents) values ($1, $2, $3, $4)', [h.id, r.id, r.depart_on, h.clean_cost_cents]);
    }
    await audit(db, 'check-out', r.id, {});
    return `${r.code} checked out.${cl.length ? '' : ' A departure clean was added with no cleaner yet.'}`;
  },

  async pay(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    const amt = amount(f.amount, '--amount');
    await db.query('insert into payments (reservation_id, amount_cents, received_on, method, reference) values ($1, $2, $3, $4, $5)',
      [r.id, amt, f.on ? day(f.on, '--on') : await today(db), f.method ?? 'bank transfer', f.reference ?? null]);
    const v = (await db.query('select balance_cents from v_stays where id = $1', [r.id]))[0];
    await audit(db, 'pay', r.id, { amount_cents: amt });
    return `Recorded ${$(amt)} on ${r.code}. Balance now ${$(v.balance_cents)}.`;
  },

  async 'record-levy'(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    const amt = amount(f.amount, '--amount');
    await db.query('update reservations set levy_cents = $2 where id = $1', [r.id, amt]);
    await audit(db, 'levy', r.id, { levy_cents: amt });
    return `Levy of ${$(amt)} recorded on ${r.code}.`;
  },

  async block(db, f, pos) {
    const home = await resolve(db, 'home', pos[0]);
    const from = day(f.from, '--from');
    const to = f.nights ? addDays(from, Number(f.nights)) : day(f.to, '--to (the day the home is free again)');
    const clash = (await freeCheck(db, home.id, from, to)).filter((c) => !c.startsWith('owner block'));
    if (clash.length && !f.force) throw Error(`That block would sit over ${clash.join(', ')}. Move the guest or use --force.`);
    const kind = f.kind ?? 'owner_stay';
    const b = (await db.query('insert into blocks (home_id, starts_on, ends_on, kind, note) values ($1, $2, $3, $4, $5) returning id', [home.id, from, to, kind, f.note ?? null]))[0];
    await audit(db, 'block', b.id, { home: home.name, from, to, kind });
    return `Blocked ${home.name} ${from} to ${to} (${kind}). Close the same dates in your channel manager.`;
  },

  async 'assign-clean'(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    const cleaner = await resolve(db, 'cleaner', pos[1] ?? f.cleaner);
    let cl = (await db.query(`select * from cleans where reservation_id = $1 and status <> 'cancelled'`, [r.id]))[0];
    if (!cl) {
      const h = (await db.query('select * from homes where id = $1', [r.home_id]))[0];
      cl = (await db.query('insert into cleans (home_id, reservation_id, due_on, cost_cents) values ($1, $2, $3, $4) returning *', [h.id, r.id, r.depart_on, h.clean_cost_cents]))[0];
    }
    await db.query('update cleans set cleaner_id = $2 where id = $1', [cl.id, cleaner.id]);
    await audit(db, 'assign-clean', cl.id, { reservation: r.code, cleaner: cleaner.name });
    return `${cleaner.name} is on the clean after ${r.code} (${cl.due_on}).`;
  },

  async 'clean-done'(db, f, pos) {
    const r = await resolve(db, 'reservation', pos[0]);
    const cl = (await db.query(`select * from cleans where reservation_id = $1 and status in ('scheduled', 'issue')`, [r.id]))[0];
    if (!cl) throw Error(`No open clean after ${r.code}`);
    const status = f.issue_note ? 'issue' : 'done';
    await db.query(`update cleans set status = $2, done_on = stay_today(), notes = coalesce($3, notes) where id = $1`, [cl.id, status, f.issue_note ?? f.note ?? null]);
    await audit(db, 'clean-done', cl.id, { status });
    return status === 'issue' ? `Clean after ${r.code} done with an issue noted. It shows on attention until someone deals with it.` : `Clean after ${r.code} marked done.`;
  },

  async issue(db, f, pos) {
    const home = await resolve(db, 'home', pos[0]);
    const i = (await db.query('insert into issues (home_id, title, priority, status, quote_cents, notes) values ($1, $2, $3, $4, $5, $6) returning *',
      [home.id, required(f.title, '--title'), f.priority ?? 'normal', f.status ?? 'open', f.quote ? amount(f.quote, '--quote') : null, f.notes ?? null]))[0];
    await audit(db, 'issue', i.id, { home: home.name, title: i.title });
    return `Logged "${i.title}" at ${home.name} (${i.priority}).`;
  },

  async resolve(db, f, pos) {
    const home = await resolve(db, 'home', pos[0]);
    const rows = await db.query(`select * from issues where home_id = $1 and status <> 'done' and title ilike $2`, [home.id, `%${required(f.title, '--title (a few words of it)')}%`]);
    if (rows.length !== 1) throw new Ambiguous(rows.length ? `Matches ${rows.map((r) => r.title).join(', ')}. Say which one.` : 'No open issue matches');
    await db.query(`update issues set status = 'done', resolved_on = stay_today() where id = $1`, [rows[0].id]);
    let extra = '';
    if (f.cost) {
      await db.query(`insert into expenses (home_id, description, category, amount_cents, issue_id) values ($1, $2, 'repairs', $3, $4)`, [home.id, rows[0].title, amount(f.cost, '--cost'), rows[0].id]);
      extra = ` ${$(cents(f.cost))} goes on the owner's next statement.`;
    }
    await audit(db, 'resolve', rows[0].id, {});
    return `Closed "${rows[0].title}".${extra}`;
  },

  async expense(db, f, pos) {
    const home = await resolve(db, 'home', pos[0]);
    const amt = amount(f.amount, '--amount');
    await db.query('insert into expenses (home_id, incurred_on, description, category, amount_cents) values ($1, $2, $3, $4, $5)',
      [home.id, f.on ? day(f.on, '--on') : await today(db), required(f.description, '--description'), f.category ?? 'other', amt]);
    return `${$(amt)} for "${f.description}" at ${home.name} goes on the owner's next statement.`;
  },

  async log(db, f, pos) {
    const kind = required(pos[0], 'home | owner | reservation | guest | cleaner');
    const rec = await resolve(db, kind, pos[1]);
    await db.query('insert into activity (subject_type, subject_id, kind, body) values ($1, $2, $3, $4)', [kind, rec.id, f.kind ?? 'note', required(f.note, '--note')]);
    return `Noted against ${rec.name ?? rec.code}.`;
  },

  async add(db, f, pos) {
    const kind = required(pos[0], 'home | owner | cleaner | channel');
    if (kind === 'home') {
      const owner = await resolve(db, 'owner', f.owner);
      const h = (await db.query(`insert into homes (name, owner_id, address, area, rules, hosted, night_cap, cap_year_starts_on, registration_no, registration_expires_on, bedrooms, max_guests, fee_pct, guest_cleaning_fee_cents, clean_cost_cents)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning *`,
        [required(f.name, '--name'), owner.id, f.address ?? null, f.area ?? null, f.rules ?? 'none', Boolean(f.hosted), f.night_cap ? Number(f.night_cap) : null,
          f.cap_year_starts ? day(f.cap_year_starts, '--cap-year-starts') : null, f.registration ?? null, f.registration_expires ? day(f.registration_expires, '--registration-expires') : null,
          Number(f.bedrooms ?? 1), Number(f.sleeps ?? 2), f.fee_pct ? Number(f.fee_pct) : null, f.cleaning_fee ? amount(f.cleaning_fee, '--cleaning-fee') : 0, f.clean_cost ? amount(f.clean_cost, '--clean-cost') : 0]))[0];
      await audit(db, 'add.home', h.id, { name: h.name });
      return `Added ${h.name} for ${owner.name} (rules: ${h.rules}).`;
    }
    const cols = { owner: ['owners', ['name', 'email', 'phone', 'address', 'notes']], cleaner: ['cleaners', ['name', 'phone', 'email', 'areas']], channel: ['channels', ['name', 'kind']] }[kind];
    if (!cols) throw Error('add what: home, owner, cleaner or channel');
    const [t, allowed] = cols;
    const keys = allowed.filter((k) => f[k] !== undefined);
    const row = (await db.query(`insert into ${t} (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, keys.map((k) => f[k])))[0];
    if (kind === 'channel' && f.commission_pct) await db.query('update channels set commission_pct = $2 where id = $1', [row.id, Number(f.commission_pct)]);
    await audit(db, `add.${kind}`, row.id, { name: row.name });
    return `Added ${kind} ${row.name}.`;
  },

  async set(db, f, pos) {
    const kind = required(pos[0], 'home | owner | cleaner | channel | settings');
    const allowed = {
      home: { area: 'area', rules: 'rules', night_cap: 'night_cap', cap_year_starts: 'cap_year_starts_on', registration: 'registration_no', registration_expires: 'registration_expires_on',
        approval: 'approval_ref', fee_pct: 'fee_pct', cleaning_fee: 'guest_cleaning_fee_cents', clean_cost: 'clean_cost_cents', check_in_time: 'check_in_time', check_out_time: 'check_out_time', access_notes: 'access_notes', active: 'active', hosted: 'hosted' },
      owner: { email: 'email', phone: 'phone', address: 'address', notes: 'notes', gst_registered: 'gst_registered', active: 'active' },
      cleaner: { phone: 'phone', email: 'email', areas: 'areas', active: 'active' },
      channel: { commission_pct: 'commission_pct', collects_levy: 'collects_levy', kind: 'kind' },
      settings: { business_name: 'business_name', currency: 'currency', country: 'country', default_fee_pct: 'default_fee_pct', fee_gst_pct: 'fee_gst_pct', statement_due_days: 'statement_due_days', levy_rate_pct: 'levy_rate_pct', as_of: 'as_of' },
    }[kind];
    if (!allowed) throw Error('set what: home, owner, cleaner, channel or settings');
    const rec = kind === 'settings' ? { id: 1 } : await resolve(db, kind, pos[1]);
    const t = { home: 'homes', owner: 'owners', cleaner: 'cleaners', channel: 'channels', settings: 'settings' }[kind];
    const sets = [], vals = [];
    for (const [k, raw] of Object.entries(f)) {
      if (k === 'json') continue;
      if (!allowed[k]) throw Error(`Unknown ${kind} field --${k.replaceAll('_', '-')}. Allowed: ${Object.keys(allowed).map((a) => a.replaceAll('_', '-')).join(', ')}`);
      let v = raw === 'null' ? null : raw;
      if (v !== null && /_cents$/.test(allowed[k])) v = amount(v, k);
      else if (v !== null && /_on$|^as_of$/.test(allowed[k])) v = day(v, k);
      sets.push(`${allowed[k]} = $${sets.length + 1}`); vals.push(v === true ? 'true' : v);
    }
    if (!sets.length) throw Error('Give at least one --field=value');
    vals.push(rec.id);
    await db.query(`update ${t} set ${sets.join(', ')} where id = $${vals.length}`, vals);
    await audit(db, `set.${kind}`, kind === 'settings' ? null : rec.id, f);
    return `Updated ${kind}${rec.name ? ` ${rec.name}` : ''}.`;
  },

  async import(db, f, pos) {
    const source = required(pos[0], 'guesty');
    if (source.toLowerCase() !== 'guesty') throw Error('Only a Guesty report is read as is. For another system, ask your agent to map its columns.');
    const file = path.resolve(required(pos[1], 'the reservations CSV file'));
    const s = await importGuesty(db, file, { apply: Boolean(f.apply), order: f.date_order ?? 'dmy', listings: f.listings ? path.resolve(f.listings) : null, owner: f.owner ?? 'Owner to confirm' });
    const lines = Object.entries(s).filter(([k]) => k !== 'skipped').map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v}`);
    const skipped = s.skipped.length ? `\nSkipped ${s.skipped.length}:\n  ${s.skipped.join('\n  ')}` : '';
    if (f.apply) await audit(db, 'import.guesty', null, { file: path.basename(file), ...s });
    return `${f.apply ? 'Imported' : 'Test run, nothing written (add --apply to write)'}:\n  ${lines.join('\n  ')}${skipped}`;
  },

  async export(db, f) {
    const dir = path.resolve(REPO_ROOT, f.dir ?? 'exports');
    fs.mkdirSync(dir, { recursive: true });
    const tables = ['owners', 'homes', 'channels', 'guests', 'reservations', 'payments', 'blocks', 'cleaners', 'cleans', 'issues', 'expenses', 'statements', 'reviews', 'activity'];
    for (const t of tables) {
      const rows = await db.query(`select * from ${t} order by created_at`);
      const cols = rows.length ? Object.keys(rows[0]) : [];
      const esc = (v) => { if (v === null || v === undefined) return ''; const s = typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : String(v instanceof Date ? v.toISOString() : v); return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
      fs.writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
    }
    return `Wrote ${tables.length} CSV files to ${path.relative(REPO_ROOT, dir) || dir}/`;
  },

  async 'draft-owner-update'(db, f, pos) {
    const month = f.month ?? (await db.query(`select to_char(date_trunc('month', stay_today()) - interval '1 month', 'YYYY-MM') m`))[0].m;
    const s = await statementFor(db, pos[0], month);
    const set = await settingsOf(db);
    const issues = await db.query(`select h.name as home, i.title, i.status, i.quote_cents from issues i join homes h on h.id = i.home_id where h.owner_id = $1 and i.status <> 'done' order by i.reported_on`, [s.owner.id]);
    const ahead = await db.query(`select home, count(*) as stays, sum(nights) as nights, sum(owner_cents) as owner_cents from v_live where owner_id = $1 and arrive_on >= stay_today() and arrive_on < stay_today() + 60 and status = 'confirmed' group by home order by home`, [s.owner.id]);
    const first = s.owner.name.split(/\s+/)[0];
    const lines = [
      `To: ${s.owner.email ?? s.owner.name}`,
      `Subject: Your ${month} statement from ${set.business_name}`,
      '',
      `Hi ${first},`,
      '',
      `Your statement for ${month} is attached. ${s.totals.stays} stays finished in the month. Rent came to ${money(s.totals.rent_cents, set.currency)}, and after channel commission, our management fee and ${money(s.totals.expenses_cents, set.currency)} of expenses your payout is ${money(s.totals.payout_cents, set.currency)}.`,
      '',
    ];
    if (ahead.length) {
      lines.push('Booked for the next 60 days:');
      for (const a of ahead) lines.push(`- ${a.home}: ${a.stays} stays, ${a.nights} nights, about ${money(a.owner_cents, set.currency)} to you`);
      lines.push('');
    }
    if (issues.length) {
      lines.push('Open repairs:');
      for (const i of issues) lines.push(`- ${i.home}: ${i.title}${i.quote_cents ? `, quoted ${money(i.quote_cents, set.currency)}` : ''}${i.status === 'waiting_owner' ? ' (waiting on your yes)' : ''}`);
      lines.push('');
    }
    lines.push('Thanks,', set.business_name);
    return writeDraft(`owner-update-${slug(s.owner.name)}-${month}.md`, lines.join('\n'));
  },

  async 'draft-prearrival'(db, f, pos) {
    const days = Number(f.days ?? 2);
    const rows = pos[0]
      ? await db.query('select v.*, h.check_in_time, h.access_notes, g.email from v_stays v join homes h on h.id = v.home_id join guests g on g.id = v.guest_id where v.id = $1', [(await resolve(db, 'reservation', pos[0])).id])
      : await db.query(`select v.*, h.check_in_time, h.access_notes, g.email from v_stays v join homes h on h.id = v.home_id join guests g on g.id = v.guest_id where v.status = 'confirmed' and v.arrive_on between stay_today() and stay_today() + $1::int order by v.arrive_on`, [days]);
    const set = await settingsOf(db);
    const files = [];
    for (const r of rows) {
      const body = [
        `To: ${r.email ?? r.guest}`, `Subject: Your stay at ${r.home}, ${r.arrive_on}`, '',
        `Hi ${r.guest.split(/\s+/)[0]},`, '',
        `We're looking forward to having you at ${r.home} from ${r.arrive_on} to ${r.depart_on}. Check-in is from ${r.check_in_time}.`,
        `Getting in: ${r.access_notes ?? '[how to get in]'}. We send the door code on the morning you arrive.`,
        Number(r.balance_cents) > 0 ? `There is ${money(r.balance_cents, set.currency)} still to pay before you arrive.` : '',
        '', 'Reply here if you need anything.', '', set.business_name,
      ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
      files.push(writeDraft(`prearrival-${r.code}.md`, body));
    }
    return files.length ? files.join('\n') : 'No arrivals in that window.';
  },

  async 'draft-clean-sheet'(db, f) {
    const days = Number(f.days ?? 2);
    const r = await reports.cleans(db, { days }, []);
    const by = new Map();
    for (const row of r.rows) { if (!by.has(row.cleaner)) by.set(row.cleaner, []); by.get(row.cleaner).push(row); }
    const out = [];
    for (const [cleaner, rows] of by) {
      const body = [`To: ${cleaner}`, `Subject: Cleans for the next ${days} days`, '', ...rows.map((c) => `- ${c.due_on} ${c.home}: after ${c.after ?? 'extra clean'}${c.next_arrival ? `, next guests arrive ${c.next_arrival}${String(c.next_arrival) === String(c.due_on) ? ` (ready by ${c.ready_by})` : ''}` : ''}${c.notes ? `. ${c.notes}` : ''}`), '', 'Reply with any damage or missing items and photos.'].join('\n');
      out.push(writeDraft(`clean-sheet-${slug(cleaner)}.md`, body));
    }
    return out.length ? out.join('\n') : 'No cleans in that window.';
  },
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
function writeDraft(name, body) {
  const dir = path.join(REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body + '\n');
  return `draft: drafts/${name}`;
}

export const HELP = `Short-Stay Management CLI

Reports (add --json for machine output):
  attention                         everything that needs a decision
  arrivals [--days=2]               departures [--days=2]
  turnovers [--days=3]              departures, the next arrival, and who is cleaning
  cleans [--days=3] [--cleaner=X]   the clean run sheet
  calendar <home> [--weeks=6]       reservations [--home --owner --status --from --to]
  night-caps                        nights used and booked against each capped home
  compliance                        the rules in docs/compliance.md checked against the records
  levy [--from --to]                Victorian short stay levy on direct bookings
  homes | owners | owner <name>     statements [--months=3]
  statement <owner> --month=YYYY-MM [--save | --issue | --paid]
  performance | channels | cleaners | pace | issues [--all] | repeat-guests
  reservation <code or guest>       weekly-review

Actions:
  book <home> --guest="Name" --arrive=DATE (--nights=N | --depart=DATE) --rent=AMOUNT [--channel=Direct --guests=2 --email= --enquiry --force]
  cancel <code> [--reason=]   check-in <code>   check-out <code>   pay <code> --amount= [--method= --reference=]
  record-levy <code> --amount=   block <home> --from=DATE (--to=DATE | --nights=N) [--kind=owner_stay|maintenance|hold --note=]
  assign-clean <code> <cleaner>   clean-done <code> [--issue-note="..."]
  issue <home> --title= [--priority=urgent|normal|low --quote= --status=]   resolve <home> --title= [--cost=]
  expense <home> --amount= --description= [--category=]   log <home|owner|reservation|guest|cleaner> <name> --note=
  add <home|owner|cleaner|channel> --name= ...   set <home|owner|cleaner|channel|settings> [name] --field=value
  import guesty <reservations.csv> [--listings=listings.csv --owner="Name" --date-order=dmy|mdy --apply]
  export [--dir=exports]
  draft-owner-update <owner> [--month=YYYY-MM]   draft-prearrival [code] [--days=2]   draft-clean-sheet [--days=2]
Drafts go to drafts/. Nothing here sends a message, charges a card or pays an owner.`;

function print(result, json) {
  if (typeof result === 'string') { console.log(json ? JSON.stringify({ message: result }) : result); return; }
  const list = Array.isArray(result) ? result : [result];
  if (json) { console.log(JSON.stringify(list.length === 1 ? list[0].rows : Object.fromEntries(list.map((r) => [r.title, r.rows])), null, 2)); return; }
  for (const r of list) {
    console.log(heading(r.title));
    console.log(table(r.rows, r.columns.map((c) => ({ key: c, label: c.replaceAll('_', ' '), align: typeof r.rows[0]?.[c] === 'number' ? 'right' : 'left', width: 70 }))));
  }
}

export async function run(argv, db) {
  const [cmd, ...rest] = argv;
  const { flags, pos } = parseArgs(rest);
  if (!cmd || cmd === 'help' || flags.help) return HELP;
  if (cmd === 'statement') return statementAction(db, flags, pos);
  if (reports[cmd]) return reports[cmd](db, flags, pos);
  if (actions[cmd]) return actions[cmd](db, flags, pos);
  throw Error(`Unknown command "${cmd}". Run with help to see them all.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const db = await getDb();
  try {
    print(await run(argv, db), json);
  } catch (e) {
    console.error(e instanceof Ambiguous ? e.message : `Error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
