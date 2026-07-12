-- Garlandale FC club management schema (v2)
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- ---------- players ----------
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date,
  age_group_override text default '',
  phone text default '',
  email text default '',
  guardian_name text default '',
  guardian_phone text default '',
  join_date date,
  billing_start_date date,         -- when subscription billing actually starts accruing;
                                    -- NULL means "same as join_date" (the normal case for
                                    -- new registrations). Set this separately for
                                    -- long-standing members whose real join date predates
                                    -- this billing system, so they aren't retroactively
                                    -- billed for decades of "seasons" before it existed.
  monthly_fee numeric default 0,
  documents_complete boolean default false,
  notes text default '',
  reg_no text unique,              -- federation-issued player number, blank until registered, unique once issued
  squad_number int,                -- usual jersey number (editable per match)
  user_id uuid unique references auth.users(id) on delete set null,
                                    -- links this player row to their OWN auth account, if they've
                                    -- claimed an app invite (see invite-player Edge Function). NULL
                                    -- until claimed - a player row with no account is still just
                                    -- normal club data, exactly as before. Deliberately the opposite
                                    -- direction of the staff table (staff.user_id -> role): here,
                                    -- players.user_id -> a specific player row, one-to-one.
  created_at timestamptz default now()
);

-- ---------- payments ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  amount numeric not null,
  date date not null,
  method text default 'EFT',
  created_at timestamptz default now()
);

create index if not exists payments_player_id_idx on payments(player_id);

-- ---------- active/inactive status history ----------
alter table players add column if not exists active boolean default true;

create table if not exists player_status_log (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  status text not null, -- 'active' or 'inactive'
  changed_at timestamptz default now()
);

create index if not exists player_status_log_player_id_idx on player_status_log(player_id);

-- If you already ran the v1 schema and are only adding these columns:
alter table players add column if not exists reg_no text;
alter table players add column if not exists squad_number int;
alter table players add column if not exists billing_start_date date;
alter table players add column if not exists user_id uuid references auth.users(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_user_id_key') then
    alter table players add constraint players_user_id_key unique (user_id);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_reg_no_key') then
    alter table players add constraint players_reg_no_key unique (reg_no);
  end if;
end $$;

-- ---------- subscription tiers ----------
create table if not exists tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_fee numeric not null default 0,
  description text default '',
  created_at timestamptz default now()
);

alter table players add column if not exists tier_id uuid references tiers(id);
-- Note: players.monthly_fee is kept for backward compatibility but is no
-- longer used by the app — fees now come from the assigned tier via tier_id.

-- ---------- matches (fixtures) ----------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  league_name text default 'Cape Town Tygerberg LFA',
  home_team text default 'Garlandale FC',
  opponent text not null,
  home_away text default 'H',           -- 'H' or 'A'
  venue text default '',
  match_date date,
  kickoff_time time,
  division text default '',
  competition text default '',
  age_group text default '',
  corner_flags text default '',
  field_conditions text default '',
  field_marking text default '',
  first_aid_present text default '',
  referee_name text default '',
  assistant_ref_1 text default '',
  assistant_ref_2 text default '',
  half_time_score_home text default '',
  full_time_score_home text default '',
  half_time_score_away text default '',
  full_time_score_away text default '',
  coach_name text default '',
  coach_reg_no text default '',
  manager_name text default '',
  manager_reg_no text default '',
  captain_player_id uuid references players(id),
  physio_name text default '',
  physio_reg_no text default '',
  comments text default '',
  created_at timestamptz default now()
);

-- ---------- match squad selections ----------
create table if not exists match_squad (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  slot_no int not null,           -- 1-11 starting, 12-20 subs, matching the official sheet's NO column
  jersey_no text default '',
  role text default 'starting',  -- 'starting' or 'sub'
  created_at timestamptz default now(),
  unique (match_id, slot_no),
  unique (match_id, player_id)
);

-- ---------- kit inventory ----------
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,             -- e.g. "Home jersey", "Training bib"
  category text default '',       -- e.g. "Jersey", "Shorts", "Tracksuit"
  size text default '',
  quantity_on_hand int default 0,
  created_at timestamptz default now()
);

-- ---------- kit issued to players ----------
create table if not exists issued_items (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  size text default '',
  quantity int default 1,
  date_issued date default current_date,
  date_returned date,
  notes text default '',
  created_at timestamptz default now()
);

create index if not exists issued_items_player_id_idx on issued_items(player_id);
create index if not exists match_squad_match_id_idx on match_squad(match_id);

