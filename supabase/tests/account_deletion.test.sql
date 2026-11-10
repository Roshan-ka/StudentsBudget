-- Deleting the account (P2.5, migrations 20261104131626_delete_my_account.sql and
-- 20261104134116_linked_account_exists.sql). Run with `npm run test:db`. Everything happens in one transaction that is
-- rolled back. Users are played as in two_step.test.sql, with the JWT's `aal`.
--   A has a verified authenticator factor, B has none, and C, who has none either, only watches: nobody's deletion may
--   touch C's rows. C then asks whether B's account still exists, as a phone once linked to it would.

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

create temporary table user_tables (name text primary key) on commit drop;
insert into user_tables
values ('accounts'), ('entries'), ('plans'), ('guesses'), ('manual_rates'), ('week_results'), ('discount_votes'),
  ('profiles'), ('checklist_ticks');
grant select on user_tables to authenticated, anon;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'phone', 'totp', 'verified', now(), now());

-- Plays user `who` at assurance level `aal` until the role is reset. Only called inside the DO blocks below.
create function pg_temp.act_as(who text, aal text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-00000000000' || who, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;
grant execute on function pg_temp.act_as(text, text) to authenticated, anon;

-- How many rows `who` has in each user-data table, and in private.sync_meta, as the database owner sees them.
create function pg_temp.rows_of(who text)
returns bigint
language plpgsql
as $$
declare
  t text;
  n bigint;
  total bigint := 0;
begin
  for t in select name from user_tables loop
    execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-4000-8000-00000000000' || who)
      into n;
    total := total + n;
  end loop;
  select total + count(*) into total from private.sync_meta where user_id = ('00000000-0000-4000-8000-00000000000' || who)::uuid;
  return total;
end;
$$;

-- Each user adds one row to every table; A gives the code first, as the app makes it.
do $do$
declare
  t text;
  who text;
begin
  foreach who in array array['a', 'b', 'c'] loop
    for t in select name from user_tables loop
      perform pg_temp.act_as(who, case who when 'a' then 'aal2' else 'aal1' end);
      execute format('insert into public.%I (id, data) values (%L, %L)', t, 'row-' || who, json_build_object('owner', who));
      execute 'reset role';
    end loop;
  end loop;
end
$do$;

-- 1. Only a signed-in user can ask.
select ok(
  not has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'),
  'anon cannot execute delete_my_account'
);
select ok(
  has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE'),
  'authenticated can execute delete_my_account'
);

-- 2. A with the password alone can't delete an account that has two-step sign-in.
select throws_ok(
  $$ do $do$ begin perform pg_temp.act_as('a', 'aal1'); perform public.delete_my_account(); end $do$ $$,
  '42501',
  'the second step is owed',
  'an account with two-step sign-in is not deleted with the password alone'
);
select is(pg_temp.rows_of('a'), 10::bigint, 'A and every row of A are still there after the refusal');

-- 3. B deletes the account: the user, every row and the sync bookkeeping go; C keeps everything.
select lives_ok(
  $$ do $do$ begin perform pg_temp.act_as('b', 'aal1'); perform public.delete_my_account(); execute 'reset role'; end $do$ $$,
  'B deletes their own account'
);
select is_empty(
  $$ select id from auth.users where id = '00000000-0000-4000-8000-00000000000b' $$,
  'B is gone from auth.users'
);
select is(pg_temp.rows_of('b'), 0::bigint, 'no row of B is left in any table, tombstones and sync bookkeeping included');
select is(pg_temp.rows_of('c'), 10::bigint, 'C still has every row');

-- 4. A, with the code given, deletes the account too.
select lives_ok(
  $$ do $do$ begin perform pg_temp.act_as('a', 'aal2'); perform public.delete_my_account(); execute 'reset role'; end $do$ $$,
  'A deletes the account with the code given'
);
select is(pg_temp.rows_of('a'), 0::bigint, 'no row of A is left');
select is_empty(
  $$ select id from auth.mfa_factors where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  'A''s authenticator factor went with the account'
);

-- 5. Whether a linked account still exists: only a signed-in user may ask, and the answer follows auth.users.
select ok(
  not has_function_privilege('anon', 'public.linked_account_exists(uuid)', 'EXECUTE'),
  'anon cannot execute linked_account_exists'
);
select ok(
  has_function_privilege('authenticated', 'public.linked_account_exists(uuid)', 'EXECUTE'),
  'authenticated can execute linked_account_exists'
);
create function pg_temp.exists_for_c(who text)
returns boolean
language plpgsql
as $$
declare
  answer boolean;
begin
  perform pg_temp.act_as('c', 'aal1');
  answer := public.linked_account_exists(('00000000-0000-4000-8000-00000000000' || who)::uuid);
  execute 'reset role';
  return answer;
end;
$$;
select ok(pg_temp.exists_for_c('c'), 'C''s own account exists');
select ok(not pg_temp.exists_for_c('b'), 'B''s deleted account no longer exists');
select ok(not pg_temp.exists_for_c('f'), 'an id that never had an account has none');

select * from finish();
rollback;
