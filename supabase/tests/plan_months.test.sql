-- The months of plan history (migration 20261110134042_plan_months.sql). Run with `npm run test:db`.
-- Everything happens in one transaction that is rolled back. Users are played as in two_step.test.sql, with the JWT's
-- `aal`.
--
-- plan_months is a user-data table like discount_votes, so user_data, sync, two_step and account_deletion run every
-- rule they check on it too (it is in their user_tables). This file holds the table to discount_votes itself, column
-- by column, constraint by constraint, policy by policy, so the two can't drift, and walks a month through sync_pull.
--   A and B have no second step; C has a verified authenticator factor.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', 'phone', 'totp', 'verified', now(), now());

-- Plays user `who` at assurance level `aal` until the role is reset. Only called inside the DO blocks below, which
-- reset the role before they end.
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

-- 1. The same table as discount_votes: columns, constraints, indexes, triggers, policies and grants, with the table's
-- name taken out of every name and definition.
select results_eq(
  $$ select column_name::text, data_type::text, is_nullable::text, column_default::text
     from information_schema.columns
     where table_schema = 'public' and table_name = 'plan_months' order by ordinal_position $$,
  $$ select column_name::text, data_type::text, is_nullable::text, column_default::text
     from information_schema.columns
     where table_schema = 'public' and table_name = 'discount_votes' order by ordinal_position $$,
  'plan_months has discount_votes''s columns, in order, with their types, nullability and defaults'
);

select results_eq(
  $$ select replace(conname, 'plan_months', '<t>'), contype::text, pg_get_constraintdef(oid)
     from pg_constraint where conrelid = 'public.plan_months'::regclass order by 1 $$,
  $$ select replace(conname, 'discount_votes', '<t>'), contype::text, pg_get_constraintdef(oid)
     from pg_constraint where conrelid = 'public.discount_votes'::regclass order by 1 $$,
  'plan_months has discount_votes''s constraints: the key, the cascade from auth.users, the id, data and tombstone checks'
);

select results_eq(
  $$ select replace(indexdef, 'plan_months', '<t>') from pg_indexes
     where schemaname = 'public' and tablename = 'plan_months' order by 1 $$,
  $$ select replace(indexdef, 'discount_votes', '<t>') from pg_indexes
     where schemaname = 'public' and tablename = 'discount_votes' order by 1 $$,
  'plan_months has discount_votes''s indexes: the key and (user_id, rev) for pulls'
);

select results_eq(
  $$ select replace(pg_get_triggerdef(oid), 'plan_months', '<t>') from pg_trigger
     where tgrelid = 'public.plan_months'::regclass and not tgisinternal order by tgname $$,
  $$ select replace(pg_get_triggerdef(oid), 'discount_votes', '<t>') from pg_trigger
     where tgrelid = 'public.discount_votes'::regclass and not tgisinternal order by tgname $$,
  'plan_months has discount_votes''s triggers: stamp_sync, then stamp_updated_at'
);

select results_eq(
  $$ select policyname::text, permissive, roles::text[], cmd, qual, with_check from pg_policies
     where schemaname = 'public' and tablename = 'plan_months' order by policyname $$,
  $$ select policyname::text, permissive, roles::text[], cmd, qual, with_check from pg_policies
     where schemaname = 'public' and tablename = 'discount_votes' order by policyname $$,
  'plan_months has discount_votes''s policies: owner reads, adds and changes, and the restrictive second step'
);

select is_empty(
  $$ select r.role, p.priv
     from unnest(array['anon', 'authenticated']) as r(role),
          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(priv)
     where has_table_privilege(r.role, 'public.plan_months', p.priv)
       <> has_table_privilege(r.role, 'public.discount_votes', p.priv) $$,
  'anon and authenticated hold the same privileges on plan_months as on discount_votes'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.plan_months'::regclass),
  'plan_months has row-level security on'
);

