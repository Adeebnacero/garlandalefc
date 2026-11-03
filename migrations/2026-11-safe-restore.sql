-- 2026-11: Safe restore from backup. Applied to production 3 November 2026.
--
-- The old restore_from_snapshot() deleted and re-inserted players and
-- notices. Deleting a player cascades into tables the backup doesn't
-- restore, so one restore wiped every guardian link (all parents locked
-- out of the Player Portal), every notice read and every private message.
-- It also replaced the audit log with the copy in the backup, and failed
-- outright when any fixture had a referee.
--
-- How restore works now:
--   1. It first takes a 'pre-restore' backup, so a restore can be undone.
--   2. Rows that still exist are UPDATED in place (only if different) and
--      rows deleted since the backup are added back. Existing players and
--      notices are never deleted, so nothing hanging off them is lost.
--   3. Rows created after the backup are removed - EXCEPT money already
--      received online (payments with a Yoco reference, paid shop orders),
--      which is always kept, together with the player it belongs to.
--   4. Tables the backup doesn't contain are not touched. Guardian links,
--      supporters and settings are only added/updated, never removed.
--   5. The audit log is never deleted or overwritten; the restore is
--      recorded in it, with the id of the pre-restore backup.
--   6. A column the backup predates keeps its current value.
--   7. Restored notices are never pushed to phones. The shop's order-number
--      counter never goes backwards.
--
-- Safe to run more than once.

-- Columns present in the backup rows that also exist in the live table.
create or replace function public._restore_cols(p_table text, p_rows jsonb)
returns text[] language sql stable set search_path = public as $$
  select coalesce(array_agg(a.attname::text order by a.attnum), '{}'::text[])
  from pg_attribute a
  where a.attrelid = ('public.' || quote_ident(p_table))::regclass
    and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and a.attname::text in (select distinct k from jsonb_array_elements(p_rows) e, jsonb_object_keys(e) k)
$$;

-- Loads one table's backup rows into a temporary copy, pg_temp._r_<table>.
create or replace function public._restore_load(p_table text, p_rows jsonb)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  execute format('drop table if exists pg_temp.%I', '_r_' || p_table);
  execute format('create temp table %I on commit drop as select * from jsonb_populate_recordset(null::public.%I, $1)',
                 '_r_' || p_table, p_table) using p_rows;
end $$;

-- Inserts missing rows and updates changed ones (only the given columns).
create or replace function public._restore_upsert(p_table text, p_cols text[], p_conflict text)
returns int language plpgsql set search_path = public, pg_temp as $$
declare collist text; sets text; tcmp text; ecmp text; n int;
begin
  if coalesce(array_length(p_cols, 1), 0) = 0 then return 0; end if;
  select string_agg(format('%I', c), ', '),
         string_agg(format('%1$I = excluded.%1$I', c), ', '),
         string_agg(format('t.%I', c), ', '),
         string_agg(format('excluded.%I', c), ', ')
    into collist, sets, tcmp, ecmp
  from unnest(p_cols) c;
  execute format('insert into public.%I as t (%s) select %s from pg_temp.%I on conflict (%s) do update set %s where row(%s) is distinct from row(%s)',
                 p_table, collist, collist, '_r_' || p_table, p_conflict, sets, tcmp, ecmp);
  get diagnostics n = row_count;
  return n;
end $$;

-- Deletes live rows that aren't in the backup, unless p_keep says to keep them.
create or replace function public._restore_delete_missing(p_table text, p_pk text[], p_keep text default 'false')
returns int language plpgsql set search_path = public, pg_temp as $$
declare cond text; n int;
begin
  select string_agg(format('r.%1$I = t.%1$I', c), ' and ') into cond from unnest(p_pk) c;
  execute format('delete from public.%I t where not exists (select 1 from pg_temp.%I r where %s) and not (%s)',
                 p_table, '_r_' || p_table, cond, p_keep);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public._restore_cols(text, jsonb) from public, anon, authenticated;
revoke all on function public._restore_load(text, jsonb) from public, anon, authenticated;
revoke all on function public._restore_upsert(text, text[], text) from public, anon, authenticated;
revoke all on function public._restore_delete_missing(text, text[], text) from public, anon, authenticated;

-- The parent-protection trigger must not block a restore run by a staff
-- member who is also a guardian (gfc.restoring is only ever set inside
-- restore_from_snapshot, for the length of its own transaction).
create or replace function public.enforce_player_profile_whitelist()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if current_setting('gfc.restoring', true) = 'on' then
    return new;
  end if;
  if current_player_id() is not null then
    if new.id                 is distinct from old.id
       or new.name             is distinct from old.name
       or new.dob              is distinct from old.dob
       or new.age_group_override is distinct from old.age_group_override
       or new.join_date        is distinct from old.join_date
       or new.billing_start_date is distinct from old.billing_start_date
       or new.monthly_fee      is distinct from old.monthly_fee
       or new.documents_complete is distinct from old.documents_complete
       or new.notes            is distinct from old.notes
       or new.reg_no           is distinct from old.reg_no
       or new.squad_number     is distinct from old.squad_number
       or new.user_id          is distinct from old.user_id
       or new.tier_id          is distinct from old.tier_id
       or new.active           is distinct from old.active
    then
      raise exception 'Players may only update phone, email, guardian_name, guardian_phone';
    end if;
  end if;
  return new;
