-- ===========================================================================
-- Store: record which player each order item is for (November 2026)
--
-- Until now an order only knew the guardian. A guardian can be linked to
-- more than one player (siblings), so the player can't be worked out from
-- the guardian afterwards; it has to be chosen at checkout.
--
-- This adds three columns to store_order_items:
--   player_id         the player the item is for (nulled if the player is
--                     deleted, or by a backup restore, which deletes and
--                     re-inserts players)
--   player_name       snapshot at purchase time
--   player_age_group  snapshot at purchase time (U10, Seniors, ...)
--
-- The Player Portal checkout only has to set player_id. The trigger below
-- fills in the name and age group from the players table, so the portal
-- can't send a name that doesn't match the player.
--
-- The checkout must still check that the player is linked to the guardian
-- paying (guardian_players), because that check needs the checkout's own
-- record of who is signed in.
--
-- Orders placed before this have no player. Club Management shows a
-- suggestion for those, matched by the guardian's phone number, labelled
-- as a match.
--
-- Needs the store tables (migrations/2026-09-store-drop1.sql and the
-- Drop 2 orders migration). Safe to run more than once. Run it in the
-- Supabase SQL Editor.
-- ===========================================================================

-- ---------- age group ----------
-- Same rules as computeAgeGroup() in src/lib/billing.js: cutoff 31 August,
-- single-year bands to U10, then U12, U14, U16, U18, Seniors from 19, O40
-- from 40. An age_group_override always wins. Keep the two in sync.
create or replace function club_age_group(p_dob date, p_override text, p_on date default null)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  on_date date := coalesce(p_on, (now() at time zone 'Africa/Johannesburg')::date);
  cutoff_year int;
  age int;
begin
  if coalesce(trim(p_override), '') <> '' then
    return trim(p_override);
  end if;
  if p_dob is null then
    return 'Unassigned';
  end if;
  cutoff_year := extract(year from on_date)::int + case when extract(month from on_date) >= 9 then 1 else 0 end;
  age := cutoff_year - extract(year from p_dob)::int;
  return case
    when age <= 0  then 'Unassigned'
    when age >= 40 then 'O40'
    when age >= 19 then 'Seniors'
    when age <= 10 then 'U' || greatest(age, 7)
    when age <= 12 then 'U12'
    when age <= 14 then 'U14'
    when age <= 16 then 'U16'
    else 'U18'
  end;
end;
$$;

grant execute on function club_age_group(date, text, date) to authenticated;

-- ---------- columns ----------
alter table store_order_items
  add column if not exists player_id uuid references players(id) on delete set null;
alter table store_order_items
  add column if not exists player_name text not null default '';
alter table store_order_items
  add column if not exists player_age_group text not null default '';

create index if not exists store_order_items_player_id_idx on store_order_items(player_id);

-- ---------- snapshot from the players table ----------
-- Runs as the table owner so it can read players whatever role the
-- checkout runs as. Only fills the snapshot when player_id is set or
-- changed; clearing player_id (deleted player, backup restore) keeps the
-- snapshot, which is the point of having one.
create or replace function store_order_items_player_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if new.player_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.player_id is not distinct from old.player_id then
    return new;
  end if;
  select name, dob, age_group_override into p from players where id = new.player_id;
  if not found then
    raise exception 'That player no longer exists.';
  end if;
  new.player_name := p.name;
  new.player_age_group := club_age_group(p.dob, p.age_group_override);
  return new;
end;
$$;

drop trigger if exists store_order_items_player_snapshot on store_order_items;
create trigger store_order_items_player_snapshot
  before insert or update of player_id on store_order_items
  for each row execute function store_order_items_player_snapshot();
