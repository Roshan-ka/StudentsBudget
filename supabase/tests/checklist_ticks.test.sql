-- The checklist's ticks (migration 20261110122750_checklist_ticks.sql). Run with `npm run test:db`.
-- Everything happens in one transaction that is rolled back. Users are played as in two_step.test.sql, with the JWT's
-- `aal`.
--
-- checklist_ticks is a user-data table like discount_votes, so user_data, sync, two_step and account_deletion run every
-- rule they check on it too (it is in their user_tables). This file holds the table to discount_votes itself, column
-- by column, constraint by constraint, policy by policy, so the two can't drift, and walks a tick through sync_pull.
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
     where table_schema = 'public' and table_name = 'checklist_ticks' order by ordinal_position $$,
  $$ select column_name::text, data_type::text, is_nullable::text, column_default::text
     from information_schema.columns
     where table_schema = 'public' and table_name = 'discount_votes' order by ordinal_position $$,
  'checklist_ticks has discount_votes''s columns, in order, with their types, nullability and defaults'
);

select results_eq(
  $$ select replace(conname, 'checklist_ticks', '<t>'), contype::text, pg_get_constraintdef(oid)
     from pg_constraint where conrelid = 'public.checklist_ticks'::regclass order by 1 $$,
  $$ select replace(conname, 'discount_votes', '<t>'), contype::text, pg_get_constraintdef(oid)
     from pg_constraint where conrelid = 'public.discount_votes'::regclass order by 1 $$,
  'checklist_ticks has discount_votes''s constraints: the key, the cascade from auth.users, the id, data and tombstone checks'
);

select results_eq(
  $$ select replace(indexdef, 'checklist_ticks', '<t>') from pg_indexes
     where schemaname = 'public' and tablename = 'checklist_ticks' order by 1 $$,
  $$ select replace(indexdef, 'discount_votes', '<t>') from pg_indexes
     where schemaname = 'public' and tablename = 'discount_votes' order by 1 $$,
  'checklist_ticks has discount_votes''s indexes: the key and (user_id, rev) for pulls'
);

select results_eq(
  $$ select replace(pg_get_triggerdef(oid), 'checklist_ticks', '<t>') from pg_trigger
     where tgrelid = 'public.checklist_ticks'::regclass and not tgisinternal order by tgname $$,
  $$ select replace(pg_get_triggerdef(oid), 'discount_votes', '<t>') from pg_trigger
     where tgrelid = 'public.discount_votes'::regclass and not tgisinternal order by tgname $$,
  'checklist_ticks has discount_votes''s triggers: stamp_sync, then stamp_updated_at'
);

select results_eq(
  $$ select policyname::text, permissive, roles::text[], cmd, qual, with_check from pg_policies
     where schemaname = 'public' and tablename = 'checklist_ticks' order by policyname $$,
  $$ select policyname::text, permissive, roles::text[], cmd, qual, with_check from pg_policies
     where schemaname = 'public' and tablename = 'discount_votes' order by policyname $$,
  'checklist_ticks has discount_votes''s policies: owner reads, adds and changes, and the restrictive second step'
);

select is_empty(
  $$ select r.role, p.priv
     from unnest(array['anon', 'authenticated']) as r(role),
          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(priv)
     where has_table_privilege(r.role, 'public.checklist_ticks', p.priv)
       <> has_table_privilege(r.role, 'public.discount_votes', p.priv) $$,
  'anon and authenticated hold the same privileges on checklist_ticks as on discount_votes'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.checklist_ticks'::regclass),
  'checklist_ticks has row-level security on'
);

