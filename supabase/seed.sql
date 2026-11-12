-- Demo data: an Australian holiday letting business managing eight homes for five owners
-- in Sydney, Byron, the Blue Mountains, the Mornington Peninsula, the Surf Coast, Perth and Margaret River.
-- Every date is relative to stay_today(), so the demo always has arrivals, departures, overdue cleans,
-- a statement not issued, a home near its night cap and one over it.
-- Idempotent: a second run does nothing.
do $$
declare
  t date;
  seq int := 0;
  g_names text[] := array['Olivia Martin','Jack Thompson','Charlotte Nguyen','Liam O''Brien','Amelia Wilson','Noah Patel','Isla Robertson','Oliver Chen',
    'Mia Kowalski','William Taylor','Ava Singh','Henry Walsh','Grace Murphy','Lucas Rossi','Chloe Anderson','Ethan Park','Sophie Turner','James Fraser',
    'Ruby Hughes','Leo Fernandes','Zoe Mitchell','Thomas Byrne','Ella Cooper','Samuel Lee','Harper Scott','Archie Bell','Lily Jensen','Max Kaur',
    'Evie Campbell','Hugo Laurent','Matilda Shaw','Oscar Ward','Freya Doyle','Jacob Kim','Isabella Grant','Charlie Evans','Sienna Morris','Felix Young',
    'Poppy Clarke','Hamish Reid'];
  gids uuid[] := '{}';
  g_first text[] := array['Olivia','Jack','Charlotte','Liam','Amelia','Noah','Isla','Oliver','Mia','William','Ava','Henry','Grace','Lucas','Chloe','Ethan','Sophie','James','Ruby','Leo',
    'Zoe','Thomas','Ella','Samuel','Harper','Archie','Lily','Max','Evie','Hugo','Matilda','Oscar','Freya','Jacob','Isabella','Charlie','Sienna','Felix','Poppy','Hamish'];
  g_last text[] := array['Martin','Thompson','Nguyen','O''Brien','Wilson','Patel','Robertson','Chen','Kowalski','Taylor','Singh','Walsh','Murphy','Rossi','Anderson','Park','Turner','Fraser',
    'Hughes','Fernandes','Mitchell','Byrne','Cooper','Lee','Scott','Bell','Jensen','Kaur','Campbell','Laurent','Shaw','Ward','Doyle','Kim','Grant','Evans','Morris','Young','Clarke','Reid'];
  vh record;
  ch_airbnb uuid; ch_booking uuid; ch_stayz uuid; ch_direct uuid; ch_owner uuid;
  cl_sparkle uuid; cl_coastal uuid; cl_bay uuid; cl_west uuid;
  o_priya uuid; o_daniel uuid; o_helen uuid; o_ellis uuid; o_cath uuid;
  cur date; stop date; len int; gap int; i int; rid uuid; ch uuid; ckind text; rent bigint; st text; gid uuid;
  prev_cleaner text; clean_by uuid; clean_name text; cleanl numeric; m date; vr record;
  hid uuid;