-- ---------- club assets (equipment/stock - balls, bibs, poles, flags, etc.) ----------
-- Distinct from inventory_items/issued_items above, which track kit issued
-- TO PLAYERS. This tracks general club-owned equipment and its value.
create table if not exists club_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- e.g. "Match balls (size 5)", "Lawnmower"
  category text default 'Other',         -- "Equipment", "Grounds", "Other"
  quantity int default 0,
  unit_value numeric default 0,
  low_stock_threshold int default 0,     -- flag as low stock when quantity <= this
  notes text default '',
  created_at timestamptz default now()
);

-- ---------- finance ledger (bank/cash log, donations, other income/expense) ----------
-- Subscription payments are NOT duplicated here - the app reads them live
-- from the existing payments table and merges them into this ledger's view,
-- so there's only ever one source of truth for a subscription payment.
-- This table is only for everything else: manual bank transactions,
-- donations, and other income/expenses, plus a one-off opening balance
-- entry (category 'Opening Balance') so the running total starts accurate.
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  description text not null,
  category text default 'Other income',
  type text not null check (type in ('income', 'expense')),
  amount numeric not null default 0,
  created_at timestamptz default now()
);

-- ---------- division label mappings (fixture spreadsheet import) ----------
-- The federation's fixture spreadsheet uses its own division naming (e.g.
-- "D4 - 6th Division") which doesn't match the club's own friendly team
-- names (e.g. "1st Team"). This table remembers that translation once it's
-- taught, so future imports apply it automatically instead of asking again.
create table if not exists division_labels (
  id uuid primary key default gen_random_uuid(),
  division_key text not null unique,  -- the raw division text as it appears in the spreadsheet
  team_label text not null,           -- the club's friendly name for that team
  created_at timestamptz default now()
);

-- ---------- club settings (singleton row) ----------
-- Holds non-sensitive configuration the app needs. The Gmail App Password
-- itself is NEVER stored here - it lives only as a Supabase Edge Function
-- secret, since this table is readable by anyone with the anon key.
create table if not exists club_settings (
  id int primary key default 1,
  sender_email text default '',
  sender_display_name text default 'Garlandale FC',
  reply_to_email text default '',
  bank_details text default '',
  invoice_footer_note text default '',
  updated_at timestamptz default now(),
  constraint club_settings_singleton check (id = 1)
);

insert into club_settings (id) values (1) on conflict (id) do nothing;

-- ---------- backups ----------
-- Automatic nightly snapshots (kept for 30 days) plus on-demand backups
-- triggered manually from the app. Each row is a full copy of every table
-- at that point in time, stored as JSON.
create extension if not exists "pg_cron";

create table if not exists backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  kind text default 'scheduled', -- 'scheduled' or 'manual'
  snapshot jsonb not null
);

create index if not exists backups_created_at_idx on backups(created_at desc);

create or replace function create_backup_snapshot(p_kind text default 'scheduled')
returns uuid
language plpgsql
security definer
as $$
declare
  new_id uuid;
begin
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
      'finance_entries', (select coalesce(jsonb_agg(to_jsonb(fe)), '[]'::jsonb) from finance_entries fe)
    )
  )
  returning id into new_id;

  -- prune anything older than 30 days so free-tier storage stays healthy
  delete from backups where created_at < now() - interval '30 days';

  return new_id;
end;
$$;

