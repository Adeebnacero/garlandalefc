-- Garlandale FC — Referees migration
--
-- Adds everything needed for the new Referee role, referee appointments on
-- Fixtures, and the Admin "Referee Pay" log:
--   - new staff role: 'referee' (read-only on fixtures)
--   - Treasurer/Coach get read-only access to the staff table (needed for
--     the referee dropdown / Matchday display) — inviting/removing staff
--     stays Admin-only
--   - a fix so every role can always read their own staff row on login
--   - fixtures.referee_id + club_settings.default_referee_fee
--   - the referee_appointments table (the payment log), kept in sync with
--     fixtures.referee_id by a trigger
--   - referee_appointments folded into the existing backup/restore
--     functions
--
-- This file only contains what's NEW since the previous schema.sql — it's
-- safe to run on its own against a database that already has the rest of
-- schema.sql applied. Run it once in the Supabase SQL Editor (Project ->
-- SQL Editor -> New query). Everything here is idempotent (uses `if not
-- exists` / `create or replace` / `on conflict`), so it's also safe to
-- run more than once.
--
-- After running this, redeploy the invite-user Edge Function so it
-- accepts the new role server-side too:
--   supabase functions deploy invite-user

-- ---------- Referees (role + fixture appointments + payment log) ----------
-- New staff role: 'referee'. Same shape as every other staff account
-- (invited from Users, logs in with email/password like admin/treasurer/
-- coach) but deliberately the narrowest role in the app - read-only access
-- to the fixtures list and nothing else. Widening the check constraint
-- like this (drop + re-add, NOT VALID) is the same safe pattern already
-- used for notices.category above - existing rows are unaffected since
-- every existing staff row already has a role in the allowed list.
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check
  check (role in ('admin', 'treasurer', 'coach', 'referee')) not valid;

-- Staff table was previously select-able by Admin only (has_permission
-- only had a row for 'admin'). Treasurer and Coach now also get read-only
-- access - Treasurer needs it to populate the referee dropdown on
-- Fixtures, Coach needs it to see who's been appointed on Matchday. This
-- only exposes id/email/role/invited_at (nothing sensitive) and does NOT
-- change who can invite or remove staff - that stays Admin-only, both in
-- the Users tab (nav) and re-checked server-side in the invite-user Edge
-- Function.
insert into role_permissions (role, table_name, can_select, can_insert, can_update, can_delete) values
  ('treasurer', 'staff', true, false, false, false),
  ('coach',     'staff', true, false, false, false)
on conflict (role, table_name) do update set
  can_select = excluded.can_select,
  can_insert = excluded.can_insert,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete;

-- Belt-and-braces fix alongside the above: previously the ONLY policy on
-- staff was the blanket has_permission('staff','select') check, which
-- meant even a logged-in Treasurer/Coach/Referee couldn't read their OWN
-- row - the exact query loadRole() runs right after login - unless
-- role_permissions granted them 'staff' select. Adding self-read as an
-- explicit, additive OR condition means every role can always resolve
-- their own account after logging in, regardless of what role_permissions
-- says, without weakening anything (a user could always identify their
-- own role anyway).
-- staff: anyone can read their own row; roles with staff 'select' can read
-- the list; ONLY Admin/Chairman can create, change or remove staff.
-- (Replaced 2026-11: the old single FOR ALL policy let Treasurer/Coach
-- insert/update/delete staff rows, including promoting themselves to admin.
-- See migrations/2026-11-staff-write-admin-only.sql.)
drop policy if exists "staff_all" on staff;
drop policy if exists staff_read on staff;
create policy staff_read on staff for select
  using (has_permission('staff','select') or user_id = auth.uid());
drop policy if exists staff_write on staff;
create policy staff_write on staff for insert
  with check (current_staff_role() in ('admin','chairman'));
drop policy if exists staff_update on staff;
create policy staff_update on staff for update
  using (current_staff_role() in ('admin','chairman'))
  with check (current_staff_role() in ('admin','chairman'));
drop policy if exists staff_delete on staff;
create policy staff_delete on staff for delete
  using (current_staff_role() in ('admin','chairman'));

