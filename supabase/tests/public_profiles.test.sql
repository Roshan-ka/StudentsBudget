-- The name a student posts under (the hacks feed, chunk 1; migration 20261105100426_public_profiles.sql). Run with
-- `npm run test:db`. Everything happens in one transaction that is rolled back. Users are played as in
-- discount_confirmations.test.sql.
--   A signs up as roshan, Student, batch 2027. B asks for roshan too, C for a malformed name, D for dana_27 with a label
--   and batch that aren't valid, E asks for nothing, F for a reserved name.

begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com', '{"username": "roshan", "label": "student", "batch": "2027"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com', '{"username": "roshan", "label": "graduate"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com', '{"username": "Not Valid!", "label": "student"}'),
  ('00000000-0000-4000-8000-00000000000d', 'd@example.com', '{"username": "dana_27", "label": "teacher", "batch": "27"}'),
  ('00000000-0000-4000-8000-00000000000e', 'e@example.com', null),
  ('00000000-0000-4000-8000-00000000000f', 'f@example.com', '{"username": "admin"}');

-- Plays user `who` until the role is reset. Only called inside the functions below.
create function pg_temp.act_as(who text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-00000000000' || who, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;
grant execute on function pg_temp.act_as(text) to authenticated, anon;

-- The usernames `who` can read in public_profiles.
create function pg_temp.usernames_seen_by(who text)
returns setof text
language plpgsql
as $$
begin
  perform pg_temp.act_as(who);
  return query select username from public.public_profiles order by username;
  execute 'reset role';
end;
$$;

-- Runs `statement` as `who` and returns its SQLSTATE, or 'ok', and how many rows it touched.
create function pg_temp.run_as(who text, statement text)
returns text
language plpgsql
as $$
declare
  touched int;
begin
  perform pg_temp.act_as(who);
  execute statement;
  get diagnostics touched = row_count;
  execute 'reset role';
  return 'ok ' || touched;
exception when others then
  execute 'reset role';
  return sqlstate;
end;
$$;

-- 1. Signed in only: anon gets nothing; signed-in users read, add and change (their own rows), never delete.
select ok(
  not has_table_privilege('anon', 'public.public_profiles', 'SELECT'),
  'anon cannot read public_profiles'
);
-- One privilege per call: given a list, has_table_privilege is true when any of them is held.
select ok(
  has_table_privilege('authenticated', 'public.public_profiles', 'SELECT')
    and has_table_privilege('authenticated', 'public.public_profiles', 'INSERT')
    and has_table_privilege('authenticated', 'public.public_profiles', 'UPDATE'),
  'authenticated can read, add and change public_profiles rows'
);
select ok(
  not has_table_privilege('authenticated', 'public.public_profiles', 'DELETE'),
  'authenticated cannot delete a public_profiles row: it goes with the account'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'public_profiles'
      and policyname = 'second step when the account has one' and permissive = 'RESTRICTIVE'
  ),
  'public_profiles has the restrictive second-step policy'
);

-- 2. The sign-up's metadata makes the row: only a free, well-formed, unreserved username; a bad label or batch is left
-- empty, and no sign-up fails.
select results_eq(
  $$ select username, label, batch from public.public_profiles order by username $$,
  $$ values ('dana_27'::text, null::text, null::smallint), ('roshan', 'student', 2027::smallint) $$,
  'the trigger keeps a valid username, label and batch, and leaves out a label or batch that is not valid'
);
select is(
  (select count(*)::int from public.public_profiles where user_id in (
    '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c',
    '00000000-0000-4000-8000-00000000000e', '00000000-0000-4000-8000-00000000000f'
  )),
  0,
  'a taken, malformed, missing or reserved username leaves the user without a row'
);
select is(
  (select count(*)::int from auth.users where email in ('b@example.com', 'c@example.com', 'f@example.com')),
  3,
  'those sign-ups still happened'
);

-- 3. Whether a username is free: anyone may ask, and it follows the same rule as the table.
select ok(
  has_function_privilege('anon', 'public.username_available(text)', 'EXECUTE'),
  'anon can ask whether a username is free'
);
select results_eq(
  $$ select public.username_available(name) from unnest(
       array['roshan', 'free_name_1', 'ab', 'a-b', 'Upper', 'admin', 'abcdefghijklmnopqrstu']
     ) with ordinality as t(name, n) order by n $$,
  $$ values (false), (true), (false), (false), (false), (false), (false) $$,
  'taken, too short, with a dash, with capitals, reserved or too long is not available; a free name is'
);
select ok(
  not has_function_privilege('authenticated', 'private.profile_from_sign_up()', 'EXECUTE'),
  'nobody signed in can call the trigger function'
);

-- 4. Each user reads and writes only their own row.
select results_eq(
  $$ select * from pg_temp.usernames_seen_by('d') $$,
  $$ values ('dana_27'::text) $$,
  'D reads only its own row'
);
select is(
  pg_temp.run_as('d', $$ update public.public_profiles set username = 'taken_over' where username = 'roshan' $$),
  'ok 0',
  'D cannot change A''s row'
);
select is(
  pg_temp.run_as('e', $$ insert into public.public_profiles (user_id, username)
                         values ('00000000-0000-4000-8000-00000000000b', 'for_b') $$),
  '42501',
  'E cannot add a row for B'
);
select is(
  pg_temp.run_as('e', $$ insert into public.public_profiles (username, label) values ('roshan', 'alumni') $$),
  '23505',
  'E cannot take a username someone has'
);

-- 5. The row goes with the account.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is_empty(
  $$ select 1 from public.public_profiles where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  'deleting A deletes its row'
);

select * from finish();
rollback;