begin
  if exists (select 1 from owners where name = 'Priya Raman') then return; end if;
  t := stay_today();

  update settings set business_name = 'Coast and Range Stays', currency = 'AUD', country = 'AU', default_fee_pct = 20, fee_gst_pct = 10 where id = 1;

  insert into channels (name, kind, commission_pct, collects_levy) values ('Airbnb', 'ota', 15.5, true) returning id into ch_airbnb;
  insert into channels (name, kind, commission_pct, collects_levy) values ('Booking.com', 'ota', 15, true) returning id into ch_booking;
  insert into channels (name, kind, commission_pct, collects_levy) values ('Stayz', 'ota', 8, true) returning id into ch_stayz;
  insert into channels (name, kind, commission_pct, collects_levy) values ('Direct', 'direct', 0, false) returning id into ch_direct;
  insert into channels (name, kind, commission_pct, collects_levy) values ('Owner', 'owner', 0, false) returning id into ch_owner;

  insert into cleaners (name, phone, email, areas) values ('Sparkle Turnovers', '0412 555 201', 'jobs@sparkleturnovers.example', 'Bondi, Manly') returning id into cl_sparkle;
  insert into cleaners (name, phone, email, areas) values ('Coastal Linen Co', '0412 555 318', 'book@coastallinen.example', 'Byron, Blue Mountains') returning id into cl_coastal;
  insert into cleaners (name, phone, email, areas) values ('Bay Cleaners', '0412 555 442', 'hello@baycleaners.example', 'Sorrento, Lorne') returning id into cl_bay;
  insert into cleaners (name, phone, email, areas) values ('West Coast Cleaning', '0412 555 590', 'team@westcoastclean.example', 'Cottesloe, Margaret River') returning id into cl_west;

  insert into owners (name, email, phone, payout_account, gst_registered) values ('Priya Raman', 'priya.raman@example.com', '0400 111 201', '...4821', false) returning id into o_priya;
  insert into owners (name, email, phone, payout_account, gst_registered) values ('Daniel Cho', 'daniel.cho@example.com', '0400 111 302', '...0937', true) returning id into o_daniel;
  insert into owners (name, email, phone, payout_account, gst_registered) values ('Helen Brooks', 'helen.brooks@example.com', '0400 111 403', '...5560', false) returning id into o_helen;
  insert into owners (name, email, phone, payout_account, gst_registered, notes) values ('Mark and Jo Ellis', 'ellis.family@example.com', '0400 111 504', '...7712', false, 'Approve any repair over $300 before booking it.') returning id into o_ellis;
  insert into owners (name, email, phone, payout_account, gst_registered) values ('Catherine Doyle', 'cath.doyle@example.com', '0400 111 605', '...3304', false) returning id into o_cath;

  insert into homes (name, owner_id, address, area, rules, night_cap, cap_year_starts_on, registration_no, registration_expires_on, bedrooms, max_guests, fee_pct, guest_cleaning_fee_cents, clean_cost_cents, access_notes)
  values
   ('Bondi Terrace', o_priya, '14 Hastings Parade, North Bondi NSW', 'Sydney', 'nsw-cap', 180, t - 300, 'PID-STRA-48213', t + 400, 3, 6, 20, 18000, 14000, 'Keysafe at the side gate, code in the guest guide'),
   ('Manly Harbour Apartment', o_priya, '7/22 East Esplanade, Manly NSW', 'Sydney', 'nsw-cap', 180, t - 120, null, null, 2, 4, 20, 15000, 11000, 'Building concierge holds the fob'),
   ('Byron Hinterland Cabin', o_daniel, '310 Coopers Shoot Road, Coopers Shoot NSW', 'Byron', 'byron-cap', 60, t - 90, 'PID-STRA-51007', t + 300, 1, 2, 22, 12000, 9000, 'Smart lock, code sent on the day'),
   ('Blue Mountains Retreat', o_daniel, '9 Lake Street, Wentworth Falls NSW', 'Blue Mountains', 'nsw', null, null, 'PID-STRA-39950', t + 12, 4, 8, 20, 22000, 16000, 'Lockbox at the front door'),
   ('Sorrento Beach Cottage', o_helen, '41 Ocean Beach Road, Sorrento VIC', 'Mornington Peninsula', 'vic', null, null, null, null, 3, 6, 18, 17000, 13000, 'Key with the neighbour at number 43'),
   ('Lorne Clifftop House', o_helen, '5 Cumberland Rise, Lorne VIC', 'Surf Coast', 'vic', null, null, null, null, 4, 8, 18, 22000, 17000, 'Smart lock, code sent on the day'),
   ('Cottesloe Apartment', o_ellis, '2/88 Marine Parade, Cottesloe WA', 'Perth', 'wa-perth', 90, t - 185, 'STRA6011KQ2P', t + 160, 2, 4, 20, 14000, 10000, 'Lockbox in the car park'),
   ('Margaret River Vineyard Cottage', o_cath, '1180 Caves Road, Wilyabrup WA', 'Margaret River', 'wa-regional', null, null, 'STRA6285MR7T', t + 220, 2, 4, 20, 15000, 11000, 'Key under the barrel at the door');

  foreach st in array g_names loop
    insert into guests (name, email, phone, country) values (st, lower(replace(replace(st, ' ', '.'), '''', '')) || '@example.com', '04' || lpad((10000000 + array_length(gids, 1) * 7919)::text, 8, '0'), 'Australia') returning id into gid;
    gids := gids || gid;
  end loop;
  update guests set notes = 'Paid the bond by card 4111 1111 1111 1111 over the phone' where name = 'Hugo Laurent';
  update guests set country = 'New Zealand' where name in ('Hamish Reid', 'Isla Robertson', 'James Fraser');

  -- A year of stays for every home, generated, then a hand-written fortnight around today.
  for vh in select hm.id, hm.name, hm.clean_cost_cents, hm.guest_cleaning_fee_cents,
      case hm.name when 'Bondi Terrace' then 42000 when 'Manly Harbour Apartment' then 33000 when 'Byron Hinterland Cabin' then 29000 when 'Blue Mountains Retreat' then 39000
        when 'Sorrento Beach Cottage' then 36000 when 'Lorne Clifftop House' then 48000 when 'Cottesloe Apartment' then 27000 else 31000 end as nightly,
      case hm.name when 'Bondi Terrace' then 9 when 'Manly Harbour Apartment' then 6 when 'Byron Hinterland Cabin' then 10 when 'Blue Mountains Retreat' then 5
        when 'Sorrento Beach Cottage' then 5 when 'Lorne Clifftop House' then 6 when 'Cottesloe Apartment' then 20 else 7 end as gapmod,
      case hm.name when 'Bondi Terrace' then cl_sparkle when 'Manly Harbour Apartment' then cl_sparkle when 'Byron Hinterland Cabin' then cl_coastal when 'Blue Mountains Retreat' then cl_coastal
        when 'Sorrento Beach Cottage' then cl_bay when 'Lorne Clifftop House' then cl_bay else cl_west end as cleaner
    from homes hm order by hm.name
  loop
    for pass in 1..2 loop
      if pass = 1 then cur := t - 365; stop := t - 20;
      else cur := case vh.name when 'Margaret River Vineyard Cottage' then t + 35 when 'Lorne Clifftop House' then t + 37 when 'Blue Mountains Retreat' then t + 25 when 'Sorrento Beach Cottage' then t + 48 else t + 16 end; stop := t + 90; end if;
      i := 0; prev_cleaner := null;
      while cur + 2 <= stop loop
        i := i + 1; seq := seq + 1;
        len := 2 + ((i * 7 + seq) % 5);
        if vh.name = 'Bondi Terrace' and pass = 1 and i = 20 then len := 24; end if;  -- a long booking: NSW leaves 21+ nights out of the cap
        if cur + len > stop then len := stop - cur; end if;
        exit when len < 2;
        if vh.name = 'Sorrento Beach Cottage' then ch := case when i % 10 < 4 then ch_airbnb else ch_direct end;
        else ch := case when i % 10 < 5 then ch_airbnb when i % 10 < 8 then ch_booking when i % 10 < 9 then ch_stayz else ch_direct end; end if;
        select kind into ckind from channels where id = ch;
        rent := vh.nightly * len * (case when extract(month from cur) in (12, 1, 2) then 125 when extract(month from cur) in (6, 7, 8) then 85 else 100 end) / 100;
        st := case when cur + len <= t then 'checked_out' when cur <= t then 'checked_in' else 'confirmed' end;
        -- One stay in nine is a returning guest; the rest are new.
        if seq % 9 = 0 then gid := gids[1 + (seq / 9) % 8];
        else
          insert into guests (name, email, phone, country)
          values (g_first[1 + seq % 40] || ' ' || g_last[1 + (seq * 7 + seq / 40) % 40], lower(g_first[1 + seq % 40] || '.' || replace(g_last[1 + (seq * 7 + seq / 40) % 40], '''', '')) || seq || '@example.com',
            '04' || lpad((20000000 + seq * 7919)::text, 8, '0'), case when seq % 11 = 0 then 'New Zealand' else 'Australia' end)
          returning id into gid;
        end if;
        insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref, levy_cents)
        values ('CR-' || lpad(seq::text, 5, '0'), vh.id, gid, ch, st, cur, cur + len, 2 + (seq % 3), rent, vh.guest_cleaning_fee_cents, cur - (10 + (seq * 11) % 80), 'GY-' || (480000 + seq * 37),
          case when vh.name in ('Sorrento Beach Cottage', 'Lorne Clifftop House') and ckind = 'direct' then round((rent + vh.guest_cleaning_fee_cents) * 0.075) end)
        returning id into rid;
        if st = 'checked_out' then
          insert into payments (reservation_id, amount_cents, received_on, method, reference)
          values (rid, rent + vh.guest_cleaning_fee_cents, case when ckind = 'direct' then cur - 7 else cur + 1 end, case when ckind = 'direct' then 'bank transfer' else 'channel payout' end, 'PAY-' || seq);
          insert into cleans (home_id, reservation_id, due_on, cleaner_id, status, done_on, cost_cents)
          values (vh.id, rid, cur + len, vh.cleaner, 'done', cur + len, vh.clean_cost_cents);
          -- Guests review two stays in three. Cleanliness follows whoever cleaned before they arrived.
          if seq % 3 <> 0 then
            cleanl := case when prev_cleaner = 'Coastal Linen Co' then 3.5 + (seq % 3) * 0.5 when prev_cleaner is null then 4.5 else 4.5 + (seq % 2) * 0.5 end;
            insert into reviews (reservation_id, rating, cleanliness, comment, received_on)
            values (rid, least(5, cleanl + 0.5 * (seq % 2)), cleanl,
              case when cleanl < 4.5 then 'Lovely spot but the place was not properly cleaned when we arrived.' else 'Spotless and exactly as pictured.' end, cur + len + 2);
          end if;
          select name into prev_cleaner from cleaners where id = vh.cleaner;
        elsif ckind = 'direct' then
          insert into payments (reservation_id, amount_cents, received_on, method, reference) values (rid, rent + vh.guest_cleaning_fee_cents, cur - 30, 'bank transfer', 'PAY-' || seq);
        end if;
        gap := (i * 3 + seq) % vh.gapmod;
        cur := cur + len + gap;
      end loop;
    end loop;
  end loop;

  -- The fortnight around today, written by hand so every attention reason has something to show.
  select id into hid from homes where name = 'Bondi Terrace';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref) values
   ('CR-90001', hid, gids[3], ch_airbnb, 'checked_out', t - 18, t - 12, 4, 252000, 18000, t - 60, 'GY-90001'),
   ('CR-90002', hid, gids[7], ch_booking, 'checked_out', t - 10, t - 6, 2, 168000, 18000, t - 41, 'GY-90002'),
   ('CR-90003', hid, gids[12], ch_airbnb, 'checked_in', t - 3, t + 1, 5, 168000, 18000, t - 33, 'GY-90003'),
   ('CR-90004', hid, gids[18], ch_direct, 'confirmed', t + 1, t + 5, 3, 168000, 18000, t - 20, null),
   ('CR-90005', hid, gids[25], ch_airbnb, 'confirmed', t + 8, t + 12, 2, 168000, 18000, t - 9, 'GY-90005');
  select id into hid from homes where name = 'Manly Harbour Apartment';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref) values
   ('CR-90011', hid, gids[5], ch_airbnb, 'confirmed', t - 9, t - 1, 2, 264000, 15000, t - 70, 'GY-90011'),
   ('CR-90012', hid, gids[30], ch_booking, 'confirmed', t + 2, t + 6, 2, 132000, 15000, t - 15, 'GY-90012');
  select id into hid from homes where name = 'Byron Hinterland Cabin';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref) values
   ('CR-90021', hid, gids[9], ch_stayz, 'checked_out', t - 14, t - 10, 2, 116000, 12000, t - 50, 'GY-90021'),
   ('CR-90022', hid, gids[14], ch_booking, 'checked_in', t - 2, t + 2, 2, 116000, 12000, t - 28, 'GY-90022'),
   ('CR-90023', hid, gids[21], ch_airbnb, 'confirmed', t + 2, t + 7, 2, 145000, 12000, t - 12, 'GY-90023');
  select id into hid from homes where name = 'Blue Mountains Retreat';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref) values
   ('CR-90031', hid, gids[2], ch_airbnb, 'checked_out', t - 7, t - 4, 6, 117000, 22000, t - 40, 'GY-90031'),
   ('CR-90032', hid, gids[27], ch_airbnb, 'confirmed', t + 3, t + 5, 4, 78000, 22000, t - 6, 'GY-90032'),
   ('CR-90033', hid, gids[33], ch_direct, 'enquiry', t + 20, t + 23, 6, 117000, 22000, t - 5, null);
  select id into hid from homes where name = 'Sorrento Beach Cottage';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref, levy_cents) values
   ('CR-90041', hid, gids[11], ch_direct, 'checked_out', t - 16, t - 12, 5, 144000, 17000, t - 45, null, 12075),
   ('CR-90042', hid, gids[16], ch_direct, 'checked_out', t - 8, t - 5, 4, 108000, 17000, t - 30, null, null),
   ('CR-90043', hid, gids[23], ch_direct, 'confirmed', t + 6, t + 10, 6, 144000, 17000, t - 18, null, null),
   ('CR-90044', hid, gids[35], ch_airbnb, 'confirmed', t + 13, t + 16, 2, 108000, 17000, t - 4, 'GY-90044', null);
  select id into hid from homes where name = 'Lorne Clifftop House';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref) values
   ('CR-90051', hid, gids[8], ch_airbnb, 'checked_out', t - 12, t - 8, 7, 192000, 22000, t - 52, 'GY-90051'),
   ('CR-90052', hid, gids[31], ch_booking, 'confirmed', t + 28, t + 32, 8, 192000, 22000, t - 3, 'GY-90052');
  select id into hid from homes where name = 'Cottesloe Apartment';
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on, external_ref) values
   ('CR-90061', hid, gids[36], ch_airbnb, 'checked_out', t - 6, t - 3, 3, 81000, 14000, t - 35, 'GY-90061'),
   ('CR-90062', hid, gids[19], ch_booking, 'confirmed', t + 1, t + 4, 2, 81000, 14000, t - 22, 'GY-90062');

  -- Money and cleans for the hand-written stays.
  insert into payments (reservation_id, amount_cents, received_on, method, reference)
  select r.id, r.rent_cents + r.cleaning_fee_cents, case when c.kind = 'direct' then r.arrive_on - 14 else r.arrive_on + 1 end,
    case when c.kind = 'direct' then 'bank transfer' else 'channel payout' end, 'PAY-' || r.code
  from reservations r join channels c on c.id = r.channel_id
  where r.code like 'CR-9%' and (r.status = 'checked_out' or r.code in ('CR-90011', 'CR-90003', 'CR-90022', 'CR-90004'));
  insert into payments (reservation_id, amount_cents, received_on, method, reference)
  select id, round((rent_cents + cleaning_fee_cents) * 0.3), booked_on + 1, 'bank transfer', 'DEP-' || code from reservations where code = 'CR-90043';

  insert into cleans (home_id, reservation_id, due_on, cleaner_id, status, done_on, cost_cents, notes)
  select r.home_id, r.id, r.depart_on,
    case h.name when 'Bondi Terrace' then cl_sparkle when 'Manly Harbour Apartment' then cl_sparkle when 'Byron Hinterland Cabin' then cl_coastal when 'Blue Mountains Retreat' then cl_coastal
      when 'Sorrento Beach Cottage' then cl_bay when 'Lorne Clifftop House' then cl_bay else cl_west end,
    case when r.code = 'CR-90061' then 'issue' when r.status = 'checked_out' then 'done' else 'scheduled' end,
    case when r.status = 'checked_out' then r.depart_on end, h.clean_cost_cents,
    case when r.code = 'CR-90061' then 'Red wine on the lounge cover and a cracked shower screen. Photos sent to the owner.' end
  from reservations r join homes h on h.id = r.home_id
  where r.code like 'CR-9%' and r.status <> 'enquiry' and r.code not in ('CR-90003', 'CR-90052');
  -- The Byron clean has been booked but nobody is on it yet.
  update cleans set cleaner_id = null where reservation_id = (select id from reservations where code = 'CR-90022');

  -- Owner stays and holds. The Lorne owner block clashes with a Booking.com reservation.
  insert into blocks (home_id, starts_on, ends_on, kind, note)
  select id, t + 40, t + 47, 'owner_stay', 'Helen and family, summer week' from homes where name = 'Sorrento Beach Cottage';
  insert into blocks (home_id, starts_on, ends_on, kind, note)
  select id, t + 30, t + 34, 'owner_stay', 'Helen added this by text on the weekend' from homes where name = 'Lorne Clifftop House';
  insert into blocks (home_id, starts_on, ends_on, kind, note)
  select id, t + 50, t + 53, 'maintenance', 'Deck re-oil' from homes where name = 'Cottesloe Apartment';

  -- Repairs and running costs.
  insert into issues (home_id, reported_on, title, priority, status, quote_cents, notes)
  select id, t - 2, 'Hot water system leaking at the relief valve', 'urgent', 'waiting_owner', 68000, 'Plumber quoted $680, waiting on Helen' from homes where name = 'Lorne Clifftop House';
  insert into issues (home_id, reported_on, title, priority, status, notes)
  select id, t - 20, 'Balcony door lock sticks', 'normal', 'open', 'Two guests mentioned it' from homes where name = 'Bondi Terrace';
  insert into issues (home_id, reported_on, title, priority, status, quote_cents, resolved_on)
  select id, t - 40, 'Replace BBQ gas bottle', 'low', 'done', 4500, t - 38 from homes where name = 'Cottesloe Apartment';

  insert into expenses (home_id, incurred_on, description, category, amount_cents)
  select h.id, d::date, x.description, x.category, x.amount
  from homes h
  cross join generate_series(t - 330, t - 1, interval '60 days') d
  cross join (values ('Guest supplies restock', 'supplies', 8500), ('Linen replacement', 'linen', 12000)) as x(description, category, amount);
  insert into expenses (home_id, incurred_on, description, category, amount_cents, issue_id)
  select i.home_id, i.resolved_on, 'BBQ gas bottle swap', 'repairs', 4500, i.id from issues i where i.title = 'Replace BBQ gas bottle';
  insert into expenses (home_id, incurred_on, description, category, amount_cents)
  select id, t - 75, 'Gardener, spring tidy', 'gardening', 26000 from homes where name in ('Blue Mountains Retreat', 'Lorne Clifftop House');

  -- Owner statements: every month to two months ago issued and paid. Last month issued for some owners only.
  for m in select generate_series(date_trunc('month', t - 365)::date, (date_trunc('month', t) - interval '2 months')::date, interval '1 month')::date loop
    for vr in select * from v_owner_month where month = m loop
      insert into statements (owner_id, period_start, period_end, status, stays, rent_cents, commission_cents, fee_cents, fee_gst_cents, expenses_cents, payout_cents, issued_on, paid_on)
      values (vr.owner_id, m, (m + interval '1 month')::date - 1, 'paid', vr.stays, vr.rent_cents, vr.commission_cents, vr.fee_cents, vr.fee_gst_cents, 0, vr.owner_cents, (m + interval '1 month')::date + 4, (m + interval '1 month')::date + 6)
      returning id into rid;
      update expenses e set statement_id = rid from homes hh where hh.id = e.home_id and hh.owner_id = vr.owner_id and e.incurred_on >= m and e.incurred_on < (m + interval '1 month')::date;
      update statements s set expenses_cents = coalesce((select sum(amount_cents) from expenses where statement_id = rid), 0),
        payout_cents = vr.owner_cents - coalesce((select sum(amount_cents) from expenses where statement_id = rid), 0) where s.id = rid;
    end loop;
  end loop;
  m := (date_trunc('month', t) - interval '1 month')::date;
  for vr in select * from v_owner_month where month = m and owner in ('Priya Raman', 'Daniel Cho', 'Mark and Jo Ellis', 'Catherine Doyle') loop
    insert into statements (owner_id, period_start, period_end, status, stays, rent_cents, commission_cents, fee_cents, fee_gst_cents, expenses_cents, payout_cents, issued_on, paid_on)
    values (vr.owner_id, m, (m + interval '1 month')::date - 1, case when vr.owner = 'Mark and Jo Ellis' then 'issued' else 'paid' end, vr.stays, vr.rent_cents, vr.commission_cents, vr.fee_cents, vr.fee_gst_cents, 0, vr.owner_cents,
      least(t, (m + interval '1 month')::date + 2), case when vr.owner = 'Mark and Jo Ellis' then null else least(t, (m + interval '1 month')::date + 4) end)
    returning id into rid;
    update expenses e set statement_id = rid from homes hh where hh.id = e.home_id and hh.owner_id = vr.owner_id and e.incurred_on >= m and e.incurred_on < (m + interval '1 month')::date;
    update statements s set expenses_cents = coalesce((select sum(amount_cents) from expenses where statement_id = rid), 0),
      payout_cents = vr.owner_cents - coalesce((select sum(amount_cents) from expenses where statement_id = rid), 0) where s.id = rid;
  end loop;

  -- A guest from eight years ago, kept without a decision.
  select id into hid from homes where name = 'Blue Mountains Retreat';
  insert into guests (name, email, country) values ('Graham Pearce', 'graham.pearce@example.com', 'Australia') returning id into gid;
  insert into reservations (code, home_id, guest_id, channel_id, status, arrive_on, depart_on, guests_count, rent_cents, cleaning_fee_cents, booked_on)
  values ('CR-80001', hid, gid, ch_direct, 'checked_out', t - 2950, t - 2947, 4, 75000, 15000, t - 2990);

  insert into activity (subject_type, subject_id, kind, body, logged_on)
  select 'owner', o_helen, 'call', 'Helen asked whether we can raise the summer rate at Lorne. Said I would send the numbers.', t - 9;
  insert into activity (subject_type, subject_id, kind, body, logged_on)
  select 'owner', o_ellis, 'email', 'Mark asked when last month''s payout lands.', t - 2;
end $$;
