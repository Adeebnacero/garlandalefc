-- 2026-11: At most 2 Player Portal logins per player, enforced in the
-- database. Applied to production 3 November 2026.
--
-- invite-player checked the limit in application code, so two invites at
-- the same time could both pass - two players already had 3 logins. The
-- check now happens here, with the player row locked so concurrent
-- invites queue up. Existing links are untouched; re-inviting an account
-- that's already linked is always allowed; a restore is exempt (it puts
-- back links that existed when the backup was taken).
--
-- To allow more (e.g. step-parents), change the 2 below AND
-- MAX_ACCOUNTS_PER_PLAYER in supabase/functions/invite-player/index.ts.

create or replace function public.guardian_players_enforce_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if current_setting('gfc.restoring', true) = 'on' then
    return new;
  end if;
  if exists (select 1 from guardian_players
             where auth_user_id = new.auth_user_id and player_id = new.player_id) then
    return new;
  end if;
  perform 1 from players where id = new.player_id for update;
  select count(*) into n from guardian_players where player_id = new.player_id;
  if n >= 2 then
    raise exception 'This player already has % linked app accounts (the maximum is 2). Remove one before adding another.', n
      using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke all on function public.guardian_players_enforce_limit() from public, anon, authenticated;

drop trigger if exists guardian_players_enforce_limit on guardian_players;
create trigger guardian_players_enforce_limit before insert on guardian_players
  for each row execute function public.guardian_players_enforce_limit();