-- ---------- atomic restore (Phase 3 fix) ----------
-- Previously, restoring a backup ran as ~15 separate delete/insert calls
-- from the client, one table at a time. If any single call failed midway
-- (network blip, one bad row), the database was left in a partially
-- restored state with no way back - a real data-safety gap. Running this
-- as a single Postgres function fixes that: a PL/pgSQL function body is one
-- implicit transaction, so if anything inside fails, EVERYTHING in this
-- function rolls back automatically - either the whole restore succeeds or
-- none of it takes effect.
create or replace function restore_from_snapshot(snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- This function bypasses RLS (security definer), so the admin check has
  -- to happen explicitly here rather than relying on table policies.
  select role into caller_role from staff where user_id = auth.uid();
  if caller_role is distinct from 'admin' then
    raise exception 'Only an Admin can restore from a backup.';
  end if;

  -- Children first, then parents, respecting foreign keys.
  delete from issued_items;
  delete from match_squad;
  delete from payments;
  delete from player_status_log;
  delete from matches;
  delete from inventory_items;
  delete from players;
  delete from tiers;
  delete from division_labels;
  delete from club_assets;
  delete from finance_entries;

  -- Parents first, then children, on the way back in.
  insert into tiers
    select * from jsonb_populate_recordset(null::tiers, coalesce(snapshot->'tiers', '[]'::jsonb));
  insert into players
    select * from jsonb_populate_recordset(null::players, coalesce(snapshot->'players', '[]'::jsonb));
  insert into inventory_items
    select * from jsonb_populate_recordset(null::inventory_items, coalesce(snapshot->'inventory_items', '[]'::jsonb));
  insert into matches
    select * from jsonb_populate_recordset(null::matches, coalesce(snapshot->'matches', '[]'::jsonb));
  insert into payments
    select * from jsonb_populate_recordset(null::payments, coalesce(snapshot->'payments', '[]'::jsonb));
  insert into match_squad
    select * from jsonb_populate_recordset(null::match_squad, coalesce(snapshot->'match_squad', '[]'::jsonb));
  insert into issued_items
    select * from jsonb_populate_recordset(null::issued_items, coalesce(snapshot->'issued_items', '[]'::jsonb));
  insert into player_status_log
    select * from jsonb_populate_recordset(null::player_status_log, coalesce(snapshot->'player_status_log', '[]'::jsonb));
  insert into division_labels
    select * from jsonb_populate_recordset(null::division_labels, coalesce(snapshot->'division_labels', '[]'::jsonb));
  insert into club_assets
    select * from jsonb_populate_recordset(null::club_assets, coalesce(snapshot->'club_assets', '[]'::jsonb));
  insert into finance_entries
    select * from jsonb_populate_recordset(null::finance_entries, coalesce(snapshot->'finance_entries', '[]'::jsonb));

  if snapshot ? 'club_settings' and jsonb_array_length(coalesce(snapshot->'club_settings', '[]'::jsonb)) > 0 then
    insert into club_settings
      select * from jsonb_populate_recordset(null::club_settings, snapshot->'club_settings')
    on conflict (id) do update set
      sender_email = excluded.sender_email,
      sender_display_name = excluded.sender_display_name,
      reply_to_email = excluded.reply_to_email,
      bank_details = excluded.bank_details,
      invoice_footer_note = excluded.invoice_footer_note,
      updated_at = excluded.updated_at;
  end if;
end;
$$;

grant execute on function restore_from_snapshot(jsonb) to authenticated;

-- Schedule the nightly snapshot for 21:00 UTC = 23:00 (11pm) Cape Town time
-- (SAST is UTC+2 year-round, no daylight saving). Re-running this schema is
-- safe - it clears any existing job with this name before re-scheduling.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'garlandale-nightly-backup') then
    perform cron.unschedule('garlandale-nightly-backup');
  end if;
end $$;

select cron.schedule(
  'garlandale-nightly-backup',
  '0 21 * * *',
  $$select create_backup_snapshot('scheduled');$$
);

-- ---------- Staff accounts & roles ----------
-- Every logged-in user needs a row here to have any access at all. Roles:
--   admin     - full access to everything, including inviting/managing staff
--   treasurer - subscriptions/tiers/settings/messages; read-only on players;
--               no access to matches/kit
--   coach     - players/matchday/kit; read-only on financial tables (the
--               app's interface never surfaces $ figures to this role, even
--               though the database technically allows read access - see
--               README for why this trade-off was made)
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'treasurer', 'coach')),
  invited_at timestamptz default now()
);

create or replace function current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from staff where user_id = auth.uid() limit 1;
$$;

-- Mirrors current_staff_role() above, but for players: returns the player
-- row id linked to the currently logged-in account, or null if the caller
-- isn't a player (e.g. they're staff, or a player who hasn't claimed their
-- app invite yet). This is groundwork for the player-facing app's own RLS
-- policies (e.g. "a player may only see their own payments") - none of
-- those policies exist yet; this function just makes them possible to add
-- later without revisiting the players table again.
create or replace function current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from players where user_id = auth.uid() limit 1;
$$;

grant execute on function current_player_id() to authenticated;

-- ---------- Role permissions (Phase 4 refactor) ----------
-- Previously, every table's access rules were written inline across 22
-- separate CREATE POLICY statements (e.g. "current_staff_role() in ('admin',
-- 'coach')" repeated per table/action). Adding or changing a role meant
-- hunting down and editing every one of those statements individually, with
-- real risk of missing one. This table + one generic function replaces all
-- of that: permissions are now data (rows here), not scattered SQL.
--
-- The seed values below reproduce the EXACT same access rules the app had
-- before this refactor - this is a restructuring, not a behavior change.
create table if not exists role_permissions (
  role text not null,
  table_name text not null,
  can_select boolean not null default false,
  can_insert boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  primary key (role, table_name)
);

