-- P2.5: a signed-in person deletes their own account (docs/superpowers/plans/2026-11-04-account-deletion.md).
-- Deleting the user from auth.users is enough: every user-data table and private.sync_meta cascade from it, so the
-- account's rows go with it, tombstones included. It is the one delete that removes rows for real; everything else
-- writes a tombstone. An account with two-step sign-in needs a session that gave the code (aal2), the rule its rows
-- already follow (20261028150013_two_step_sign_in.sql), so a password alone can't delete it.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if (select private.has_verified_factor()) and coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'the second step is owed' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
