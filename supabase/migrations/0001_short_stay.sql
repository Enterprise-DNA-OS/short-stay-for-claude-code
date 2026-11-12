-- Short-Stay Management for Claude Code: the schema.
-- Homes you let for owners, the reservations on them, the cleans between stays,
-- the money each stay makes and where it goes, and the statement each owner gets.
-- Plain Postgres. Runs on any Postgres (Supabase, Neon, RDS) and on the embedded PGlite.
-- Money is stored in cents. Dates are calendar dates. A stay's nights are arrive_on up to the night before depart_on.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- One row. as_of pins "today" for testing and demos; leave it empty in real use.
create table settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Your Holiday Homes',
  currency text not null default 'NZD',
  country text not null default 'NZ' check (country in ('NZ', 'AU')),
  default_fee_pct numeric(5,2) not null default 20,   -- management commission on rent after channel commission
  fee_gst_pct numeric(5,2) not null default 15,       -- GST added to the management fee (0 if you are not registered)
  statement_due_days int not null default 10,         -- owner statements issued within this many days of month end
  levy_rate_pct numeric(5,2) not null default 7.5,    -- Victorian short stay levy
  privacy_review_years int not null default 7,
  as_of date,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1);

create or replace function stay_today() returns date language sql stable as $$
  select coalesce((select as_of from settings where id = 1), current_date)
$$;

create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  payout_account text,          -- the last four digits only, never a full account number
  gst_registered boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A home is one listing you manage. Rules decide which law applies to it.
-- rules: 'none', 'nsw-cap' (NSW 180 nights), 'byron-cap' (60 nights), 'wa-perth' (90 nights before approval),
-- 'wa-regional', 'vic' (short stay levy), 'qldc' (registered with council, zone night cap), 'other'.
create table homes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner_id uuid not null references owners(id),
  address text,
  area text,
  rules text not null default 'none' check (rules in ('none', 'nsw-cap', 'nsw', 'byron-cap', 'wa-perth', 'wa-regional', 'vic', 'qldc', 'other')),
  hosted boolean not null default false,       -- the owner lives on site while guests stay
  night_cap int,                               -- nights a year the home may be let without further approval
  cap_year_starts_on date,                     -- start of the counting year (registration date), null = 1 January
  registration_no text,                        -- STRA or council registration number shown on every listing
  registration_expires_on date,
  approval_ref text,                           -- development approval or resource consent that lifts the cap
  bedrooms int not null default 1,
  max_guests int not null default 2,
  fee_pct numeric(5,2),                        -- overrides settings.default_fee_pct
  guest_cleaning_fee_cents bigint not null default 0,
  clean_cost_cents bigint not null default 0,  -- what the cleaner is paid per turnover
  clean_minutes int not null default 120,
  check_in_time text not null default '15:00',
  check_out_time text not null default '10:00',
  access_notes text,                           -- how guests get in; never the lockbox code itself
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'ota' check (kind in ('ota', 'direct', 'owner')),
  commission_pct numeric(5,2) not null default 0,
  collects_levy boolean not null default false,   -- the platform collects the Victorian levy itself
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  home_id uuid not null references homes(id),
  guest_id uuid not null references guests(id),
  channel_id uuid not null references channels(id),
  status text not null default 'confirmed' check (status in ('enquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  arrive_on date not null,
  depart_on date not null,
  guests_count int not null default 2,
  rent_cents bigint not null default 0,          -- accommodation, what the guest paid for the nights
  cleaning_fee_cents bigint not null default 0,  -- charged to the guest, kept by the manager to pay the clean
  other_fees_cents bigint not null default 0,    -- pet fee, early check-in, linen
  commission_cents bigint,                       -- channel commission; null = channel rate times rent
  levy_cents bigint,                             -- Victorian levy recorded on a direct booking
  booked_on date not null default current_date,
  eta text,
  external_ref text,                             -- the code in Guesty or the channel
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (depart_on > arrive_on)
);
create index reservations_home_dates on reservations (home_id, arrive_on, depart_on);

create table payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id),
  amount_cents bigint not null,
  received_on date not null default current_date,
  method text not null default 'channel payout',
  reference text,
  created_at timestamptz not null default now()
);

