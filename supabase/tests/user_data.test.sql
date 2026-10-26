-- Row-level security on the user-data tables (migration 20261023121726_user_data.sql). Run with `npm run test:db`.
-- Everything happens in one transaction that is rolled back, so the database is left as it was.
--
-- Two users, A and B. A user is played by switching to the `authenticated` role and setting the JWT claims that
-- auth.uid() reads, as PostgREST does for a signed-in request.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- The tables, and the user ids the tests use.
create temporary table user_tables (name text primary key) on commit drop;
insert into user_tables
values ('accounts'), ('entries'), ('plans'), ('guesses'), ('manual_rates'), ('week_results'), ('discount_votes'),
  ('profiles');
grant select on user_tables to authenticated, anon;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com');

-- Plays user `who` ('a' or 'b') until the role is reset. Only called inside the DO blocks below, which reset the role
-- before they end: pgTAP records each result as the test's own role.
create function pg_temp.act_as(who text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-00000000000' || who, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;
grant execute on function pg_temp.act_as(text) to authenticated, anon;

-- 1. Exactly the eight tables, each with row-level security on.
select tables_are(
  'public',
  array['accounts', 'entries', 'plans', 'guesses', 'manual_rates', 'week_results', 'discount_votes', 'profiles'],
  'public holds exactly the eight user-data tables'
);

select is_empty(
  $$ select tablename::text from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every table in public has row-level security on'
);

-- 2. Grants: nothing for anon, and for signed-in users only reading, adding and changing rows. Deleting is writing a
-- tombstone, a change (migration 20261026132206_sync.sql).
select is_empty(
  $$ select name from user_tables
     where has_table_privilege('anon', 'public.' || name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') $$,
  'anon has no privilege on any user-data table'
);

select is_empty(
  $$ select name from user_tables
     where has_table_privilege('authenticated', 'public.' || name, 'DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or not (has_table_privilege('authenticated', 'public.' || name, 'SELECT')
          and has_table_privilege('authenticated', 'public.' || name, 'INSERT')
          and has_table_privilege('authenticated', 'public.' || name, 'UPDATE')) $$,
  'authenticated has exactly SELECT, INSERT and UPDATE (no TRUNCATE, which would skip row-level security)'
);

-- 3. Each user reads and writes their own rows, on every table.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      perform pg_temp.act_as('a');
      -- No user_id given: it comes from the session.
      execute format('insert into public.%I (id, data) values (%L, %L)', t, 'row-a', '{"owner": "a"}');
      execute format('update public.%I set data = %L where id = %L', t, '{"owner": "a", "changed": true}', 'row-a');
      get diagnostics n = row_count;
      if n <> 1 then raise exception '%: A changed % own rows, expected 1', t, n; end if;
      execute format('select count(*) from public.%I', t) into n;
      if n <> 1 then raise exception '%: A sees % rows, expected 1', t, n; end if;
      execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-4000-8000-00000000000a')
        into n;
      if n <> 1 then raise exception '%: the row is not stored under A', t; end if;

      perform pg_temp.act_as('b');
      execute format('insert into public.%I (id, data) values (%L, %L)', t, 'row-b', '{"owner": "b"}');
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'A and B each add and change rows of their own on every table'
);

-- 4. Nobody sees, changes or deletes another user's rows.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      perform pg_temp.act_as('b');
      execute format('select count(*) from public.%I', t) into n;
      if n <> 1 then raise exception '%: B sees % rows, expected only its own', t, n; end if;
      execute format('select count(*) from public.%I where id = %L', t, 'row-a') into n;
      if n <> 0 then raise exception '%: B sees A''s row', t; end if;
      execute format('update public.%I set data = %L where id = %L', t, '{"owner": "b"}', 'row-a');
      get diagnostics n = row_count;
      if n <> 0 then raise exception '%: B changed A''s row', t; end if;
      -- Deleting is writing a tombstone, which is a change like the one above.
      execute format('update public.%I set data = null where id = %L', t, 'row-a');
      get diagnostics n = row_count;
      if n <> 0 then raise exception '%: B deleted A''s row', t; end if;
      begin
        execute format('delete from public.%I where id = %L', t, 'row-a');
        raise exception '%: B could hard-delete', t;
      exception when insufficient_privilege then
        null;
      end;
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'B can neither see, change nor delete A''s rows on any table'
);

-- 5. Nobody writes a row for someone else, or hands their row to someone else.
select lives_ok(
  $$
  do $do$
  declare
    t text;
  begin
    for t in select name from user_tables loop
      perform pg_temp.act_as('b');
      begin
        execute format(
          'insert into public.%I (user_id, id, data) values (%L, %L, %L)',
          t, '00000000-0000-4000-8000-00000000000a', 'planted', '{}'
        );
        raise exception '%: B added a row under A', t;
      exception when insufficient_privilege then
        null;
      end;
      begin
        execute format(
          'update public.%I set user_id = %L where id = %L',
          t, '00000000-0000-4000-8000-00000000000a', 'row-b'
        );
        raise exception '%: B moved its row to A', t;
      exception when insufficient_privilege then
        null;
      end;
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'no user can add a row under another user, or move a row to one'
);

-- 6. Signed out (anon), every table is closed.
select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      execute 'set local role anon';
      begin
        execute format('select count(*) from public.%I', t) into n;
        raise exception '%: anon could read the table', t;
      exception when insufficient_privilege then
        null;
      end;
      begin
        execute format('insert into public.%I (user_id, id, data) values (%L, %L, %L)',
          t, '00000000-0000-4000-8000-00000000000a', 'anon', '{}');
        raise exception '%: anon could add a row', t;
      exception when insufficient_privilege then
        null;
      end;
      execute 'reset role';
    end loop;
  end
  $do$
  $$,
  'anon can neither read nor write any table'
);

-- 7. The row itself: a JSON object of at most 64 kB, stamped with the server's time. Checks and triggers hold for
-- every role, so these run as the test's own role, with A's id written out.
select throws_ok(
  $$ insert into public.entries (user_id, id, data)
     values ('00000000-0000-4000-8000-00000000000a', 'not-an-object', '[1, 2]') $$,
  '23514',
  null,
  'data must be a JSON object'
);

select throws_ok(
  format(
    'insert into public.entries (user_id, id, data) values (%L, %L, %L)',
    '00000000-0000-4000-8000-00000000000a',
    'too-big',
    json_build_object('note', repeat('x', 70000))::text
  ),
  '23514',
  null,
  'data larger than 64 kB is refused'
);

insert into public.entries (user_id, id, data, updated_at)
values ('00000000-0000-4000-8000-00000000000a', 'old-clock', '{}', '2000-01-01');
select ok(
  (select updated_at > '2020-01-01' from public.entries where id = 'old-clock'),
  'updated_at is the server''s time, whatever the phone sends'
);

-- 8. Deleting a user deletes every row of theirs and leaves the others.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';

select lives_ok(
  $$
  do $do$
  declare
    t text;
    n bigint;
  begin
    for t in select name from user_tables loop
      execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-4000-8000-00000000000a')
        into n;
      if n <> 0 then raise exception '%: % rows of the deleted user are left', t, n; end if;
      execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-4000-8000-00000000000b')
        into n;
      if n <> 1 then raise exception '%: B has % rows after A was deleted, expected 1', t, n; end if;
    end loop;
  end
  $do$
  $$,
  'deleting a user deletes their rows on every table, and only theirs'
);

select * from finish();
rollback;