end;
$function$;

drop function if exists public.restore_from_snapshot(jsonb);
create function public.restore_from_snapshot(snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Parents before children.
  load_order constant text[] := array[
    'tiers','players','inventory_items','division_labels','club_assets','finance_entries',
    'reminder_batches','league_table_sources','league_standings','fixtures','matches','match_squad',
    'issued_items','payments','player_status_log','referee_appointments','notices','guardian_players',
    'supporters','club_settings','store_settings','supporter_settings','store_products','store_product_sizes',
    'store_orders','store_order_items','store_order_events','store_order_counters','home_banners'];
  kept_order constant text := 'o.paid_at is not null and not exists (select 1 from pg_temp._r_store_orders r where r.id = o.id)';
  t text;
  present text[] := '{}';
  cols jsonb := '{}'::jsonb;
  removed jsonb := '{}'::jsonb;
  written jsonb := '{}'::jsonb;
  pre_backup uuid;
  n int;
  kept_payments int := 0;
  kept_orders int := 0;
  kept_players int := 0;
  result jsonb;
begin
  if not is_admin_level() then
    raise exception 'Only an Admin or Chairman can restore from a backup.' using errcode = '42501';
  end if;
  if snapshot is null or jsonb_typeof(snapshot) <> 'object' or jsonb_typeof(snapshot->'players') is distinct from 'array' then
    raise exception 'This file doesn''t look like a Garlandale FC backup.';
  end if;

  -- 1. Undo point.
  pre_backup := create_backup_snapshot('pre-restore');
  perform set_config('gfc.restoring', 'on', true);

  -- 2. Load every table the backup contains.
  foreach t in array load_order loop
    if jsonb_typeof(snapshot->t) = 'array' then
      perform _restore_load(t, snapshot->t);
      present := present || t;
      cols := cols || jsonb_build_object(t, to_jsonb(_restore_cols(t, snapshot->t)));
    end if;
  end loop;

  -- 3. Line the backup up with today's logins and staff.
  if 'players' = any(present) then
    update _r_players r set user_id = null
     where user_id is not null and not exists (select 1 from auth.users u where u.id = r.user_id);
  end if;
  if 'guardian_players' = any(present) then
    delete from _r_guardian_players r where not exists (select 1 from auth.users u where u.id = r.auth_user_id);
    update _r_guardian_players r set invited_by = null
     where invited_by is not null and not exists (select 1 from auth.users u where u.id = r.invited_by);
  end if;
  if 'supporters' = any(present) then
    delete from _r_supporters r where not exists (select 1 from auth.users u where u.id = r.auth_user_id);
    update _r_supporters r set decided_by = null
     where decided_by is not null and not exists (select 1 from staff s where s.id = r.decided_by);
  end if;
  if 'store_orders' = any(present) then
    update _r_store_orders r set auth_user_id = null
     where auth_user_id is not null and not exists (select 1 from auth.users u where u.id = r.auth_user_id);
  end if;
  if 'fixtures' = any(present) then
    update _r_fixtures r set referee_id = null
     where referee_id is not null and not exists (select 1 from staff s where s.id = r.referee_id);
  end if;
  if 'referee_appointments' = any(present) then
    delete from _r_referee_appointments r where not exists (select 1 from staff s where s.id = r.referee_id);
  end if;
  if 'home_banners' = any(present) then
    update _r_home_banners r set posted_by = null
     where posted_by is not null and not exists (select 1 from staff s where s.id = r.posted_by);
  end if;
  if 'notices' = any(present) then
    update _r_notices r set posted_by = null
     where posted_by is not null and not exists (select 1 from staff s where s.id = r.posted_by);
    -- Restored notices never go to phones.
    update _r_notices set push_sent_at = coalesce(push_sent_at, now());
    if not (cols->'notices') ? 'push_sent_at' then
      cols := jsonb_set(cols, '{notices}', (cols->'notices') || '"push_sent_at"'::jsonb);
    end if;
  end if;

  -- 4. Remove what was added after the backup, children first.
  --    Money received online is always kept.
  if 'payments' = any(present) then
    select count(*) into kept_payments from payments p
     where p.reference is not null and not exists (select 1 from _r_payments r where r.id = p.id);
  end if;
  if 'store_orders' = any(present) then
    select count(*) into kept_orders from store_orders o where o.paid_at is not null
       and not exists (select 1 from _r_store_orders r where r.id = o.id);
    if 'store_order_events' = any(present) then
      removed := removed || jsonb_build_object('store_order_events', _restore_delete_missing('store_order_events', array['id'],
        format('t.order_id in (select o.id from store_orders o where %s)', kept_order)));
    end if;
    if 'store_order_items' = any(present) then
      removed := removed || jsonb_build_object('store_order_items', _restore_delete_missing('store_order_items', array['id'],
        format('t.order_id in (select o.id from store_orders o where %s)', kept_order)));
    end if;
    removed := removed || jsonb_build_object('store_orders', _restore_delete_missing('store_orders', array['id'], 't.paid_at is not null'));
  end if;
  if 'referee_appointments' = any(present) then
    removed := removed || jsonb_build_object('referee_appointments', _restore_delete_missing('referee_appointments', array['id']));
  end if;
  if 'match_squad' = any(present) then
    delete from match_squad;   -- no dependants; fully replaced below (avoids slot-swap clashes)
  end if;
  if 'issued_items' = any(present) then
    removed := removed || jsonb_build_object('issued_items', _restore_delete_missing('issued_items', array['id']));
  end if;
  if 'payments' = any(present) then
    removed := removed || jsonb_build_object('payments', _restore_delete_missing('payments', array['id'], 't.reference is not null'));
  end if;
  if 'player_status_log' = any(present) then
    removed := removed || jsonb_build_object('player_status_log', _restore_delete_missing('player_status_log', array['id']));
  end if;
  if 'league_standings' = any(present) then
    removed := removed || jsonb_build_object('league_standings', _restore_delete_missing('league_standings', array['id']));
  end if;
  if 'notices' = any(present) then
    removed := removed || jsonb_build_object('notices', _restore_delete_missing('notices', array['id']));
  end if;
  if 'matches' = any(present) then
    removed := removed || jsonb_build_object('matches', _restore_delete_missing('matches', array['id']));
  end if;
  if 'fixtures' = any(present) then
    removed := removed || jsonb_build_object('fixtures', _restore_delete_missing('fixtures', array['id']));
  end if;
  if 'store_product_sizes' = any(present) then
    removed := removed || jsonb_build_object('store_product_sizes', _restore_delete_missing('store_product_sizes', array['id'],
      'exists (select 1 from store_order_items i where i.size_id = t.id)'));
  end if;
  if 'store_products' = any(present) then
    removed := removed || jsonb_build_object('store_products', _restore_delete_missing('store_products', array['id'],
      'exists (select 1 from store_order_items i where i.product_id = t.id)'));
  end if;
  if 'home_banners' = any(present) then
    removed := removed || jsonb_build_object('home_banners', _restore_delete_missing('home_banners', array['id']));
  end if;
  if 'players' = any(present) then
    -- A match captain who's about to be removed.
    update matches m set captain_player_id = null
     where captain_player_id is not null
       and not exists (select 1 from _r_players r where r.id = m.captain_player_id)
       and not exists (select 1 from payments p where p.player_id = m.captain_player_id);
    select count(*) into kept_players from players p
     where not exists (select 1 from _r_players r where r.id = p.id)
       and exists (select 1 from payments x where x.player_id = p.id);
    removed := removed || jsonb_build_object('players', _restore_delete_missing('players', array['id'],
      'exists (select 1 from payments p where p.player_id = t.id)'));
  end if;
  if 'inventory_items' = any(present) then
    removed := removed || jsonb_build_object('inventory_items', _restore_delete_missing('inventory_items', array['id']));
  end if;
  if 'tiers' = any(present) then
    removed := removed || jsonb_build_object('tiers', _restore_delete_missing('tiers', array['id'],
      'exists (select 1 from players p where p.tier_id = t.id)'));
  end if;
  foreach t in array array['division_labels','club_assets','finance_entries','reminder_batches','league_table_sources'] loop
    if t = any(present) then
      removed := removed || jsonb_build_object(t, _restore_delete_missing(t, array['id']));
    end if;
  end loop;
  -- guardian_players, supporters and the settings tables are never removed.

  -- 5. Add back and update, parents first.
  foreach t in array load_order loop
    continue when not (t = any(present)) or t = 'store_order_counters';
    n := _restore_upsert(t,
           array(select jsonb_array_elements_text(cols->t)),
           case t when 'referee_appointments' then 'fixture_id'
                  when 'guardian_players'     then 'auth_user_id, player_id'
                  when 'supporters'           then 'auth_user_id'
                  else 'id' end);
    written := written || jsonb_build_object(t, n);
  end loop;
  if 'store_order_counters' = any(present) then
    -- Never lower a counter: it would reuse order numbers.
    insert into store_order_counters as c (year, last_number)
      select year, last_number from _r_store_order_counters
    on conflict (year) do update set last_number = excluded.last_number
      where excluded.last_number > c.last_number;
  end if;

  -- 6. Record it.
  result := jsonb_build_object(
    'undo_backup_id', pre_backup,
    'restored_tables', to_jsonb(present),
    'added_or_updated', written,
    'removed', removed,
    'kept_online_payments', kept_payments,
    'kept_paid_shop_orders', kept_orders,
    'kept_players_with_online_payments', kept_players);
  insert into audit_log (table_name, record_id, action, new_data, changed_by, changed_by_email)
  values ('restore_from_snapshot', pre_backup, 'UPDATE', result, auth.uid(),
          (select email from staff where user_id = auth.uid()));
  return result;
end;
$$;

revoke all on function public.restore_from_snapshot(jsonb) from public, anon;
grant execute on function public.restore_from_snapshot(jsonb) to authenticated;