-- Nights a home is not for sale: the owner staying, repairs, a hold.
create table blocks (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  starts_on date not null,
  ends_on date not null,
  kind text not null default 'owner_stay' check (kind in ('owner_stay', 'maintenance', 'hold')),
  note text,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

create table cleaners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  email text,
  areas text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One clean per departure (and any extra the manager adds).
create table cleans (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  reservation_id uuid references reservations(id),
  due_on date not null,
  cleaner_id uuid references cleaners(id),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'issue', 'cancelled')),
  done_on date,
  cost_cents bigint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cleans_one_per_departure on cleans (reservation_id) where reservation_id is not null and status <> 'cancelled';

create table issues (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  reported_on date not null default current_date,
  title text not null,
  priority text not null default 'normal' check (priority in ('urgent', 'normal', 'low')),
  status text not null default 'open' check (status in ('open', 'waiting_owner', 'booked', 'done')),
  quote_cents bigint,
  resolved_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Money spent on a home that the owner pays back on their statement.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id),
  incurred_on date not null default current_date,
  description text not null,
  category text not null default 'repairs' check (category in ('repairs', 'supplies', 'linen', 'utilities', 'gardening', 'other')),
  amount_cents bigint not null,
  issue_id uuid references issues(id),
  statement_id uuid,
  created_at timestamptz not null default now()
);

create table statements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid')),
  stays int not null default 0,
  rent_cents bigint not null default 0,
  commission_cents bigint not null default 0,
  fee_cents bigint not null default 0,
  fee_gst_cents bigint not null default 0,
  expenses_cents bigint not null default 0,
  payout_cents bigint not null default 0,
  issued_on date,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, period_start)
);
alter table expenses add constraint expenses_statement_fk foreign key (statement_id) references statements(id);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) unique,
  rating numeric(3,1) not null check (rating between 1 and 5),
  cleanliness numeric(3,1) check (cleanliness between 1 and 5),
  comment text,
  received_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('home', 'owner', 'reservation', 'guest', 'cleaner')),
  subject_id uuid not null,
  kind text not null default 'note' check (kind in ('note', 'call', 'email', 'visit', 'owner_approval', 'complaint')),
  body text not null,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table audit (
  id bigint generated always as identity primary key,
  action text not null,
  record_id uuid,
  detail jsonb,
  at timestamptz not null default now()
);

create trigger owners_touch before update on owners for each row execute function touch_updated_at();
create trigger homes_touch before update on homes for each row execute function touch_updated_at();
create trigger channels_touch before update on channels for each row execute function touch_updated_at();
create trigger guests_touch before update on guests for each row execute function touch_updated_at();
create trigger reservations_touch before update on reservations for each row execute function touch_updated_at();
create trigger cleaners_touch before update on cleaners for each row execute function touch_updated_at();
create trigger cleans_touch before update on cleans for each row execute function touch_updated_at();
create trigger issues_touch before update on issues for each row execute function touch_updated_at();
create trigger statements_touch before update on statements for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- views

