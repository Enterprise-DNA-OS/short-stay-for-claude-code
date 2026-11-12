// Bring reservations and listings across from a Guesty CSV report.
// Guesty lets you pick the columns of a report, so headers are matched by the names Guesty
// uses in its column picker and a few common variants, case-insensitive. A column that cannot
// be found is listed and the import stops: ask your agent to map it.
import { readFileSync } from 'node:fs';
import { parseCsv, pick } from './csv.mjs';

export const RESERVATION_COLUMNS = {
  code: ['Confirmation code', 'Confirmation Code', 'CONFIRMATION CODE', 'Reservation ID', 'Confirmation'],
  listing: ["Listing's nickname", 'Listing nickname', 'Listing', 'Listing name', "Listing's title", 'Nickname'],
  guest: ["Guest's name", 'Guest name', 'Guest', 'Full name'],
  email: ["Guest's email", 'Guest email', 'Email'],
  phone: ["Guest's phone", 'Guest phone', 'Phone'],
  arrive: ['Check in', 'Check-in', 'Check in date', 'Checkin', 'Arrival'],
  depart: ['Check out', 'Check-out', 'Check out date', 'Checkout', 'Departure'],
  guests: ['Number of guests', 'Guests', 'Guests count'],
  source: ['Source', 'Channel', 'Integration'],
  status: ['Status', 'Reservation status'],
  rent: ['Accommodation fare', 'Accommodation', 'Fare accommodation', 'Base price'],
  cleaning: ['Cleaning fare', 'Cleaning fee', 'Fare cleaning'],
  commission: ['Channel commission', 'Host service fee', 'Commission'],
  paid: ['Total paid', 'Paid', 'Amount paid'],
  created: ['Creation date', 'Created at', 'Booked at', 'Booking date'],
};
const REQUIRED = ['code', 'listing', 'guest', 'arrive', 'depart', 'rent'];

export const LISTING_COLUMNS = {
  name: ['Nickname', "Listing's nickname", 'Listing nickname', 'Name'],
  address: ['Address', 'Full address', 'Location'],
  bedrooms: ['Bedrooms', 'Number of bedrooms'],
  guests: ['Accommodates', 'Max guests', 'Guests'],
  owner: ['Owner', 'Owners', 'Owner name'],
};

export function toDate(v, order = 'dmy', what = 'date') {
  const s = String(v ?? '').trim();
  if (!s) throw Error(`Required: ${what}`);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const [a, b] = order === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    if (Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) || Number(b) > 12) throw Error(`${what} "${s}" is not a date I can read (day/month/year, or YYYY-MM-DD)`);
    return iso;
  }
  throw Error(`${what} "${s}" is not a date I can read (day/month/year, or YYYY-MM-DD)`);
}

export function cents(v) {
  const s = String(v ?? '').replace(/[^0-9.-]/g, '');
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw Error(`"${v}" is not an amount`);
  return Math.round(n * 100);
}

function columnsFound(rows, spec) {
  const keys = rows.length ? Object.keys(rows[0]).map((k) => k.toLowerCase()) : [];
  const found = {};
  for (const [field, names] of Object.entries(spec)) found[field] = names.some((n) => keys.includes(n.toLowerCase()));
  return found;
}

function channelName(source) {
  const s = String(source || '').toLowerCase();
  if (!s || /manual|direct|website|booking engine|bookingengine/.test(s)) return 'Direct';
  if (/airbnb/.test(s)) return 'Airbnb';
  if (/booking\.?com/.test(s)) return 'Booking.com';
  if (/stayz|homeaway/.test(s)) return 'Stayz';
  if (/vrbo/.test(s)) return 'Vrbo';
  if (/expedia/.test(s)) return 'Expedia';
  if (/owner/.test(s)) return 'Owner';
  return source.trim();
}

function statusOf(raw, depart, today) {
  const s = String(raw || 'confirmed').toLowerCase();
  if (/cancel|declin|expired|closed/.test(s)) return 'cancelled';
  if (/inquir|enquir|reserved|awaiting|pending/.test(s)) return 'enquiry';
  return depart <= today ? 'checked_out' : 'confirmed';
}

