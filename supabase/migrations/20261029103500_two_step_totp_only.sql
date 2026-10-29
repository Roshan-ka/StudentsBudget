-- P2.3b: the second step is an authenticator app's code, and nothing else. Passkeys sign in instead of a password
-- (a session at aal1, like the password), and Supabase Auth may keep other kinds of factor (WebAuthn, recovery codes)
-- in auth.mfa_factors too. None of them is a step the app asks for, so none may hide an account's rows from a session
-- that has only signed in: the check from 20261028150013_two_step_sign_in.sql now counts verified TOTP factors only.
-- `create or replace` keeps the function's owner and grants, and the policies that call it.

create or replace function private.has_verified_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = (select auth.uid()) and f.status = 'verified' and f.factor_type = 'totp'
  );
$$;
