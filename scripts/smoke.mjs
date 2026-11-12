#!/usr/bin/env node
// npm test: a throwaway database, the migration, the demo business pinned to 12 November 2026,
// then every report and action with assertions on the rules that matter. Needs no secrets.
// Runs on Windows and Linux. With TEST_DATABASE_URL set it runs against that (disposable) Postgres instead.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, HELP } from './stays.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'short-stay-test-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = dir;

let db, checks = 0;
const seen = new Set();
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const call = async (...args) => { seen.add(args[0]); return run(args, db); };
const rows = async (...args) => { const r = await call(...args); return Array.isArray(r) ? r[0].rows : r.rows; };
const reject = async (args, re) => { seen.add(args[0]); await assert.rejects(() => run(args, db), re); checks++; };
const one = async (sql, params = []) => (await db.query(sql, params))[0];
const cli = (...args) => spawnSync(process.execPath, ['scripts/stays.mjs', ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
const TODAY = '2026-11-12';
const day = (n) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

try {
  db = await getDb();
  if (process.env.TEST_DATABASE_URL) await db.exec('drop schema public cascade; create schema public;');
  eq((await migrate(db)).ran, ['0001_short_stay.sql']);
  eq((await migrate(db)).ran.length, 0, 'migrate twice is safe');
  await db.query('update settings set as_of = $1', [TODAY]);
  await seed(db);
  const count = (await one('select count(*)::int n from reservations')).n;
  await seed(db);
  eq((await one('select count(*)::int n from reservations')).n, count, 'seed is idempotent');
  ok(count > 300, 'a year of stays across eight homes');
  ok(HELP.includes('import guesty'));

  // Every report runs.
  for (const name of ['attention', 'arrivals', 'departures', 'turnovers', 'cleans', 'reservations', 'night-caps', 'compliance', 'levy', 'owners', 'homes', 'statements', 'performance', 'channels', 'cleaners', 'pace', 'issues', 'repeat-guests', 'weekly-review']) {
    const r = await call(name);
    ok((Array.isArray(r) ? r : [r]).every((x) => Array.isArray(x.rows)), `${name} returns rows`);
  }

  // The desk's morning: everything that needs a decision.
  const att = await rows('attention');
  const reasons = new Set(att.map((r) => r.reason));
  for (const r of ['clean not booked', 'clean has no cleaner', 'clean overdue', 'clean reported an issue', 'double booked', 'not checked out', 'balance owing before arrival',
    'enquiry going cold', 'issue open', 'owner statement not issued', 'owner not paid', 'registration expiring', 'night cap close', 'empty calendar']) ok(reasons.has(r), `attention shows ${r}`);
  eq(att.find((r) => r.reason === 'clean not booked').ref, 'CR-90003', 'the Bondi same-day turnover has no clean booked');
  eq(att.find((r) => r.reason === 'owner statement not issued').home, 'Helen Brooks');
  eq(att.find((r) => r.reason === 'empty calendar').home, 'Margaret River Vineyard Cottage');
  const turn = await rows('turnovers');
  eq(turn.filter((t) => t.turnaround === 'same day').map((t) => t.home).sort(), ['Bondi Terrace', 'Byron Hinterland Cabin']);

  // The rules: night caps, registration, the Victorian levy, card numbers, privacy.
  const caps = Object.fromEntries((await rows('night-caps')).map((c) => [c.home, c]));
  ok(Number(caps['Byron Hinterland Cabin'].total) > 60, 'Byron is over its 60 nights');
  ok(Number(caps['Bondi Terrace'].total) >= 153 && Number(caps['Bondi Terrace'].total) <= 180, 'Bondi is close to 180');
  const longStay = await one(`select count(*)::int n from v_nights n join homes h on h.id = n.home_id where h.name = 'Bondi Terrace' and n.long_booking`);
  ok(longStay.n >= 21, 'the 24-night Bondi booking is marked as a long booking');
  const comp = await rows('compliance');
  const rule = (r, state) => comp.filter((c) => c.rule === r && (!state || c.state === state));
  ok(rule('BYRON-60-NIGHTS', 'breached').length === 1);
  ok(rule('NSW-180-NIGHTS', 'due').length === 1);
  ok(rule('WA-PERTH-90-NIGHTS', 'due').length === 1);
  eq(rule('STRA-REGISTRATION', 'breached')[0].home, 'Manly Harbour Apartment', 'Manly has no registration number');
  eq(rule('STRA-REGISTRATION', 'due')[0].home, 'Blue Mountains Retreat', 'Blue Mountains expires within 30 days');
  ok(rule('VIC-SHORT-STAY-LEVY', 'breached')[0].detail.startsWith('CR-90042'), 'a completed direct stay with no levy recorded');
  ok(rule('CARD-DATA').length === 1 && rule('PRIVACY-RETENTION').length === 1 && rule('DOUBLE-BOOKING').length === 1);
  const levy = (await rows('levy', `--from=${day(-30)}`, `--to=${day(30)}`)).find((l) => l.code === 'CR-90041');
  eq([String(levy.booking_fee), String(levy.levy_due)], ['1610.00', '120.75'], '7.5% of the total booking fee');

  // Money: commission, fee and owner share on one stay; the statement adds up.
  const s = await one(`select * from v_stays where code = 'CR-90051'`);
  eq([Number(s.commission_cents), Number(s.fee_cents), Number(s.fee_gst_cents), Number(s.owner_cents)], [29760, 29203, 2920, 130117], 'Airbnb 15.5%, 18% fee on rent after commission, GST on the fee');
  const month = day(-40).slice(0, 7);
  const st = await call('statement', 'helen', `--month=${month}`);
  const tot = st[2].rows[0];
  const stayOwner = st[0].rows.reduce((a, r) => a + Math.round(Number(r.owner) * 100), 0);
  eq(Math.round(Number(tot.payout) * 100), stayOwner - Math.round(Number(tot.expenses) * 100), 'payout = owner shares less expenses');
  const oct = day(-30).slice(0, 7);
  await call('statement', 'Helen Brooks', `--month=${oct}`, '--issue');
  ok(!(await rows('attention')).some((r) => r.reason === 'owner statement not issued'), 'issuing clears the late statement');
  await reject(['statement', 'Helen Brooks', `--month=${oct}`, '--save'], /already issued/);
  await call('statement', 'Helen Brooks', `--month=${oct}`, '--paid');
  eq((await one(`select s.status from statements s join owners o on o.id = s.owner_id where o.name = 'Helen Brooks' and s.period_start = $1`, [`${oct}-01`])).status, 'paid');
  ok((await one(`select count(*)::int n from expenses where statement_id is not null`)).n > 0, 'expenses are tied to their statement');

  // Cleaners: whose turnovers come before the low cleanliness scores.
  const cl = await rows('cleaners');
  eq(cl[0].cleaner, 'Coastal Linen Co', 'lowest next-guest cleanliness first');
  ok(Number(cl[0].next_guest_cleanliness) < Number(cl[1].next_guest_cleanliness));
  const ch = await rows('channels');
  ok(Number(ch.find((c) => c.channel === 'Direct').commission) === 0);
  ok(Number(ch.find((c) => c.channel === 'Direct').owner_per_night) > Number(ch.find((c) => c.channel === 'Airbnb').owner_per_night), 'direct leaves the owner more a night');
  eq((await rows('pace')).length, 12);
  ok((await rows('repeat-guests')).every((g) => Number(g.stays) > 1));

  // Names: exact, fragment, ambiguous, missing.
  await reject(['owner', 'nobody here'], /No owner matches/);
  await reject(['calendar', 'Cottage'], /matches 2 home records/);
  eq((await call('owner', 'priya'))[0].rows.length, 2);
  eq((await call('reservation', 'CR-90043'))[0].rows.find((r) => r.field === 'balance').value, '1127.00');

  // Book, clash, block, clean, pay, check in and out.
  await reject(['book', 'Bondi', '--guest=Test Guest', `--arrive=${day(9)}`, '--nights=2', '--rent=900'], /taken on those nights/);
  const msg = await call('book', 'Sorrento', '--guest=Nina Hart', '--email=nina@example.com', `--arrive=${day(17)}`, '--nights=3', '--rent=1080');
  ok(/Booked CR-\d+.*Victorian levy 93\.75 recorded/.test(msg), 'a direct Victorian booking records the levy');
  const code = msg.match(/CR-\d+/)[0];
  await reject(['block', 'Sorrento', `--from=${day(18)}`, '--nights=2'], /sit over/);
  ok((await call('block', 'Margaret River', `--from=${day(5)}`, '--nights=4', '--note=Owner visit')).includes('Blocked'));
  ok(!(await rows('attention')).some((r) => r.reason === 'empty calendar'), 'the owner block fills the empty calendar');
  ok((await call('assign-clean', code, 'Bay Cleaners')).includes('Bay Cleaners'));
  ok((await call('assign-clean', 'CR-90003', 'Sparkle')).includes('Sparkle Turnovers'));
  ok((await call('assign-clean', 'CR-90022', 'Coastal')).includes('Coastal Linen Co'));
  const att2 = new Set((await rows('attention')).map((r) => r.reason));
  ok(!att2.has('clean not booked') && !att2.has('clean has no cleaner'), 'both turnovers covered');
  ok((await call('check-out', 'CR-90011')).includes('checked out'));
  ok((await call('clean-done', 'CR-90011')).includes('marked done'));
  ok(!(await rows('attention')).some((r) => r.reason === 'clean overdue' || r.reason === 'not checked out'));
  ok((await call('pay', 'CR-90043', '--amount=1127')).includes('Balance now 0.00'));
  ok((await call('record-levy', 'CR-90043', '--amount=120.75')).includes('120.75'));
  ok((await call('record-levy', 'CR-90042', '--amount=93.75')).includes('93.75'));
  ok(!(await rows('compliance')).some((r) => r.rule === 'VIC-SHORT-STAY-LEVY'), 'levies recorded');
  await reject(['check-in', 'CR-90043', '--x'], /needs a value/);
  ok((await call('check-in', 'CR-90043')).includes('checked in'));
  await reject(['check-in', 'CR-90043'], /checked_in/);
  ok((await call('cancel', 'CR-90012', '--reason=Guest changed plans')).includes('Cancelled'));

  // Repairs, expenses, notes, records.
  ok((await call('issue', 'Cottesloe', '--title=Shower screen cracked', '--priority=urgent', '--quote=420')).includes('urgent'));
  ok((await call('resolve', 'Cottesloe', '--title=shower', '--cost=420')).includes('next statement'));
  ok((await call('expense', 'Bondi', '--amount=65', '--description=Smoke alarm batteries', '--category=supplies')).includes('65.00'));
  ok((await call('log', 'owner', 'Daniel', '--note=Wants Byron off the market in January', '--kind=call')).includes('Daniel Cho'));
  ok((await call('add', 'owner', '--name=Ruth Ngata', '--email=ruth@example.com')).includes('Ruth Ngata'));
  ok((await call('add', 'home', '--name=Arrowtown Cottage', '--owner=Ruth', '--rules=qldc', '--night-cap=90', '--bedrooms=2', '--cleaning-fee=150', '--clean-cost=110')).includes('qldc'));
  ok((await rows('compliance')).some((r) => r.rule === 'QLDC-REGISTERED' && r.home === 'Arrowtown Cottage'), 'a council-registered home with no number is flagged');
  ok((await call('set', 'home', 'Arrowtown', '--registration=QLDC-RVA-2207')).includes('Updated'));
  ok(!(await rows('compliance')).some((r) => r.rule === 'QLDC-REGISTERED'));
  await reject(['set', 'home', 'Arrowtown', '--colour=blue'], /Unknown home field/);
  ok((await call('set', 'channel', 'Airbnb', '--commission-pct=15')).includes('Updated'));

  // Import from Guesty: a test run writes nothing, --apply writes, a second run updates.
  const resv = path.join(REPO_ROOT, 'fixtures', 'guesty', 'reservations.csv');
  const lst = path.join(REPO_ROOT, 'fixtures', 'guesty', 'listings.csv');
  const before = (await one('select count(*)::int n from reservations')).n;
  ok((await call('import', 'guesty', resv, `--listings=${lst}`)).includes('Test run'));
  eq((await one('select count(*)::int n from reservations')).n, before, 'a test run writes nothing');
  const imp = await call('import', 'guesty', resv, `--listings=${lst}`, '--apply');
  ok(imp.includes('reservations created: 5') && imp.includes('homes created: 2'), imp);
  const avalon = await one(`select h.name, o.name as owner, h.bedrooms from homes h join owners o on o.id = h.owner_id where h.name = 'Avalon Beach House'`);
  eq([avalon.owner, avalon.bedrooms], ['Gordon Ashby', 4]);
  eq((await one(`select status from reservations where code = 'HMQ8PL21ZX'`)).status, 'cancelled');
  eq((await one(`select status from reservations where code = 'HMZ7TT45RN'`)).status, 'confirmed');
  eq((await one(`select c.name from reservations r join channels c on c.id = r.channel_id where r.code = 'GY-DIRECT-0041'`)).name, 'Direct');
  eq(Number((await one(`select commission_cents from reservations where code = 'HMX4K2P9QA'`)).commission_cents), 37975);
  eq((await one(`select count(*)::int n from guests where email = 'rebecca.lowe@example.com'`)).n, 1, 'one guest across two reservations');
  ok((await call('import', 'guesty', resv, '--apply')).includes('reservations updated: 5'), 'a second import updates, never duplicates');
  const bad = path.join(dir, 'bad.csv');
  fs.writeFileSync(bad, 'Guest,Nights\nSomeone,3\n');
  await reject(['import', 'guesty', bad], /missing code/);

  // Export, drafts.
  ok((await call('export', `--dir=${path.join(dir, 'exports')}`)).includes('14 CSV files'));
  ok(fs.readFileSync(path.join(dir, 'exports', 'reservations.csv'), 'utf8').includes('HMX4K2P9QA'));
  const draft = await call('draft-owner-update', 'Priya', `--month=${oct}`);
  const draftFile = path.join(REPO_ROOT, draft.replace('draft: ', ''));
  const body = fs.readFileSync(draftFile, 'utf8');
  ok(body.includes('Hi Priya') && body.includes('Balcony door lock sticks') && body.includes('your payout is'), 'the owner update carries the payout and the open repair');
  fs.rmSync(draftFile);
  const pre = await call('draft-prearrival', '--days=2');
  ok(pre.includes('prearrival-CR-90004'));
  for (const f of pre.split('\n')) fs.rmSync(path.join(REPO_ROOT, f.replace('draft: ', '')));
  const sheets = await call('draft-clean-sheet', '--days=3');
  ok(sheets.includes('clean-sheet-sparkle-turnovers'));
  for (const f of sheets.split('\n')) fs.rmSync(path.join(REPO_ROOT, f.replace('draft: ', '')));

  // The CLI as a process: tables, --json, and exit 1 with candidates when a name is ambiguous.
  await db.close(); db = null;
  const json = cli('homes', '--json');
  eq(json.status, 0, json.stderr);
  eq(JSON.parse(json.stdout).length, 11, 'eight demo homes, one added, two imported');
  const amb = cli('owner', 'a');
  eq(amb.status, 1);
  ok(amb.stderr.includes('Say which one'));
  ok(cli('attention').stdout.includes('reason'));

  // Documents and views in the business's brand.
  for (const script of ['docs', 'view']) {
    const res = spawnSync(process.execPath, [`scripts/${script}.mjs`], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    eq(res.status, 0, res.stderr);
  }
  ok(fs.readFileSync(path.join(dir, 'views', 'week.html'), 'utf8').includes('Needs attention'));
  ok(fs.readFileSync(path.join(dir, 'views', 'compliance.html'), 'utf8').includes('BYRON-60-NIGHTS'));
  const stmts = fs.readdirSync(path.join(dir, 'docs-out', 'owner-statement'));
  const helen = fs.readFileSync(path.join(dir, 'docs-out', 'owner-statement', stmts.find((f) => f.startsWith(`helen-brooks-${oct}`))), 'utf8');
  ok(helen.toLowerCase().includes('payout to you') && helen.includes('Coast and Range Stays'), 'the owner statement carries the business and the payout');
  ok(fs.readdirSync(path.join(dir, 'docs-out', 'letting-record')).some((f) => f.startsWith('byron-hinterland-cabin')));

  const recipes = fs.readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  console.log(`PASS: ${checks} checks; ${seen.size} CLI commands exercised; ${recipes.length} slash commands; documents and views rendered.`);
} finally {
  await db?.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