export async function importGuesty(db, file, { apply = false, order = 'dmy', listings = null, owner = 'Owner to confirm' } = {}) {
  const today = (await db.query('select stay_today()::text d'))[0].d;
  const summary = { homes_created: 0, owners_created: 0, guests_created: 0, channels_created: 0, reservations_created: 0, reservations_updated: 0, payments: 0, skipped: [] };

  if (listings) {
    const rows = parseCsv(readFileSync(listings, 'utf8'));
    const found = columnsFound(rows, LISTING_COLUMNS);
    if (!found.name) throw Error(`The listings file has no nickname column. Looked for: ${LISTING_COLUMNS.name.join(', ')}`);
    for (const r of rows) {
      const name = pick(r, ...LISTING_COLUMNS.name).trim();
      if (!name) continue;
      const ownerName = pick(r, ...LISTING_COLUMNS.owner).trim() || owner;
      const ownerId = await ensure(db, 'owners', ownerName, {}, apply, summary, 'owners_created');
      const exists = (await db.query('select id from homes where lower(name) = lower($1)', [name]))[0];
      if (exists) continue;
      summary.homes_created++;
      if (apply) {
        await db.query('insert into homes (name, owner_id, address, bedrooms, max_guests) values ($1, $2, $3, $4, $5)',
          [name, ownerId, pick(r, ...LISTING_COLUMNS.address) || null, Number(pick(r, ...LISTING_COLUMNS.bedrooms)) || 1, Number(pick(r, ...LISTING_COLUMNS.guests)) || 2]);
      }
    }
  }

  const rows = parseCsv(readFileSync(file, 'utf8'));
  const found = columnsFound(rows, RESERVATION_COLUMNS);
  const missing = REQUIRED.filter((f) => !found[f]);
  if (rows.length && missing.length) {
    throw Error(`The reservations report is missing ${missing.map((f) => `${f} (looked for: ${RESERVATION_COLUMNS[f].join(', ')})`).join('; ')}. Add the column in Guesty's report, or map it.`);
  }

  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    try {
      const code = pick(r, ...RESERVATION_COLUMNS.code).trim();
      const listing = pick(r, ...RESERVATION_COLUMNS.listing).trim();
      if (!code || !listing) { summary.skipped.push(`row ${line}: no confirmation code or listing`); continue; }
      const arrive = toDate(pick(r, ...RESERVATION_COLUMNS.arrive), order, 'check in');
      const depart = toDate(pick(r, ...RESERVATION_COLUMNS.depart), order, 'check out');
      if (depart <= arrive) { summary.skipped.push(`row ${line} ${code}: check out is not after check in`); continue; }
      const home = (await db.query('select id from homes where lower(name) = lower($1)', [listing]))[0];
      let homeId = home?.id;
      if (!homeId) {
        const ownerId = await ensure(db, 'owners', owner, {}, apply, summary, 'owners_created');
        summary.homes_created++;
        if (apply) homeId = (await db.query('insert into homes (name, owner_id) values ($1, $2) returning id', [listing, ownerId]))[0].id;
      }
      const guestName = pick(r, ...RESERVATION_COLUMNS.guest).trim() || 'Guest';
      const email = pick(r, ...RESERVATION_COLUMNS.email).trim() || null;
      const guestId = await ensureGuest(db, guestName, email, pick(r, ...RESERVATION_COLUMNS.phone).trim() || null, apply, summary);
      const channelId = await ensure(db, 'channels', channelName(pick(r, ...RESERVATION_COLUMNS.source)), {}, apply, summary, 'channels_created');
      const status = statusOf(pick(r, ...RESERVATION_COLUMNS.status), depart, today);
      const rent = cents(pick(r, ...RESERVATION_COLUMNS.rent));
      const cleaning = cents(pick(r, ...RESERVATION_COLUMNS.cleaning));
      const commissionRaw = pick(r, ...RESERVATION_COLUMNS.commission);
      const commission = commissionRaw === '' ? null : Math.abs(cents(commissionRaw));
      const paid = cents(pick(r, ...RESERVATION_COLUMNS.paid));
      const createdRaw = pick(r, ...RESERVATION_COLUMNS.created);
      const booked = createdRaw ? toDate(createdRaw, order, 'creation date') : arrive;
      const existing = (await db.query('select id from reservations where code = $1', [code]))[0];
      if (existing) {
        summary.reservations_updated++;
        if (apply) {
          await db.query(`update reservations set home_id = $2, guest_id = $3, channel_id = $4, status = $5, arrive_on = $6, depart_on = $7, rent_cents = $8,
            cleaning_fee_cents = $9, commission_cents = $10, guests_count = $11 where id = $1`,
            [existing.id, homeId, guestId, channelId, status, arrive, depart, rent, cleaning, commission, Number(pick(r, ...RESERVATION_COLUMNS.guests)) || 2]);
        }
        continue;
      }
      summary.reservations_created++;
      if (apply) {
        const id = (await db.query(`insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, commission_cents, booked_on, external_ref)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $1) returning id`,
          [code, homeId, guestId, channelId, status, arrive, depart, Number(pick(r, ...RESERVATION_COLUMNS.guests)) || 2, rent, cleaning, commission, booked]))[0].id;
        if (paid > 0) {
          await db.query("insert into payments (reservation_id, amount_cents, received_on, method, reference) values ($1, $2, $3, 'imported from Guesty', $4)", [id, paid, booked, code]);
          summary.payments++;
        }
      } else if (paid > 0) summary.payments++;
    } catch (e) {
      summary.skipped.push(`row ${line}: ${e.message}`);
    }
  }
  return summary;
}

async function ensure(db, tableName, name, extra, apply, summary, counter) {
  const row = (await db.query(`select id from ${tableName} where lower(name) = lower($1)`, [name]))[0];
  if (row) return row.id;
  summary[counter]++;
  if (!apply) return null;
  return (await db.query(`insert into ${tableName} (name) values ($1) returning id`, [name]))[0].id;
}

async function ensureGuest(db, name, email, phone, apply, summary) {
  const row = email
    ? (await db.query('select id from guests where lower(email) = lower($1)', [email]))[0]
    : (await db.query('select id from guests where lower(name) = lower($1) and email is null', [name]))[0];
  if (row) return row.id;
  summary.guests_created++;
  if (!apply) return null;
  return (await db.query('insert into guests (name, email, phone) values ($1, $2, $3) returning id', [name, email, phone]))[0].id;
}
