-- P2.3a: optional two-step sign-in. An account owner can add an authenticator-app factor (TOTP, Supabase Auth MFA);
-- from then on the account's rows answer only to a session that gave the code (the JWT's `aal` claim is 'aal2').
-- A stolen password alone then opens nothing. Accounts without a verified factor are unaffected.
--
-- The rule is a restrictive policy, which every command must pass on top of the owner policies of
-- 20261023121726_user_data.sql. sync_pull runs as its caller, so it follows the rule too.

-- Whether the signed-in user has a verified factor. auth.mfa_factors is the auth service's own table; this function
-- reads it for the policies as its owner, so signed-in users need no access to it.
create function private.has_verified_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
$$;

revoke all on function private.has_verified_factor() from public, anon;
-- A policy runs as the signed-in user, who must be able to reach this one function, and nothing else in private:
-- private.sync_meta has no grants (and row-level security with no policy), private.stamp_sync lost its default
-- execute right in 20261026132206_sync.sql, and private.stamp_updated_at loses it here (a trigger fires without it).
revoke all on function private.stamp_updated_at() from public;
grant usage on schema private to authenticated;
grant execute on function private.has_verified_factor() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'entries', 'plans', 'guesses', 'manual_rates', 'week_results', 'discount_votes', 'profiles'
  ] loop
    execute format(
      'create policy "second step when the account has one" on public.%I as restrictive to authenticated '
        || 'using ((select auth.jwt() ->> ''aal'') = ''aal2'' or not (select private.has_verified_factor())) '
        || 'with check ((select auth.jwt() ->> ''aal'') = ''aal2'' or not (select private.has_verified_factor()))',
      t
    );
  end loop;
end;
$$;