-- Referees can only ever read fixtures - no insert/update/delete, no
-- access to anything else in the app (finance, squad, messages, etc. all
-- stay unreachable since no role_permissions row means has_permission
-- returns false by default).
insert into role_permissions (role, table_name, can_select, can_insert, can_update, can_delete) values
  ('referee', 'fixtures', true, false, false, false)
on conflict (role, table_name) do update set
  can_select = excluded.can_select,
  can_insert = excluded.can_insert,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete;

-- Which referee is appointed to each fixture. Nullable - most fixtures
-- won't have one set until an Admin/Treasurer assigns it. Insert/update
-- rights on fixtures are already Admin/Treasurer-only (see fixtures_update
-- policy above), so assigning a referee is covered by the exact same
-- permission check as editing any other fixture field - no new policy
-- needed on fixtures itself.
alter table fixtures add column if not exists referee_id uuid references staff(id) on delete set null;
create index if not exists fixtures_referee_id_idx on fixtures(referee_id);

-- A default match fee, editable in Settings, used to pre-fill new
-- appointment rows below (still editable per-appointment afterwards).
alter table club_settings add column if not exists default_referee_fee numeric default 0;

-- ---------- referee_appointments (payment log) ----------
-- One row per fixture that's had a referee assigned. This is what the
-- Admin section's "Referee Pay" tab reads from to work out who's owed what
-- for the month - fee_amount starts from club_settings.default_referee_fee
-- but is editable per row (a derby or cup match might carry a different
-- fee), and `paid` is a simple toggle rather than a full ledger.
create table if not exists referee_appointments (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures(id) on delete cascade,
  referee_id uuid not null references staff(id) on delete cascade,
  fee_amount numeric not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (fixture_id)
);

create index if not exists referee_appointments_referee_id_idx on referee_appointments(referee_id);

-- Same treatment as finance_entries: Admin and Treasurer both get full
-- read/write, since this is what determines the month's referee payments
-- and Treasurer already owns the club's financial admin everywhere else
-- in the app (Finance, Subscriptions, Settings).
insert into role_permissions (role, table_name, can_select, can_insert, can_update, can_delete) values
  ('admin',     'referee_appointments', true, true, true, true),
  ('treasurer', 'referee_appointments', true, true, true, true)
on conflict (role, table_name) do update set
  can_select = excluded.can_select,
  can_insert = excluded.can_insert,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete;

alter table referee_appointments enable row level security;
drop policy if exists "referee_appointments_all" on referee_appointments;
create policy "referee_appointments_all" on referee_appointments for all
  using (has_permission('referee_appointments', 'select'))
  with check (has_permission('referee_appointments', 'select'));

-- Keeps the appointments log in sync with fixtures.referee_id, so the app
-- never has to remember to do this in two places:
--   - a referee assigned where none existed before -> insert a log row,
--     fee pre-filled from club_settings.default_referee_fee
--   - the referee on a fixture changed to someone else -> update the
--     existing row's referee_id (fee/paid history for that fixture is
--     preserved rather than duplicated)
--   - the referee removed from a fixture -> delete the log row (nothing
--     to pay for an appointment that no longer exists); the on delete
--     cascade above handles the fixture being deleted outright
create or replace function sync_referee_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_fee numeric;
begin
  if new.referee_id is null then
    delete from referee_appointments where fixture_id = new.id;
    return new;
  end if;

  if old is null or old.referee_id is distinct from new.referee_id then
    select coalesce(default_referee_fee, 0) into default_fee from club_settings where id = 1;
    insert into referee_appointments (fixture_id, referee_id, fee_amount)
      values (new.id, new.referee_id, coalesce(default_fee, 0))
    on conflict (fixture_id) do update set
      referee_id = excluded.referee_id,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists fixtures_sync_referee_appointment on fixtures;
create trigger fixtures_sync_referee_appointment
  after insert or update of referee_id on fixtures
  for each row execute function sync_referee_appointment();