insert into role_permissions (role, table_name, can_select, can_insert, can_update, can_delete) values
  ('admin',     'players',           true,  true,  true,  true),
  ('treasurer', 'players',           true,  false, false, false),
  ('coach',     'players',           true,  true,  true,  true),

  ('admin',     'payments',          true,  true,  true,  true),
  ('treasurer', 'payments',          true,  true,  true,  true),
  ('coach',     'payments',          true,  false, false, false),

  ('admin',     'tiers',             true,  true,  true,  true),
  ('treasurer', 'tiers',             true,  true,  true,  true),
  ('coach',     'tiers',             true,  false, false, false),

  ('admin',     'club_settings',     true,  false, true,  false),
  ('treasurer', 'club_settings',     true,  false, true,  false),
  ('coach',     'club_settings',     true,  false, false, false),

  ('admin',     'division_labels',   true,  true,  true,  true),
  ('treasurer', 'division_labels',   true,  true,  true,  true),

  ('admin',     'matches',           true,  true,  true,  true),
  ('coach',     'matches',           true,  true,  true,  true),

  ('admin',     'match_squad',       true,  true,  true,  true),
  ('coach',     'match_squad',       true,  true,  true,  true),

  ('admin',     'inventory_items',   true,  true,  true,  true),
  ('coach',     'inventory_items',   true,  true,  true,  true),

  ('admin',     'club_assets',       true,  true,  true,  true),
  ('coach',     'club_assets',       true,  true,  true,  true),

  ('admin',     'finance_entries',   true,  true,  true,  true),
  ('treasurer', 'finance_entries',   true,  true,  true,  true),

  ('admin',     'issued_items',      true,  true,  true,  true),
  ('coach',     'issued_items',      true,  true,  true,  true),

  ('admin',     'player_status_log', true,  true,  false, false),
  ('treasurer', 'player_status_log', true,  false, false, false),
  ('coach',     'player_status_log', true,  true,  false, false),

  ('admin',     'backups',           true,  true,  true,  true),

  ('admin',     'staff',             true,  true,  true,  true)
on conflict (role, table_name) do update set
  can_select = excluded.can_select,
  can_insert = excluded.can_insert,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete;

alter table role_permissions enable row level security;
drop policy if exists "role_permissions_select" on role_permissions;
create policy "role_permissions_select" on role_permissions for select
  using (current_staff_role() = 'admin');
-- Deliberately no insert/update/delete policy here - changing permissions
-- is a schema change (edit this file and re-run it), not an in-app action,
-- to avoid a logged-in Admin being able to accidentally lock everyone out
-- (including themselves) via the UI.

create or replace function has_permission(p_table text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case p_action
       when 'select' then can_select
       when 'insert' then can_insert
       when 'update' then can_update
       when 'delete' then can_delete
       else false
     end
     from role_permissions
     where role = current_staff_role() and table_name = p_table),
    false
  );
$$;

grant execute on function has_permission(text, text) to authenticated;

-- ---------- Row Level Security ----------
alter table players enable row level security;
alter table payments enable row level security;
alter table tiers enable row level security;
alter table matches enable row level security;
alter table match_squad enable row level security;
alter table inventory_items enable row level security;
alter table issued_items enable row level security;
alter table backups enable row level security;
alter table player_status_log enable row level security;
alter table club_settings enable row level security;
alter table division_labels enable row level security;
alter table club_assets enable row level security;
alter table finance_entries enable row level security;
alter table staff enable row level security;

-- Clear out the old open-access policies from before auth existed.
drop policy if exists "Allow all on players" on players;
drop policy if exists "Allow all on payments" on payments;
drop policy if exists "Allow all on tiers" on tiers;
drop policy if exists "Allow all on matches" on matches;
drop policy if exists "Allow all on match_squad" on match_squad;
drop policy if exists "Allow all on inventory_items" on inventory_items;
drop policy if exists "Allow all on issued_items" on issued_items;
drop policy if exists "Allow all on backups" on backups;
drop policy if exists "Allow all on player_status_log" on player_status_log;
drop policy if exists "Allow all on club_settings" on club_settings;

-- players: generic policies driven by role_permissions (see has_permission above)
drop policy if exists "players_select" on players;
create policy "players_select" on players for select
  using (has_permission('players', 'select'));
drop policy if exists "players_insert" on players;
create policy "players_insert" on players for insert
  with check (has_permission('players', 'insert'));