-- Every reservation with its money worked out.
-- Commission: the recorded figure, else the channel rate on rent.
-- Management fee: the home's rate (else the default) on rent after commission, plus GST on the fee.
-- Owner share: rent less commission, fee and fee GST. The cleaning fee pays the clean and stays with the manager.
create view v_reservations as
select r.id, r.code, r.status, r.arrive_on, r.depart_on, (r.depart_on - r.arrive_on) as nights,
  h.id as home_id, h.name as home, h.rules, o.id as owner_id, o.name as owner,
  g.id as guest_id, g.name as guest, c.name as channel, c.kind as channel_kind, c.collects_levy,
  r.guests_count, r.booked_on, r.eta,
  r.rent_cents, r.cleaning_fee_cents, r.other_fees_cents,
  (r.rent_cents + r.cleaning_fee_cents + r.other_fees_cents) as total_cents,
  coalesce(r.commission_cents, round(r.rent_cents * c.commission_pct / 100))::bigint as commission_cents,
  round((r.rent_cents - coalesce(r.commission_cents, round(r.rent_cents * c.commission_pct / 100))) * coalesce(h.fee_pct, s.default_fee_pct) / 100)::bigint as fee_cents,
  round(round((r.rent_cents - coalesce(r.commission_cents, round(r.rent_cents * c.commission_pct / 100))) * coalesce(h.fee_pct, s.default_fee_pct) / 100) * s.fee_gst_pct / 100)::bigint as fee_gst_cents,
  coalesce((select sum(p.amount_cents) from payments p where p.reservation_id = r.id), 0)::bigint as paid_cents,
  r.levy_cents
from reservations r
join homes h on h.id = r.home_id
join owners o on o.id = h.owner_id
join guests g on g.id = r.guest_id
join channels c on c.id = r.channel_id
cross join settings s;

create view v_stays as
select v.*,
  (v.rent_cents - v.commission_cents - v.fee_cents - v.fee_gst_cents)::bigint as owner_cents,
  (v.total_cents - v.paid_cents)::bigint as balance_cents,
  case when v.nights > 0 then round(v.rent_cents::numeric / v.nights)::bigint else 0 end as nightly_cents
from v_reservations v;

create view v_live as
select * from v_stays where status in ('confirmed', 'checked_in', 'checked_out');

-- One row per let night. Bookings of 21 nights or more are marked: NSW leaves them out of the day limit.
create view v_nights as
select l.id as reservation_id, l.home_id, d::date as night_on, l.nights, l.nightly_cents, (l.nights >= 21) as long_booking
from v_live l cross join generate_series(l.arrive_on, l.depart_on - 1, interval '1 day') d;

-- The counting year for each home: from the registration anniversary if set, else 1 January.
create view v_cap_year as
select h.id as home_id,
  case when h.cap_year_starts_on is null then date_trunc('year', stay_today())::date
       when h.cap_year_starts_on > stay_today() then h.cap_year_starts_on
       else (h.cap_year_starts_on + interval '1 year' * extract(year from age(stay_today(), h.cap_year_starts_on))::int)::date end as year_start
from homes h;

create view v_night_cap as
select h.id as home_id, h.name as home, h.rules, h.night_cap, h.approval_ref, y.year_start, (y.year_start + interval '1 year')::date - 1 as year_end,
  count(n.night_on) filter (where n.night_on < stay_today() and not n.long_booking) as nights_used,
  count(n.night_on) filter (where n.night_on >= stay_today() and not n.long_booking) as nights_booked_ahead,
  count(n.night_on) filter (where not n.long_booking) as nights_total
from homes h
join v_cap_year y on y.home_id = h.id
left join v_nights n on n.home_id = h.id and n.night_on >= y.year_start and n.night_on < (y.year_start + interval '1 year')::date
where h.active and h.night_cap is not null and not h.hosted
group by h.id, h.name, h.rules, h.night_cap, h.approval_ref, y.year_start;

-- Departures and the next arrival in the same home: the turnover clean window.
create view v_turnovers as
select l.id as reservation_id, l.code, l.home_id, l.home, l.guest, l.depart_on,
  nx.code as next_code, nx.arrive_on as next_arrive_on, nx.guest as next_guest,
  case when nx.arrive_on = l.depart_on then 'same day' when nx.arrive_on is null then 'no arrival booked' else (nx.arrive_on - l.depart_on) || ' day gap' end as turnaround,
  cl.id as clean_id, cl.status as clean_status, cr.name as cleaner
