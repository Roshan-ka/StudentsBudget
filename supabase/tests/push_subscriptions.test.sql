-- The weekly reminder's push addresses (chunk 1; migration 20261105144946_push_subscriptions.sql). Run with
-- `npm run test:db`. Everything happens in one transaction that is rolled back. Users are played as in hacks.test.sql.
--   A and B have no two-step sign-in; C has it.

begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', 'phone', 'totp', 'verified', now(), now());

-- Plays user `who` at assurance level `aal` until the role is reset. Only called inside the functions below.
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

-- Runs `statement` as `who`: 'ok' and how many rows it touched, or the SQLSTATE it raised.
create function pg_temp.call_as(who text, aal text, statement text)
returns text
language plpgsql
as $$
declare
  touched int;
begin
  perform pg_temp.act_as(who, aal);
  execute statement;
  get diagnostics touched = row_count;
  execute 'reset role';
  return 'ok ' || touched;
exception when others then
  execute 'reset role';
  return sqlstate;
end;
$$;

-- `who` saves a reminder for an address, on a day and at a time, in Berlin, in English.
create function pg_temp.save(p_who text, p_endpoint text, p_weekday int, p_time text, p_aal text default 'aal1')
returns text
language sql
as $$
  select pg_temp.call_as(p_who, p_aal, format(
    'select public.save_push_subscription(%L, %L, %L, %s::smallint, %L::time, %L, %L)',
    p_endpoint, 'BPkeyBPkeyBPkeyBPkey', 'authkeyauth', p_weekday, p_time, 'Europe/Berlin', 'en'
  ));
$$;

-- How many rows `who` can read.
create function pg_temp.rows_seen_by(who text)
returns int
language plpgsql
as $$
declare
  seen int;
begin
  perform pg_temp.act_as(who, 'aal1');
  select count(*) into seen from public.push_subscriptions;
  execute 'reset role';
  return seen;
end;
$$;

-- 1. Signed-in users read and delete their own rows and write none directly; anon gets nothing.
select ok(
  not has_table_privilege('anon', 'public.push_subscriptions', 'SELECT'),
  'anon cannot read push_subscriptions'
);
-- One privilege per call: given a list, has_table_privilege is true when any of them is held.
select ok(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT')
    and has_table_privilege('authenticated', 'public.push_subscriptions', 'DELETE')
    and not has_table_privilege('authenticated', 'public.push_subscriptions', 'INSERT')
    and not has_table_privilege('authenticated', 'public.push_subscriptions', 'UPDATE'),
  'authenticated reads and deletes push_subscriptions rows, and writes them only through the function'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
      and policyname = 'second step when the account has one' and permissive = 'RESTRICTIVE'
  ),
  'push_subscriptions has the restrictive second-step policy'
);
select ok(
  not has_function_privilege('anon', 'public.save_push_subscription(text, text, text, smallint, time, text, text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.save_push_subscription(text, text, text, smallint, time, text, text)', 'EXECUTE'),
  'only a signed-in user may save a reminder'
);

-- 2. Saving, and saving again: one row per address, the week it last went kept.
select is(pg_temp.save('a', 'https://fcm.googleapis.com/fcm/send/phone-1', 7, '18:00'), 'ok 1', 'A turns the reminder on');
update public.push_subscriptions set last_sent_week = '2026-11-02' where endpoint = 'https://fcm.googleapis.com/fcm/send/phone-1';
select is(pg_temp.save('a', 'https://fcm.googleapis.com/fcm/send/phone-1', 3, '07:45'), 'ok 1', 'A moves it to Wednesday at 07:45');
select results_eq(
  $$ select weekday::int, local_time::text, last_sent_week::text from public.push_subscriptions
     where endpoint = 'https://fcm.googleapis.com/fcm/send/phone-1' $$,
  $$ values (3, '07:45:00', '2026-11-02') $$,
  'the same row changes, and keeps the week it last went'
);

-- 3. The address moves to whoever saves it; each user sees only their own.
select is(pg_temp.save('b', 'https://fcm.googleapis.com/fcm/send/phone-1', 7, '18:00'), 'ok 1', 'B saves the same phone''s address');
select is(
  (select user_id::text from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/phone-1'),
  '00000000-0000-4000-8000-00000000000b',
  'the address is B''s now, and only once'
);
select is(pg_temp.rows_seen_by('a') * 10 + pg_temp.rows_seen_by('b'), 1, 'A sees no row, B sees its own');
select is(
  pg_temp.call_as('a', 'aal1', $$ delete from public.push_subscriptions $$),
  'ok 0',
  'A cannot delete B''s row'
);

-- 4. The table's checks: only push services' addresses, a quarter hour, a day of the week, a two-letter language.
select is(pg_temp.save('a', 'https://web.push.apple.com/QGuY9', 1, '08:15'), 'ok 1', 'Apple''s push service is accepted');
select is(pg_temp.save('a', 'https://updates.push.services.mozilla.com/wpush/v2/gAAA', 1, '08:30'), 'ok 1', 'Mozilla''s is accepted');
select is(pg_temp.save('a', 'https://wns2-par02p.notify.windows.com/w/?token=x', 1, '08:45'), 'ok 1', 'Microsoft''s is accepted');
select is(pg_temp.save('a', 'https://evil.example.com/fcm.googleapis.com/x', 7, '18:00'), '23514', 'any other address is refused');
select is(pg_temp.save('a', 'https://fcm.googleapis.com/fcm/send/phone-2', 7, '18:10'), '23514', 'a time that is not a quarter hour is refused');
select is(pg_temp.save('a', 'https://fcm.googleapis.com/fcm/send/phone-2', 8, '18:00'), '23514', 'a day that is not 1 to 7 is refused');

-- 5. An account with two-step sign-in saves only once it gave the code.
select is(pg_temp.save('c', 'https://fcm.googleapis.com/fcm/send/phone-3', 7, '18:00'), '42501', 'C cannot save before the code');
select is(pg_temp.save('c', 'https://fcm.googleapis.com/fcm/send/phone-3', 7, '18:00', 'aal2'), 'ok 1', 'C can, with the code');

-- 6. The rows go with the account.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is_empty(
  $$ select 1 from public.push_subscriptions where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  'deleting A deletes its reminders'
);

select * from finish();
rollback;