-- 2. A month saved, deleted and saved again, as the app writes them (upserts), each pulled by sync_pull under its
-- table's name with its revision.
select lives_ok(
  $$
  do $do$
  declare
    got record;
    n bigint;
    last bigint;
  begin
    perform pg_temp.act_as('a', 'aal1');
    insert into public.plan_months (id, data) values ('2026-10', '{"month": "2026-10", "spendingBudgetMinor": 60000}')
      on conflict (user_id, id) do update set data = excluded.data;

    select count(*) into n from public.sync_pull(0, 100);
    if n <> 1 then raise exception 'A pulled % rows, expected the one month', n; end if;
    select * into got from public.sync_pull(0, 100);
    if not found or got.tbl is distinct from 'plan_months' or got.id is distinct from '2026-10'
      or got.data ->> 'spendingBudgetMinor' is distinct from '60000' or got.deleted_at is not null
      or got.rev is distinct from 1::bigint then
      raise exception 'the month pulled as %', got;
    end if;
    last := got.rev;

    -- A delete is written as a tombstone.
    insert into public.plan_months (id, data) values ('2026-10', null)
      on conflict (user_id, id) do update set data = excluded.data;
    select * into got from public.sync_pull(last, 100);
    if not found or got.tbl is distinct from 'plan_months' or got.id is distinct from '2026-10'
      or got.data is not null or got.deleted_at is null or got.rev <= last then
      raise exception 'the deleted month pulled as %', got;
    end if;
    last := got.rev;

    insert into public.plan_months (id, data) values ('2026-10', '{"month": "2026-10", "spendingBudgetMinor": 65000}')
      on conflict (user_id, id) do update set data = excluded.data;
    select * into got from public.sync_pull(last, 100);
    if not found or got.id is distinct from '2026-10' or got.data ->> 'spendingBudgetMinor' is distinct from '65000'
      or got.deleted_at is not null or got.rev <= last then
      raise exception 'the month saved again pulled as %', got;
    end if;
    select count(*) into n from public.sync_pull(got.rev, 100);
    if n <> 0 then raise exception 'A pulled % rows after the last revision', n; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'a month, its delete (a tombstone) and the month saved again each reach sync_pull as plan_months, with a later revision'
);

-- 3. Only the owner sees a month; B's pull and B's reads hold only B's own.
select lives_ok(
  $$
  do $do$
  declare
    got text;
    n bigint;
  begin
    perform pg_temp.act_as('b', 'aal1');
    insert into public.plan_months (id, data) values ('2026-09', '{"month": "2026-09", "spendingBudgetMinor": 50000}');
    select string_agg(tbl || ':' || id, ' ' order by rev) into got from public.sync_pull(0, 100);
    if got is distinct from 'plan_months:2026-09' then raise exception 'B pulled %', got; end if;
    select count(*) into n from public.plan_months where id = '2026-10';
    if n <> 0 then raise exception 'B sees A''s month'; end if;
    update public.plan_months set data = null where id = '2026-10';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'B deleted A''s month'; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'B pulls only B''s own month, and can neither see nor delete A''s'
);

-- 4. An account with two-step sign-in shows its months only to a session that gave the code.
select lives_ok(
  $$
  do $do$
  declare
    n bigint;
  begin
    perform pg_temp.act_as('c', 'aal2');
    insert into public.plan_months (id, data) values ('2026-10', '{"month": "2026-10", "spendingBudgetMinor": 70000}');
    perform pg_temp.act_as('c', 'aal1');
    select count(*) into n from public.plan_months;
    if n <> 0 then raise exception 'C at aal1 sees % months', n; end if;
    select count(*) into n from public.sync_pull(0, 100);
    if n <> 0 then raise exception 'sync_pull at aal1 gave C % rows', n; end if;
    begin
      insert into public.plan_months (id, data) values ('2026-11', '{"month": "2026-11", "spendingBudgetMinor": 70000}');
      raise exception 'C at aal1 could save a month';
    exception when insufficient_privilege then
      null;
    end;
    perform pg_temp.act_as('c', 'aal2');
    select count(*) into n from public.sync_pull(0, 100);
    if n <> 1 then raise exception 'sync_pull at aal2 gave C % rows, expected 1', n; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'with two-step sign-in, the months answer only to a session that gave the code'
);

-- 5. Signed out, the table is closed.
select lives_ok(
  $$
  do $do$
  declare
    n bigint;
  begin
    execute 'set local role anon';
    begin
      select count(*) into n from public.plan_months;
      raise exception 'anon could read the months';
    exception when insufficient_privilege then
      null;
    end;
    begin
      insert into public.plan_months (user_id, id, data)
      values ('00000000-0000-4000-8000-00000000000a', 'planted', '{}');
      raise exception 'anon could save a month';
    exception when insufficient_privilege then
      null;
    end;
    execute 'reset role';
  end
  $do$
  $$,
  'anon can neither read nor write the months'
);

-- 6. Deleting an account takes its months, tombstones included, and leaves everyone else's.
select lives_ok(
  $$ do $do$ begin perform pg_temp.act_as('a', 'aal1'); perform public.delete_my_account(); execute 'reset role'; end $do$ $$,
  'A deletes their account'
);
select is(
  (select count(*) from public.plan_months where user_id = '00000000-0000-4000-8000-00000000000a'),
  0::bigint,
  'no month of A is left'
);
select is(
  (select count(*) from public.plan_months where user_id <> '00000000-0000-4000-8000-00000000000a'),
  2::bigint,
  'B''s and C''s months stay'
);

select * from finish();
rollback;