from v_live l
left join lateral (select n.code, n.arrive_on, n.guest from v_live n where n.home_id = l.home_id and n.arrive_on >= l.depart_on and n.id <> l.id order by n.arrive_on limit 1) nx on true
left join cleans cl on cl.reservation_id = l.id and cl.status <> 'cancelled'
left join cleaners cr on cr.id = cl.cleaner_id
where l.status in ('confirmed', 'checked_in');

create view v_double_bookings as
select a.home, a.code as first, b.code as second, greatest(a.arrive_on, b.arrive_on) as from_on, least(a.depart_on, b.depart_on) as to_on
from v_live a join v_live b on a.home_id = b.home_id and a.id < b.id and a.arrive_on < b.depart_on and b.arrive_on < a.depart_on
where a.status <> 'checked_out' or b.status <> 'checked_out'
union all
select l.home, l.code, 'owner block (' || k.kind || ')', greatest(l.arrive_on, k.starts_on), least(l.depart_on, k.ends_on)
from v_live l join blocks k on k.home_id = l.home_id and l.arrive_on < k.ends_on and k.starts_on < l.depart_on
where l.status <> 'checked_out';

-- Owner money for the month each stay ends in. Statements close on departure date.
create view v_owner_month as
select owner_id, owner, date_trunc('month', depart_on)::date as month,
  count(*) as stays, sum(nights) as nights, sum(rent_cents)::bigint as rent_cents, sum(commission_cents)::bigint as commission_cents,
  sum(fee_cents)::bigint as fee_cents, sum(fee_gst_cents)::bigint as fee_gst_cents, sum(owner_cents)::bigint as owner_cents
from v_live where status = 'checked_out' or depart_on <= stay_today()
group by owner_id, owner, date_trunc('month', depart_on);

-- Per home over the last twelve months: what it earns the owner, what it earns you.
create view v_home_performance as
select h.id as home_id, h.name as home, o.name as owner, h.area,
  count(n.night_on) as nights_let,
  round(100.0 * count(n.night_on) / 365, 1) as occupancy_pct,
  coalesce((select sum(l.rent_cents) from v_live l where l.home_id = h.id and l.depart_on > stay_today() - 365 and l.depart_on <= stay_today()), 0)::bigint as rent_cents,
  coalesce((select sum(l.owner_cents) from v_live l where l.home_id = h.id and l.depart_on > stay_today() - 365 and l.depart_on <= stay_today()), 0)::bigint as owner_cents,
  coalesce((select sum(l.fee_cents + l.cleaning_fee_cents) from v_live l where l.home_id = h.id and l.depart_on > stay_today() - 365 and l.depart_on <= stay_today()), 0)::bigint
    - coalesce((select sum(cl.cost_cents) from cleans cl where cl.home_id = h.id and cl.status = 'done' and cl.done_on > stay_today() - 365), 0)::bigint as margin_cents,
  coalesce((select sum(e.amount_cents) from expenses e where e.home_id = h.id and e.incurred_on > stay_today() - 365), 0)::bigint as expenses_cents,
  (select round(avg(rv.rating), 2) from reviews rv join reservations r on r.id = rv.reservation_id where r.home_id = h.id and rv.received_on > stay_today() - 365) as avg_rating
from homes h join owners o on o.id = h.owner_id
left join v_nights n on n.home_id = h.id and n.night_on >= stay_today() - 365 and n.night_on < stay_today()
where h.active
group by h.id, h.name, o.name, h.area;

-- Everything that needs a decision, one row per item.
create view v_attention as
select 'clean not booked' as reason, t.home, t.code as ref,
  'departs ' || t.depart_on || ', next arrival ' || coalesce(t.next_arrive_on::text, 'none') || ' (' || t.turnaround || ')' as detail, 1 as severity
