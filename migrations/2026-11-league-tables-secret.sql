-- 2026-11: Lock down fetch-league-tables. Applied to production 3 November 2026.
--
-- The function is deployed without login checks (pg_cron can't send a
-- login) and had no other check, so anyone on the internet could run it.
-- The weekly job also still had the YOUR_SERVICE_ROLE_KEY placeholder.
-- Now the job sends a shared secret kept in Vault (same pattern as the
-- Player Portal's push notifications), and the function checks it through
-- verify_cron_secret(), which only the server (service role) can call.
-- Safe to run more than once.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'league_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'league_cron_secret',
      'Shared secret: pg_cron calls fetch-league-tables with this (x-cron-secret header)'
    );
  end if;
end $$;

-- True when p_secret matches the named Vault secret. Only cron secrets
-- listed here can be checked, and only by the server.
create or replace function public.verify_cron_secret(p_name text, p_secret text)
returns boolean language plpgsql stable security definer set search_path = public, vault as $$
declare expected text;
begin
  if p_name not in ('league_cron_secret') or p_secret is null or length(p_secret) < 32 then
    return false;
  end if;
  select decrypted_secret into expected from vault.decrypted_secrets where name = p_name;
  return expected is not null
     and length(expected) = length(p_secret)
     and extensions.digest(expected, 'sha256') = extensions.digest(p_secret, 'sha256');
end $$;

revoke all on function public.verify_cron_secret(text, text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text, text) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'garlandale-weekly-league-tables') then
    perform cron.unschedule('garlandale-weekly-league-tables');
  end if;
end $$;

-- Mondays 07:00 UTC = 09:00 Cape Town.
select cron.schedule(
  'garlandale-weekly-league-tables',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://hfpmlrrunlttiekfdjdz.supabase.co/functions/v1/fetch-league-tables',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'league_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
