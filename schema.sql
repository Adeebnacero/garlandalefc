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
  monthly_fee numeric default 0,
  documents_complete boolean default false,
  notes text default '',
  reg_no text unique,              -- federation-issued player number, blank until registered, unique once issued
  squad_number int,                -- usual jersey number (editable per match)
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

-- If you already ran the v1 schema and are only adding these columns:
alter table players add column if not exists reg_no text;
alter table players add column if not exists squad_number int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_reg_no_key') then
    alter table players add constraint players_reg_no_key unique (reg_no);
  end if;
end $$;

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

-- ---------- Row Level Security ----------
-- No login screen — used directly by the Chairman with the public "anon" key.
-- These policies allow full access for that reason (see README for the
-- security trade-off this implies).

alter table players enable row level security;
alter table payments enable row level security;
alter table matches enable row level security;
alter table match_squad enable row level security;
alter table inventory_items enable row level security;
alter table issued_items enable row level security;

drop policy if exists "Allow all on players" on players;
create policy "Allow all on players" on players for all using (true) with check (true);

drop policy if exists "Allow all on payments" on payments;
create policy "Allow all on payments" on payments for all using (true) with check (true);

drop policy if exists "Allow all on matches" on matches;
create policy "Allow all on matches" on matches for all using (true) with check (true);

drop policy if exists "Allow all on match_squad" on match_squad;
create policy "Allow all on match_squad" on match_squad for all using (true) with check (true);

drop policy if exists "Allow all on inventory_items" on inventory_items;
create policy "Allow all on inventory_items" on inventory_items for all using (true) with check (true);

drop policy if exists "Allow all on issued_items" on issued_items;
create policy "Allow all on issued_items" on issued_items for all using (true) with check (true);

-- ---------- optional: seed data (run once, on a fresh database) ----------
insert into players (name, dob, phone, email, guardian_name, guardian_phone, join_date, monthly_fee, documents_complete, notes, reg_no, squad_number)
values
  ('Liam Adams', '2014-03-12', '+27 82 111 2222', 'liam.parent@example.com', 'Sarah Adams', '+27 82 111 2222', '2023-02-01', 350, true, '', '347431', 1),
  ('Thabo Nkosi', '2013-07-30', '+27 83 222 3333', 'thabo.parent@example.com', 'Nomvula Nkosi', '+27 83 222 3333', '2022-09-15', 350, true, '', '189383', 5),
  ('Ethan van der Merwe', '2015-01-05', '+27 84 333 4444', 'ethan.parent@example.com', 'Riaan van der Merwe', '+27 84 333 4444', '2024-01-10', 300, false, 'Medical form outstanding', null, 14);

insert into inventory_items (name, category, size, quantity_on_hand)
values
  ('Home jersey', 'Jersey', 'Youth M', 20),
  ('Away jersey', 'Jersey', 'Youth M', 15),
  ('Training bib', 'Bib', 'One size', 25),
  ('Tracksuit top', 'Tracksuit', 'Youth L', 10);