drop policy if exists "players_update" on players;
create policy "players_update" on players for update
  using (has_permission('players', 'update'))
  with check (has_permission('players', 'update'));
drop policy if exists "players_delete" on players;
create policy "players_delete" on players for delete
  using (has_permission('players', 'delete'));

-- payments
drop policy if exists "payments_select" on payments;
create policy "payments_select" on payments for select
  using (has_permission('payments', 'select'));
drop policy if exists "payments_write" on payments;
create policy "payments_write" on payments for insert
  with check (has_permission('payments', 'insert'));
drop policy if exists "payments_update" on payments;
create policy "payments_update" on payments for update
  using (has_permission('payments', 'update'))
  with check (has_permission('payments', 'update'));
drop policy if exists "payments_delete" on payments;
create policy "payments_delete" on payments for delete
  using (has_permission('payments', 'delete'));

-- tiers
drop policy if exists "tiers_select" on tiers;
create policy "tiers_select" on tiers for select
  using (has_permission('tiers', 'select'));
drop policy if exists "tiers_write" on tiers;
create policy "tiers_write" on tiers for insert
  with check (has_permission('tiers', 'insert'));
drop policy if exists "tiers_update" on tiers;
create policy "tiers_update" on tiers for update
  using (has_permission('tiers', 'update'))
  with check (has_permission('tiers', 'update'));
drop policy if exists "tiers_delete" on tiers;
create policy "tiers_delete" on tiers for delete
  using (has_permission('tiers', 'delete'));

-- club_settings (singleton row - no insert/delete policy by design)
drop policy if exists "club_settings_select" on club_settings;
create policy "club_settings_select" on club_settings for select
  using (has_permission('club_settings', 'select'));
drop policy if exists "club_settings_update" on club_settings;
create policy "club_settings_update" on club_settings for update
  using (has_permission('club_settings', 'update'))
  with check (has_permission('club_settings', 'update'));

-- division_labels: full CRUD for whichever roles have Fixtures Post access
drop policy if exists "division_labels_all" on division_labels;
create policy "division_labels_all" on division_labels for all
  using (has_permission('division_labels', 'select'))
  with check (has_permission('division_labels', 'select'));

-- matches, match_squad, inventory_items, issued_items: permission is uniform
-- across all four actions per role in our matrix, so a single check per
-- table (gated on 'select') covers the whole FOR ALL policy correctly.
drop policy if exists "matches_all" on matches;
create policy "matches_all" on matches for all
  using (has_permission('matches', 'select'))
  with check (has_permission('matches', 'select'));

drop policy if exists "match_squad_all" on match_squad;
create policy "match_squad_all" on match_squad for all
  using (has_permission('match_squad', 'select'))
  with check (has_permission('match_squad', 'select'));

drop policy if exists "inventory_items_all" on inventory_items;
create policy "inventory_items_all" on inventory_items for all
  using (has_permission('inventory_items', 'select'))
  with check (has_permission('inventory_items', 'select'));

drop policy if exists "club_assets_all" on club_assets;
create policy "club_assets_all" on club_assets for all
  using (has_permission('club_assets', 'select'))
  with check (has_permission('club_assets', 'select'));

drop policy if exists "finance_entries_all" on finance_entries;
create policy "finance_entries_all" on finance_entries for all
  using (has_permission('finance_entries', 'select'))
  with check (has_permission('finance_entries', 'select'));

drop policy if exists "issued_items_all" on issued_items;
create policy "issued_items_all" on issued_items for all
  using (has_permission('issued_items', 'select'))
  with check (has_permission('issued_items', 'select'));

-- player_status_log: append-only (no update/delete policy by design)
drop policy if exists "player_status_log_select" on player_status_log;
create policy "player_status_log_select" on player_status_log for select
  using (has_permission('player_status_log', 'select'));
drop policy if exists "player_status_log_write" on player_status_log;
create policy "player_status_log_write" on player_status_log for insert
  with check (has_permission('player_status_log', 'insert'));

-- backups: admin only
drop policy if exists "backups_all" on backups;
create policy "backups_all" on backups for all
  using (has_permission('backups', 'select'))
  with check (has_permission('backups', 'select'));

-- staff: admin only
drop policy if exists "staff_all" on staff;
create policy "staff_all" on staff for all
  using (has_permission('staff', 'select'))
  with check (has_permission('staff', 'select'));

grant execute on function create_backup_snapshot(text) to authenticated;
grant execute on function current_staff_role() to authenticated;


-- take an initial snapshot so the Backups tab has something to show right away
select create_backup_snapshot('manual');