from v_turnovers t where t.clean_id is null and t.depart_on <= stay_today() + 3
union all
select 'clean has no cleaner', t.home, t.code, 'departs ' || t.depart_on || ' (' || t.turnaround || ')', 1
from v_turnovers t where t.clean_id is not null and t.cleaner is null and t.clean_status = 'scheduled' and t.depart_on <= stay_today() + 3
union all
select 'clean overdue', h.name, coalesce(r.code, 'extra clean'), 'due ' || c.due_on || ', ' || (stay_today() - c.due_on) || ' days ago' || coalesce(', ' || cr.name, ''), 1
from cleans c join homes h on h.id = c.home_id left join reservations r on r.id = c.reservation_id left join cleaners cr on cr.id = c.cleaner_id
where c.status = 'scheduled' and c.due_on < stay_today()
union all
select 'clean reported an issue', h.name, coalesce(r.code, 'extra clean'), coalesce(c.notes, 'see the clean record'), 1
from cleans c join homes h on h.id = c.home_id left join reservations r on r.id = c.reservation_id
where c.status = 'issue'
union all
select 'double booked', d.home, d.first || ' / ' || d.second, d.from_on || ' to ' || d.to_on, 0
from v_double_bookings d
union all
select 'still checked in', l.home, l.code, l.guest || ' was due out ' || l.depart_on, 1
from v_live l where l.status = 'checked_in' and l.depart_on < stay_today()
union all
select 'not checked out', l.home, l.code, l.guest || ' departed ' || l.depart_on || ', mark it checked out', 2
from v_live l where l.status = 'confirmed' and l.depart_on < stay_today()
union all
select 'balance owing before arrival', l.home, l.code, l.guest || ' arrives ' || l.arrive_on || ', owes ' || round(l.balance_cents / 100.0, 2), 1
from v_live l where l.status = 'confirmed' and l.balance_cents > 0 and l.channel_kind = 'direct' and l.arrive_on <= stay_today() + 14
union all
select 'enquiry going cold', v.home, v.code, v.guest || ', asked ' || v.booked_on || ' for ' || v.arrive_on, 2
from v_stays v where v.status = 'enquiry' and v.booked_on < stay_today() - 2 and v.arrive_on >= stay_today()
union all
select 'issue open', h.name, left(i.title, 40), i.priority || ', ' || i.status || ', open ' || (stay_today() - i.reported_on) || ' days', case when i.priority = 'urgent' then 0 else 2 end
from issues i join homes h on h.id = i.home_id
where i.status <> 'done' and (i.priority = 'urgent' or i.reported_on < stay_today() - 14)
union all
select 'owner statement not issued', m.owner, to_char(m.month, 'YYYY-MM'), m.stays || ' stays, owner share ' || round(m.owner_cents / 100.0, 2), 1
from v_owner_month m cross join settings s
where m.month < date_trunc('month', stay_today())::date
  and (date_trunc('month', stay_today())::date + s.statement_due_days) <= stay_today()
  and m.month >= (date_trunc('month', stay_today()) - interval '3 months')::date
  and not exists (select 1 from statements st where st.owner_id = m.owner_id and st.period_start = m.month and st.status in ('issued', 'paid'))
union all
select 'owner not paid', o.name, to_char(st.period_start, 'YYYY-MM'), 'statement issued ' || st.issued_on || ', payout ' || round(st.payout_cents / 100.0, 2), 1
from statements st join owners o on o.id = st.owner_id
where st.status = 'issued' and st.issued_on < stay_today() - 5
union all
select 'registration expiring', h.name, coalesce(h.registration_no, 'no number'), 'expires ' || h.registration_expires_on, case when h.registration_expires_on < stay_today() then 0 else 1 end
from homes h where h.active and h.registration_expires_on is not null and h.registration_expires_on <= stay_today() + 30
union all
select 'night cap close', c.home, c.rules, c.nights_total || ' of ' || c.night_cap || ' nights used or booked this year', case when c.nights_total > c.night_cap then 0 else 1 end
from v_night_cap c where c.approval_ref is null and c.nights_total >= c.night_cap * 0.85
union all
select 'empty calendar', h.name, '', 'nothing booked in the next 30 days', 2
from homes h where h.active and not exists (select 1 from v_live l where l.home_id = h.id and l.status <> 'checked_out' and l.arrive_on < stay_today() + 30 and l.depart_on > stay_today())
  and not exists (select 1 from blocks k where k.home_id = h.id and k.starts_on < stay_today() + 30 and k.ends_on > stay_today());

