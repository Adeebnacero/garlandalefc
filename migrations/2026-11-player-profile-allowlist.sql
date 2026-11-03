-- 2026-11: Parents can only change contact details on their child's
-- record. Applied to production 3 November 2026.
--
-- WHY: the policy players_update_own lets a parent update their linked
-- child's row directly (with the public app key and their own login). The
-- trigger meant to limit that to contact details identified parents with
-- current_player_id(), which in production only recognises the 3 logins
-- that still have the legacy players.user_id link - so for the other 141
-- parents it never fired, and they could change billing start date, tier,
-- active status and everything else. It also blocked staff who are parents
-- (via that legacy link) from editing other players.
--
-- This version doesn't need to recognise parents: any signed-in user
-- without staff permission to edit players may only change the four
-- contact fields. It's an allowlist, so columns added later are protected
-- automatically.
--
-- NOTE: don't "fix" current_player_id() to use guardian_players without
-- reviewing the notices/matches read policies that use it - doing so
-- would let every parent read every notice and match row directly.

create or replace function public.enforce_player_profile_whitelist()
returns trigger language plpgsql security definer set search_path = public as $b$
begin
  -- A restore (restore_from_snapshot sets this for its own transaction).
  if current_setting('gfc.restoring', true) = 'on' then return new; end if;
  -- Server side: Edge Functions using the service role key, cron, SQL editor.
  if auth.uid() is null then return new; end if;
  -- Staff whose role can edit player records (Admin, Chairman, Coach),
  -- including those who are also parents.
  if has_permission('players', 'update') then return new; end if;
  if (to_jsonb(new) - array['phone','email','guardian_name','guardian_phone'])
     is distinct from (to_jsonb(old) - array['phone','email','guardian_name','guardian_phone']) then
    raise exception 'Parents can only change phone, email, guardian name and guardian phone. Contact the club to change anything else.'
      using errcode = '42501';
  end if;
  return new;
end $b$;

revoke all on function public.enforce_player_profile_whitelist() from public, anon, authenticated;

-- (Trigger players_enforce_player_whitelist already exists:
--  BEFORE UPDATE ON players FOR EACH ROW.)
drop trigger if exists players_enforce_player_whitelist on players;
create trigger players_enforce_player_whitelist before update on players
  for each row execute function public.enforce_player_profile_whitelist();
