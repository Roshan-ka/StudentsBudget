-- P2.5: whether the account a phone is linked to still exists (docs/superpowers/plans/2026-11-04-account-deletion.md).
-- A phone stays linked to an account after it was deleted on another phone: its session simply runs out. Signing in
-- there to another account would then stay blocked as "linked to another account" forever. Asked only by a signed-in
-- user, about the id the phone is linked to: the answer says no more than whether that id still has an account, and ids
-- are random UUIDs, so it finds no one.

create function public.linked_account_exists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where u.id = p_user_id);
$$;

revoke all on function public.linked_account_exists(uuid) from public, anon;
grant execute on function public.linked_account_exists(uuid) to authenticated;
