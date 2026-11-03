-- 2026-11: Staff accounts can only be created, changed or removed by an
-- Admin or Chairman. Applied to production on 3 November 2026.
--
-- WHY: the old single policy "staff_all" was FOR ALL with
--   with check (has_permission('staff','select'))
-- Treasurer and Coach were given 'select' on staff (for the referee
-- dropdown and Matchday), which ALSO let them insert, update and delete
-- staff rows - including promoting themselves to admin from the browser
-- console. Reads are unchanged; writes are now Admin/Chairman only.
--
-- The invite-user Edge Function uses the service role key, so inviting
-- staff is unaffected. Safe to run more than once.

-- Admin-level check used below (already exists in production; defined here
-- so this file also works on a fresh database).
create or replace function public.is_admin_level()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_staff_role() in ('admin', 'chairman'), false);
$$;

drop policy if exists staff_all on staff;

drop policy if exists staff_read on staff;
create policy staff_read on staff for select
  using (has_permission('staff','select') or user_id = auth.uid());

drop policy if exists staff_write on staff;
create policy staff_write on staff for insert with check (is_admin_level());

drop policy if exists staff_update on staff;
create policy staff_update on staff for update using (is_admin_level()) with check (is_admin_level());

drop policy if exists staff_delete on staff;
create policy staff_delete on staff for delete using (is_admin_level());

-- Nobody can change their own role, not even an Admin. Stops self-promotion
-- and accidental self-lockout. Another Admin must make the change.
create or replace function prevent_self_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and old.user_id = auth.uid() then
    raise exception 'You can''t change your own role. Ask another Admin.';
  end if;
  return new;
end $$;

revoke execute on function prevent_self_role_change() from public, anon, authenticated;

drop trigger if exists staff_prevent_self_role_change on staff;
create trigger staff_prevent_self_role_change before update on staff
  for each row execute function prevent_self_role_change();
