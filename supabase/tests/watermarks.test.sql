-- A plan never takes a schedule's watermark back (migration 20261029170000_keep_watermarks.sql). Run with
-- `npm run test:db`. Everything happens in one transaction that is rolled back. User A is played as in sync.test.sql,
-- and writes its plan as the app's sync does: an upsert on (user_id, id).

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a', 'a@example.com');

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

-- A plan with a scheduled salary, scheduled rent and an unscheduled phone line; `extra` adds fixed lines at the end.
create function pg_temp.plan_with(salary_through text, rent_through text, rent_minor int, extra jsonb default '[]')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', 'current',
    'cityId', 'regensburg',
    'incomes', jsonb_build_array(jsonb_build_object(
      'categoryId', 'salary', 'monthlyMinor', 100000,
      'schedule', jsonb_build_object('id', 'salary-s', 'frequency', 'monthly', 'day', 25, 'accountId', 'local',
        'amountMinor', 100000, 'startOn', '2026-10-01', 'postedThrough', salary_through))),
    'fixed', jsonb_build_array(
      jsonb_build_object(
        'categoryId', 'rent', 'monthlyMinor', rent_minor,
        'schedule', jsonb_build_object('id', 'rent-s', 'frequency', 'monthly', 'day', 1, 'accountId', 'local',
          'amountMinor', rent_minor, 'startOn', '2026-10-01', 'postedThrough', rent_through)),
      jsonb_build_object('categoryId', 'phone', 'monthlyMinor', 1500)) || extra,
    'oneOffs', '[]'::jsonb,
    'envelopes', '[]'::jsonb,
    'createdOn', '2026-10-01');
$$;
grant execute on function pg_temp.plan_with(text, text, int, jsonb) to authenticated;

-- Writes A's plan as a sync does, signed in as A.
create function pg_temp.sync_plan(data jsonb)
returns void
language plpgsql
as $$
begin
  perform pg_temp.act_as('a');
  insert into public.plans (id, data) values ('current', data)
  on conflict (user_id, id) do update set data = excluded.data;
  execute 'reset role';
end;
$$;
grant execute on function pg_temp.sync_plan(jsonb) to authenticated;

create function pg_temp.stored(path text[])
returns text
language sql
as $$ select data #>> path from public.plans where id = 'current' $$;

-- 1. The trigger is there, before stamp_sync in name order.
select has_trigger('public', 'plans', 'keep_watermarks', 'plans keep their watermarks');

-- 2. An older copy of the plan keeps the later watermarks, and the rest of what it brings.
do $$ begin perform pg_temp.sync_plan(pg_temp.plan_with('2026-10-25', '2026-10-31', 40000)); end $$;
do $$ begin perform pg_temp.sync_plan(pg_temp.plan_with('2026-09-25', '2026-09-30', 41000)); end $$;
select is(pg_temp.stored('{fixed,0,schedule,postedThrough}'), '2026-10-31', 'an older rent watermark is kept at the later one');
select is(pg_temp.stored('{incomes,0,schedule,postedThrough}'), '2026-10-25', 'and so is an older salary watermark');
select is(pg_temp.stored('{fixed,0,monthlyMinor}'), '41000', 'while the older copy''s other changes are taken');

-- 3. A later watermark moves on, and a schedule new to the plan comes as it is.
do $$ begin perform pg_temp.sync_plan(pg_temp.plan_with('2026-10-25', '2026-11-30', 41000,
  jsonb_build_array(jsonb_build_object('categoryId', 'gym', 'monthlyMinor', 2500,
    'schedule', jsonb_build_object('id', 'gym-s', 'frequency', 'monthly', 'day', 3, 'accountId', 'local',
      'amountMinor', 2500, 'startOn', '2026-10-01', 'postedThrough', '2026-10-15'))))); end $$;
select is(pg_temp.stored('{fixed,0,schedule,postedThrough}'), '2026-11-30', 'a later watermark moves on');
select is(pg_temp.stored('{fixed,2,schedule,postedThrough}'), '2026-10-15', 'a new schedule comes as it is');

-- 4. After a tombstone there is nothing to keep: the plan written next comes as it is.
do $$ begin perform pg_temp.sync_plan(null); end $$;
do $$ begin perform pg_temp.sync_plan(pg_temp.plan_with('2026-09-25', '2026-09-30', 40000)); end $$;
select is(pg_temp.stored('{fixed,0,schedule,postedThrough}'), '2026-09-30', 'a plan written after a tombstone comes as it is');

select * from finish();
rollback;