-- ---------- nightly backup snapshot (matches production, 2026-11) ----------
-- Staff with Backups access (or the nightly job, which has no login) only.
-- NOTE: this covers tables created outside this file (guardian_players,
-- store_*, home_banners, supporters, supporter_settings); it needs those
-- tables to exist.
create or replace function create_backup_snapshot(p_kind text default 'scheduled')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is not null and not has_permission('backups', 'select') then
    raise exception 'Only staff with access to Backups can make a backup.' using errcode = '42501';
  end if;

  insert into backups (kind, snapshot)
  values (
    p_kind,
    jsonb_build_object(
      'players', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from players p),
      'payments', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from payments p),
      'tiers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from tiers t),
      'matches', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from matches m),
      'match_squad', (select coalesce(jsonb_agg(to_jsonb(ms)), '[]'::jsonb) from match_squad ms),
      'inventory_items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from inventory_items i),
      'issued_items', (select coalesce(jsonb_agg(to_jsonb(ii)), '[]'::jsonb) from issued_items ii),
      'player_status_log', (select coalesce(jsonb_agg(to_jsonb(sl)), '[]'::jsonb) from player_status_log sl),
      'club_settings', (select coalesce(jsonb_agg(to_jsonb(cs)), '[]'::jsonb) from club_settings cs),
      'division_labels', (select coalesce(jsonb_agg(to_jsonb(dl)), '[]'::jsonb) from division_labels dl),
      'club_assets', (select coalesce(jsonb_agg(to_jsonb(ca)), '[]'::jsonb) from club_assets ca),
      'finance_entries', (select coalesce(jsonb_agg(to_jsonb(fe)), '[]'::jsonb) from finance_entries fe),
      'reminder_batches', (select coalesce(jsonb_agg(to_jsonb(rb)), '[]'::jsonb) from reminder_batches rb),
      'audit_log', (select coalesce(jsonb_agg(to_jsonb(al)), '[]'::jsonb) from audit_log al),
      'league_table_sources', (select coalesce(jsonb_agg(to_jsonb(lts)), '[]'::jsonb) from league_table_sources lts),
      'league_standings', (select coalesce(jsonb_agg(to_jsonb(ls)), '[]'::jsonb) from league_standings ls),
      'fixtures', (select coalesce(jsonb_agg(to_jsonb(fx)), '[]'::jsonb) from fixtures fx),
      'referee_appointments', (select coalesce(jsonb_agg(to_jsonb(ra)), '[]'::jsonb) from referee_appointments ra),
      'notices', (select coalesce(jsonb_agg(to_jsonb(nt)), '[]'::jsonb) from notices nt),
      'guardian_players', (select coalesce(jsonb_agg(to_jsonb(gp)), '[]'::jsonb) from guardian_players gp),
      'store_products', (select coalesce(jsonb_agg(to_jsonb(sp)), '[]'::jsonb) from store_products sp),
      'store_product_sizes', (select coalesce(jsonb_agg(to_jsonb(sz)), '[]'::jsonb) from store_product_sizes sz),
      'store_settings', (select coalesce(jsonb_agg(to_jsonb(ss)), '[]'::jsonb) from store_settings ss),
      'store_orders', (select coalesce(jsonb_agg(to_jsonb(so)), '[]'::jsonb) from store_orders so),
      'store_order_items', (select coalesce(jsonb_agg(to_jsonb(soi)), '[]'::jsonb) from store_order_items soi),
      'store_order_events', (select coalesce(jsonb_agg(to_jsonb(soe)), '[]'::jsonb) from store_order_events soe),
      'store_order_counters', (select coalesce(jsonb_agg(to_jsonb(soc)), '[]'::jsonb) from store_order_counters soc),
      'home_banners', (select coalesce(jsonb_agg(to_jsonb(hb)), '[]'::jsonb) from home_banners hb),
      'supporters', (select coalesce(jsonb_agg(to_jsonb(su)), '[]'::jsonb) from supporters su),
      'supporter_settings', (select coalesce(jsonb_agg(to_jsonb(sse)), '[]'::jsonb) from supporter_settings sse)
    )
  )
  returning id into new_id;

  delete from backups where created_at < now() - interval '30 days';
  return new_id;
end;
$$;

-- ---------- restore from backup ----------
-- restore_from_snapshot() lives in migrations/2026-11-safe-restore.sql.
-- The old version that used to be here was REMOVED (2026-11): it deleted
-- and re-inserted players and notices, which cascaded away every guardian
-- link, notice read and private message, replaced the audit log, and
-- failed whenever a fixture had a referee. Don't bring it back.
