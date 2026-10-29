-- Optional two-step sign-in (migrations 20261028150013_two_step_sign_in.sql, 20261029103500_two_step_totp_only.sql).
-- Run with `npm run test:db`. Everything happens in one transaction that is rolled back. Users are played as in
-- user_data.test.sql, with the JWT's `aal` claim added: 'aal1' after the password alone, 'aal2' once the authenticator
-- code was given.
--   A has a verified authenticator factor, B has none, C started adding one and never confirmed it, and D has a
--   verified factor of another kind (WebAuthn): only an authenticator app's code is a step the app asks for.

begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

create temporary table user_tables (name text primary key) on commit drop;
insert into user_tables
values ('accounts'), ('entries'), ('plans'), ('guesses'), ('manual_rates'), ('week_results'), ('discount_votes'),
  ('profiles');
grant select on user_tables to authenticated, anon;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com'),
  ('00000000-0000-4000-8000-00000000000d', 'd@example.com');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'phone', 'totp', 'verified', now(), now()),
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', 'phone', 'totp', 'unverified', now(), now()),
  ('10000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000d', 'key', 'webauthn', 'verified', now(), now());

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

-- 1. The rule is on every table, as a restrictive policy every command must pass.
select is_empty(
  $$ select name from user_tables t
     where not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = t.name
                         and p.policyname = 'second step when the account has one' and p.permissive = 'RESTRICTIVE') $$,
  'every user-data table has the restrictive second-step policy'
);

-- 2. Signed-in users reach exactly one thing in private: the factor check. Nobody signed out reaches even that.
select is(
  array(select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1),
  array['has_verified_factor'],
  'authenticated can execute only has_verified_factor in private'
);

-- By oid, not by a name built from text: the planner may test the privilege before it filters on the schema, and a
-- name like 'private.instances' (from auth.instances) does not exist.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'private' and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') $$,
  'authenticated has no privilege on any table in private'
);

select ok(
  not has_function_privilege('anon', 'private.has_verified_factor()', 'EXECUTE'),
  'anon cannot execute has_verified_factor'
);

-- 3. The check itself: only a verified authenticator-app factor counts.
select lives_ok(
  $$
  do $do$
  begin
    perform pg_temp.act_as('a', 'aal1');
    if not private.has_verified_factor() then raise exception 'A has a verified factor'; end if;
    perform pg_temp.act_as('b', 'aal1');
    if private.has_verified_factor() then raise exception 'B has no factor'; end if;
    perform pg_temp.act_as('c', 'aal1');
    if private.has_verified_factor() then raise exception 'C''s factor was never confirmed'; end if;
    perform pg_temp.act_as('d', 'aal1');
    if private.has_verified_factor() then raise exception 'D''s factor is not an authenticator app''s'; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'has_verified_factor is true for a verified authenticator-app factor only'
);

-- 4. A, with the code given, uses the account as before: adds, changes and reads rows on every table.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      perform pg_temp.act_as('a', 'aal2');
      execute format('insert into public.%I (id, data) values (%L, %L)', t, 'row-a', '{"owner": "a"}');
      execute format('update public.%I set data = %L where id = %L', t, '{"owner": "a", "changed": true}', 'row-a');
      get diagnostics n = row_count;
      if n <> 1 then raise exception '%: A at aal2 changed % rows, expected 1', t, n; end if;
      execute format('select count(*) from public.%I', t) into n;
      if n <> 1 then raise exception '%: A at aal2 sees % rows, expected 1', t, n; end if;
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'with the code given, A adds, changes and reads rows on every table'
);

-- 5. A with the password alone sees, changes and adds nothing.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      perform pg_temp.act_as('a', 'aal1');
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception '%: A at aal1 sees % rows', t, n; end if;
      execute format('update public.%I set data = %L where id = %L', t, '{"owner": "thief"}', 'row-a');
      get diagnostics n = row_count;
      if n <> 0 then raise exception '%: A at aal1 changed a row', t; end if;
      begin
        execute format('insert into public.%I (id, data) values (%L, %L)', t, 'planted', '{}');
        raise exception '%: A at aal1 could add a row', t;
      exception when insufficient_privilege then
        null;
      end;
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'with the password alone, A can neither see, change nor add rows on any table'
);

-- 6. The same holds for sync_pull, which runs as its caller.
select lives_ok(
  $$
  do $do$
  declare
    n bigint;
  begin
    perform pg_temp.act_as('a', 'aal1');
    select count(*) into n from public.sync_pull(0, 1000);
    if n <> 0 then raise exception 'sync_pull at aal1 gave A % rows', n; end if;
    perform pg_temp.act_as('a', 'aal2');
    select count(*) into n from public.sync_pull(0, 1000);
    if n <> 8 then raise exception 'sync_pull at aal2 gave A % rows, expected 8', n; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'sync_pull gives A nothing with the password alone, and every row with the code'
);

-- 7. Accounts without a verified authenticator-app factor are unaffected: the password is enough, as before.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    who text;
    n bigint;
  begin
    foreach who in array array['b', 'c', 'd'] loop
      for t in select name from user_tables loop
        perform pg_temp.act_as(who, 'aal1');
        execute format('insert into public.%I (id, data) values (%L, %L)', t, 'row-' || who, '{}');
        execute format('select count(*) from public.%I', t) into n;
        if n <> 1 then raise exception '%: % at aal1 sees % rows, expected 1', t, who, n; end if;
        execute 'reset role';
      end loop;
    end loop;
  end
  $do$
  $$,
  'B (no factor), C (an unconfirmed one) and D (another kind) use their accounts with the password alone'
);

-- 8. The second step never lets anyone past the owner rule: A at aal2 still sees only A's rows.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      perform pg_temp.act_as('a', 'aal2');
      execute format('select count(*) from public.%I where id <> %L', t, 'row-a') into n;
      if n <> 0 then raise exception '%: A at aal2 sees % rows of others', t, n; end if;
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'with the code given, A still sees only A''s own rows'
);

select * from finish();
rollback;