-- The rules each home lives under, checked against the records. Sources: docs/compliance.md.
create view v_compliance as
select 'STRA-REGISTRATION' as rule, h.name as home,
  case when h.registration_no is null then 'breached' when h.registration_expires_on < stay_today() then 'breached' when h.registration_expires_on <= stay_today() + 30 then 'due' else 'clean' end as state,
  case when h.registration_no is null then 'no registration number recorded'
       when h.registration_expires_on is null then h.registration_no || ', no expiry recorded'
       else h.registration_no || ', expires ' || h.registration_expires_on end as detail
from homes h where h.active and h.rules in ('nsw-cap', 'nsw', 'byron-cap', 'wa-perth', 'wa-regional')
union all
select case c.rules when 'nsw-cap' then 'NSW-180-NIGHTS' when 'byron-cap' then 'BYRON-60-NIGHTS' when 'wa-perth' then 'WA-PERTH-90-NIGHTS' when 'qldc' then 'QLDC-NIGHTS' else 'NIGHT-CAP' end,
  c.home,
  case when c.approval_ref is not null then 'clean' when c.nights_total > c.night_cap then 'breached' when c.nights_total >= c.night_cap * 0.85 then 'due' else 'clean' end,
  c.nights_used || ' let, ' || c.nights_booked_ahead || ' booked ahead, cap ' || c.night_cap || ' (year from ' || c.year_start || ')' || coalesce(', approval ' || c.approval_ref, '')
from v_night_cap c
union all
select 'QLDC-REGISTERED', h.name, case when h.registration_no is null then 'breached' else 'clean' end,
  coalesce('council registration ' || h.registration_no, 'no council registration recorded')
from homes h where h.active and h.rules = 'qldc'
union all
select 'VIC-SHORT-STAY-LEVY', l.home,
  case when l.levy_cents is null and l.depart_on <= stay_today() then 'breached' when l.levy_cents is null then 'due' else 'clean' end,
  l.code || ', ' || l.nights || ' nights ending ' || l.depart_on || ', levy ' || coalesce(round(l.levy_cents / 100.0, 2)::text, 'not recorded') || ' on ' || round(l.total_cents / 100.0, 2)
from v_live l cross join settings s
where l.rules = 'vic' and not l.collects_levy and l.nights < 28 and l.depart_on >= date '2025-01-01'
union all
select 'DOUBLE-BOOKING', d.home, 'breached', d.first || ' and ' || d.second || ', ' || d.from_on || ' to ' || d.to_on
from v_double_bookings d
union all
select 'CARD-DATA', 'guest record', 'breached', 'the guest note for ' || g.name || ' holds something shaped like a card number'
from guests g where coalesce(g.notes, '') ~ '([0-9][ -]?){13,19}'
union all
select 'CARD-DATA', h.name, 'breached', 'the note on ' || r.code || ' holds something shaped like a card number'
from reservations r join homes h on h.id = r.home_id where coalesce(r.notes, '') ~ '([0-9][ -]?){13,19}'
union all
select 'PRIVACY-RETENTION', 'guest record', 'due', g.name || ', last stay ended ' || max(r.depart_on)
from guests g join reservations r on r.guest_id = g.id cross join settings s
group by g.id, g.name, s.privacy_review_years
having max(r.depart_on) < stay_today() - (s.privacy_review_years * 365);
