-- Revisions, deletion markers and sync_pull (migration 20261026132206_sync.sql). Run with `npm run test:db`.
-- Everything happens in one transaction that is rolled back. Users A and B are played as in user_data.test.sql: the
-- `authenticated` role with the JWT claims auth.uid() reads, inside DO blocks that reset the role before they end.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

create temporary table user_tables (name text primary key) on commit drop;
insert into user_tables
values ('accounts'), ('entries'), ('plans'), ('guesses'), ('manual_rates'), ('week_results'), ('discount_votes'),
  ('profiles');
grant select on user_tables to authenticated, anon;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com');

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

-- 1. Every table has the two new columns, and nobody signed in can delete rows any more.
select is_empty(
  $$ select name from user_tables t
     where (select count(*) from information_schema.columns c
            where c.table_schema = 'public' and c.table_name = t.name and c.column_name in ('rev', 'deleted_at')) <> 2 $$,
  'every user-data table has rev and deleted_at'
);

select is_empty(
  $$ select name from user_tables where has_table_privilege('authenticated', 'public.' || name, 'DELETE') $$,
  'authenticated cannot delete from any user-data table'
);

-- 2. Revisions: one counter per user, a new number for every write.
select lives_ok(
  $$
  do $do$
  begin
    perform pg_temp.act_as('a');
    insert into public.accounts (id, data) values ('a1', '{"n": 1}');
    insert into public.entries (id, data) values ('e1', '{"n": 1}');
    update public.entries set data = '{"n": 2}' where id = 'e1';
    perform pg_temp.act_as('b');
    insert into public.entries (id, data) values ('x1', '{"n": 1}');
    execute 'reset role';
  end
  $do$
  $$,
  'A and B write rows'
);

select is(
  (select rev from public.accounts where id = 'a1'),
  1::bigint,
  'a user''s first write gets revision 1'
);

select is(
  (select rev from public.entries where id = 'e1'),
  3::bigint,
  'every later write takes the next revision, a change included'
);

select is(
  (select rev from public.entries where id = 'x1'),
  1::bigint,
  'each user counts on their own'
);

-- 3. Deletion markers: a write without data is a tombstone with the server's time; data brings the row back.
select lives_ok(
  $$
  do $do$
  begin
    perform pg_temp.act_as('a');
    update public.entries set data = null where id = 'e1';
    execute 'reset role';
  end
  $do$
  $$,
  'A deletes e1 by writing it without data'
);

select ok(
  (select data is null and deleted_at is not null and rev = 4 from public.entries where id = 'e1'),
  'the tombstone keeps its id, has no data, gets deleted_at and a new revision'
);

select lives_ok(
  $$
  do $do$
  begin
    perform pg_temp.act_as('a');
    insert into public.entries (id, data) values ('e1', '{"n": 3}')
      on conflict (user_id, id) do update set data = excluded.data;
    execute 'reset role';
  end
  $do$
  $$,
  'A writes e1 again'
);

select ok(
  -- An upsert that ends up as an update takes two revisions (insert, then update); gaps are fine, the order is not.
  (select data is not null and deleted_at is null and rev > 4 from public.entries where id = 'e1'),
  'writing data to a tombstone''s id brings the row back, with a later revision'
);

select lives_ok(
  $$
  do $do$
  begin
    perform pg_temp.act_as('a');
    begin
      delete from public.entries where id = 'e1';
      raise exception 'A could hard-delete a row';
    exception when insufficient_privilege then
      null;
    end;
    execute 'reset role';
  end
  $do$
  $$,
  'a signed-in user cannot hard-delete a row'
);

-- The check holds even without the trigger: no data means deleted, and the other way round.
alter table public.entries disable trigger stamp_sync;
select throws_ok(
  $$ insert into public.entries (user_id, id, data, deleted_at)
     values ('00000000-0000-4000-8000-00000000000a', 'half-deleted', null, null) $$,
  '23514',
  null,
  'a row without data must be marked deleted'
);
alter table public.entries enable trigger stamp_sync;

-- 4. sync_pull: the caller's own changes after a revision, oldest first, within the limit.
select lives_ok(
  $$
  do $do$
  declare
    got text;
    last bigint;
  begin
    perform pg_temp.act_as('a');
    select string_agg(tbl || ':' || id, ' ' order by rev) into got from public.sync_pull(0, 100);
    if got is distinct from 'accounts:a1 entries:e1' then raise exception 'A pulled %', got; end if;
    select string_agg(id, ' ' order by rev) into got from public.sync_pull(1, 100);
    if got is distinct from 'e1' then raise exception 'A pulled after 1: %', got; end if;
    select string_agg(id, ' ' order by rev) into got from public.sync_pull(0, 1);
    if got is distinct from 'a1' then raise exception 'A pulled with limit 1: %', got; end if;
    select max(rev) into last from public.sync_pull(0, 100);
    select string_agg(id, ' ' order by rev) into got from public.sync_pull(last, 100);
    if got is not null then raise exception 'A pulled after its last revision: %', got; end if;
    perform pg_temp.act_as('b');
    select string_agg(id, ' ' order by rev) into got from public.sync_pull(0, 100);
    if got is distinct from 'x1' then raise exception 'B pulled %', got; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'sync_pull gives each user only their own changes, after the cursor, oldest first, within the limit'
);

select lives_ok(
  $$
  do $do$
  declare
    got record;
    last bigint;
  begin
    perform pg_temp.act_as('a');
    select max(rev) into last from public.sync_pull(0, 100);
    update public.entries set data = null where id = 'e1';
    select * into got from public.sync_pull(last, 100);
    if got.id <> 'e1' or got.data is not null or got.deleted_at is null then
      raise exception 'the tombstone pulled as %', got;
    end if;
    execute 'reset role';
  end
  $do$
  $$,
  'a pull carries tombstones, with no data and their deleted_at'
);

select lives_ok(
  $$
  do $do$
  begin
    execute 'set local role anon';
    begin
      perform public.sync_pull(0, 10);
      raise exception 'anon could call sync_pull';
    exception when insufficient_privilege then
      null;
    end;
    execute 'reset role';
  end
  $do$
  $$,
  'anon cannot call sync_pull'
);

-- The call above would also fail on the tables, which anon cannot read; the grant itself has to be gone too.
select ok(
  not has_function_privilege('anon', 'public.sync_pull(bigint, integer)', 'EXECUTE'),
  'anon has no EXECUTE on sync_pull'
);

-- 5. Deleting a user removes their counter with their rows.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is(
  (select count(*) from private.sync_meta where user_id = '00000000-0000-4000-8000-00000000000a'),
  0::bigint,
  'deleting a user deletes their revision counter'
);

select * from finish();
rollback;