-- 2. A tick, an untick and a tick again, as the app writes them (upserts), each pulled by sync_pull under its table's
-- name with its revision.
select lives_ok(
  $$
  do $do$
  declare
    got record;
    n bigint;
    last bigint;
  begin
    perform pg_temp.act_as('a', 'aal1');
    insert into public.checklist_ticks (id, data) values ('anmeldung', '{"itemId": "anmeldung", "on": "2026-11-10"}')
      on conflict (user_id, id) do update set data = excluded.data;

    select count(*) into n from public.sync_pull(0, 100);
    if n <> 1 then raise exception 'A pulled % rows, expected the one tick', n; end if;
    select * into got from public.sync_pull(0, 100);
    if not found or got.tbl is distinct from 'checklist_ticks' or got.id is distinct from 'anmeldung'
      or got.data ->> 'on' is distinct from '2026-11-10' or got.deleted_at is not null or got.rev is distinct from 1::bigint then
      raise exception 'the tick pulled as %', got;
    end if;
    last := got.rev;

    -- Unticking deletes the row, which the app writes as a tombstone.
    insert into public.checklist_ticks (id, data) values ('anmeldung', null)
      on conflict (user_id, id) do update set data = excluded.data;
    select * into got from public.sync_pull(last, 100);
    if not found or got.tbl is distinct from 'checklist_ticks' or got.id is distinct from 'anmeldung'
      or got.data is not null or got.deleted_at is null or got.rev <= last then
      raise exception 'the untick pulled as %', got;
    end if;
    last := got.rev;

    insert into public.checklist_ticks (id, data) values ('anmeldung', '{"itemId": "anmeldung", "on": "2026-11-11"}')
      on conflict (user_id, id) do update set data = excluded.data;
    select * into got from public.sync_pull(last, 100);
    if not found or got.id is distinct from 'anmeldung' or got.data ->> 'on' is distinct from '2026-11-11'
      or got.deleted_at is not null or got.rev <= last then
      raise exception 'the tick again pulled as %', got;
    end if;
    select count(*) into n from public.sync_pull(got.rev, 100);
    if n <> 0 then raise exception 'A pulled % rows after the last revision', n; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'a tick, its untick (a tombstone) and a tick again each reach sync_pull as checklist_ticks, with a later revision'
);

-- 3. Only the owner sees a tick; B's pull and B's reads hold only B's own.
select lives_ok(
  $$
  do $do$
  declare
    got text;
    n bigint;
  begin
    perform pg_temp.act_as('b', 'aal1');
    insert into public.checklist_ticks (id, data) values ('bank-account', '{"itemId": "bank-account", "on": "2026-11-10"}');
    select string_agg(tbl || ':' || id, ' ' order by rev) into got from public.sync_pull(0, 100);
    if got is distinct from 'checklist_ticks:bank-account' then raise exception 'B pulled %', got; end if;
    select count(*) into n from public.checklist_ticks where id = 'anmeldung';
    if n <> 0 then raise exception 'B sees A''s tick'; end if;
    update public.checklist_ticks set data = null where id = 'anmeldung';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'B unticked A''s item'; end if;
    execute 'reset role';
  end
  $do$
  $$,
  'B pulls only B''s own tick, and can neither see nor untick A''s'
);

-- 4. An account with two-step sign-in shows its ticks only to a session that gave the code.
select lives_ok(
  $$
  do $do$
  declare
    n bigint;
  begin
    perform pg_temp.act_as('c', 'aal2');
    insert into public.checklist_ticks (id, data) values ('bafoeg', '{"itemId": "bafoeg", "on": "2026-11-10"}');
    perform pg_temp.act_as('c', 'aal1');
    select count(*) into n from public.checklist_ticks;
    if n <> 0 then raise exception 'C at aal1 sees % ticks', n; end if;
    select count(*) into n from public.sync_pull(0, 100);
    if n <> 0 then raise exception 'sync_pull at aal1 gave C % rows', n; end if;
    begin
      insert into public.checklist_ticks (id, data) values ('kindergeld', '{"itemId": "kindergeld", "on": "2026-11-10"}');
      raise exception 'C at aal1 could tick';
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
  'with two-step sign-in, the ticks answer only to a session that gave the code'
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
      select count(*) into n from public.checklist_ticks;
      raise exception 'anon could read the ticks';
    exception when insufficient_privilege then
      null;
    end;
    begin
      insert into public.checklist_ticks (user_id, id, data)
      values ('00000000-0000-4000-8000-00000000000a', 'planted', '{}');
      raise exception 'anon could tick';
    exception when insufficient_privilege then
      null;
    end;
    execute 'reset role';
  end
  $do$
  $$,
  'anon can neither read nor write the ticks'
);

-- 6. Deleting an account takes its ticks, tombstones included, and leaves everyone else's.
select lives_ok(
  $$ do $do$ begin perform pg_temp.act_as('a', 'aal1'); perform public.delete_my_account(); execute 'reset role'; end $do$ $$,
  'A deletes their account'
);
select is(
  (select count(*) from public.checklist_ticks where user_id = '00000000-0000-4000-8000-00000000000a'),
  0::bigint,
  'no tick of A is left'
);
select is(
  (select count(*) from public.checklist_ticks where user_id <> '00000000-0000-4000-8000-00000000000a'),
  2::bigint,
  'B''s and C''s ticks stay'
);

select * from finish();
rollback;
