-- ===========================================================================
-- Push notifications: Club Management side (2026-10)
--
-- The Player Portal's migration 0006_notice_pushes.sql added
-- notices.urgent and notices.push_sent_at and the hourly push job. This
-- file makes two fixes on this side, so backups keep working with them:
--
--   1. notices.urgent becomes nullable (null = not urgent). Backups taken
--      before 0006 have no `urgent` field, and restoring one failed on the
--      NOT NULL constraint.
--   2. restore_from_snapshot() marks every restored notice as already
--      handled (push_sent_at), so restoring a backup never sends phones
--      notices again.
--   3. A signed-in user can't clear push_sent_at to make a notice go to
--      phones a second time (trigger keep_notice_push_sent_at).
--
-- schema.sql has the same change. Safe to run more than once, and safe on
-- a database without push notifications (both steps check first).
-- ===========================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'notices' and column_name = 'urgent') then
    alter table public.notices alter column urgent drop not null;
  end if;
end $$;

-- ---------- Don't let a signed-in user un-send a notice ----------
-- Clearing push_sent_at would make the hourly job push a notice to phones
-- again. Only the job itself (service role) may do that - it hands notices
-- back if a run fails before sending. Signed-in staff can still edit
-- everything else, and setting it (as the restore does) is always fine.
create or replace function keep_notice_push_sent_at()
returns trigger
language plpgsql
as $$
begin
  if old.push_sent_at is not null
     and new.push_sent_at is distinct from old.push_sent_at
     and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('authenticated', 'anon') then
    new.push_sent_at := old.push_sent_at;
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'notices' and column_name = 'push_sent_at') then
    drop trigger if exists notices_keep_push_sent_at on notices;
    create trigger notices_keep_push_sent_at before update of push_sent_at on notices
      for each row execute function keep_notice_push_sent_at();
  end if;
end $$;

-- ---------- restore from backup ----------
-- restore_from_snapshot() lives in migrations/2026-11-safe-restore.sql.
-- The old version that used to be here was REMOVED (2026-11): it deleted
-- and re-inserted players and notices, which cascaded away every guardian
-- link, notice read and private message, replaced the audit log, and
-- failed whenever a fixture had a referee. Don't bring it back.
