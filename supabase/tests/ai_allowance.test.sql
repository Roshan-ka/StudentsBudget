-- The AI features' daily allowances (the AI phase, chunk 1; migration 20261109125656_ai_allowance.sql, the limits
-- fitted to Groq's free plan in 20261113113428_ai_limits_groq_free.sql). Run with `npm run test:db`. Everything happens
-- in one transaction that is rolled back, so `now()` stays one moment: earlier uses are written straight into the table
-- with older times. Users are played as in hacks.test.sql.
--   A has two-step sign-in. B uses quick add up to its limit. D fills everyone's Ask allowance, which C meets.
--   1 moderates.
-- Sections 1 to 5 read the limits from private.ai_own_limit and private.ai_everyone_limit, so a new limits migration
-- changes only section 6, which holds the numbers in force.

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com'),
  ('00000000-0000-4000-8000-00000000000d', 'd@example.com'),
  ('00000000-0000-4000-8000-000000000001', 'm@example.com');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'phone', 'totp', 'verified', now(), now());

insert into private.moderators (user_id) values ('00000000-0000-4000-8000-000000000001');

-- Plays user `who` at assurance level `aal` until the role is reset; an empty `who` is a token with no user in it.
create function pg_temp.act_as(who text, aal text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    case when who = '' then json_build_object('role', 'authenticated')
         else json_build_object('sub', '00000000-0000-4000-8000-00000000000' || who, 'role', 'authenticated', 'aal', aal)
    end::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;
grant execute on function pg_temp.act_as(text, text) to authenticated, anon;

-- `who` takes one use of `feature`: 'left' and what is left ('left null' for no limit), or the SQLSTATE and the hint.
create function pg_temp.take(who text, aal text, feature text)
returns text
language plpgsql
as $$
declare
  left_over int;
  hint text;
begin
  perform pg_temp.act_as(who, aal);
  select public.take_ai_allowance(feature) into left_over;
  execute 'reset role';
  return 'left ' || coalesce(left_over::text, 'null');
exception when others then
  get stacked diagnostics hint = pg_exception_hint;
  execute 'reset role';
  return sqlstate || coalesce(' ' || nullif(hint, ''), '');
end;
$$;
grant execute on function pg_temp.take(text, text, text) to authenticated, anon;

-- `n` earlier uses of `p_feature` by `p_who`, `ago` before now. (In a SQL function a column wins over a parameter of
-- the same name, so the parameters are named apart.)
create function pg_temp.used(p_who text, p_feature text, n int, ago interval)
returns void
language sql
as $$
  insert into private.ai_uses (user_id, feature, used_at)
  select ('00000000-0000-4000-8000-00000000000' || p_who)::uuid, p_feature, now() - ago from generate_series(1, n);
$$;

-- How many uses of `p_feature` by `p_who` the table holds, of any age.
create function pg_temp.uses_of(p_who text, p_feature text)
returns int
language sql
as $$
  select count(*)::int from private.ai_uses
  where user_id = ('00000000-0000-4000-8000-00000000000' || p_who)::uuid and feature = p_feature;
$$;

-- The limits in force, read as the test's own role (signed in, only take_ai_allowance may call them).
create function pg_temp.own(p_feature text)
returns int
language sql
as $$
  select private.ai_own_limit(p_feature);
$$;

create function pg_temp.everyone(p_feature text)
returns int
language sql
as $$
  select private.ai_everyone_limit(p_feature);
$$;

-- Everyone's uses of `p_feature` in the last 24 hours.
create function pg_temp.used_today(p_feature text)
returns int
language sql
as $$
  select count(*)::int from private.ai_uses where feature = p_feature and used_at > now() - interval '1 day';
$$;

-- 1. Who may ask at all.
select ok(
  has_function_privilege('authenticated', 'public.take_ai_allowance(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.take_ai_allowance(text)', 'EXECUTE'),
  'signed-in users may take an allowance, anon may not'
);
select is(pg_temp.take('', 'aal1', 'ask'), '42501 signed-out', 'a token with no user is refused as signed out');
select is(
  pg_temp.take('a', 'aal1', 'ask'),
  '42501 second-step',
  'an account with two-step sign-in is refused before its code'
);
select is(
  pg_temp.take('a', 'aal2', 'ask'),
  'left ' || (pg_temp.own('ask') - 1),
  'and takes a use once it gave the code'
);
select is(pg_temp.take('b', 'aal1', 'translate'), '22023', 'a feature the app does not have is refused');
select is(pg_temp.uses_of('b', 'translate'), 0, 'and records nothing');

-- 2. One account's own limit, by feature, over the last 24 hours.
do $$ begin perform pg_temp.used('b', 'quick-add', pg_temp.own('quick-add') - 1, '1 hour'); end $$;
do $$ begin perform pg_temp.used('b', 'quick-add', 30, '25 hours'); end $$;
select is(pg_temp.take('b', 'aal1', 'quick-add'), 'left 0', 'the last quick-add line of its 24 hours passes, none left');
select is(pg_temp.take('b', 'aal1', 'quick-add'), 'P0001 daily-limit', 'the next is refused');
select is(
  (select count(*)::int from private.ai_uses
   where user_id = '00000000-0000-4000-8000-00000000000b' and feature = 'quick-add' and used_at > now() - interval '1 day'),
  pg_temp.own('quick-add'),
  'a refused try records nothing; uses older than a day do not count'
);
select is(pg_temp.take('b', 'aal1', 'ask'), 'left ' || (pg_temp.own('ask') - 1), 'another feature has its own allowance');

-- 3. Everyone's limit, on Ask: D's uses bring everyone's to one short of it (A and B asked above).
do $$ begin perform pg_temp.used('d', 'ask', pg_temp.everyone('ask') - pg_temp.used_today('ask') - 1, '1 hour'); end $$;
select is(pg_temp.take('c', 'aal1', 'ask'), 'left ' || (pg_temp.own('ask') - 1), 'the last of everyone''s questions passes');
select is(pg_temp.take('c', 'aal1', 'ask'), 'P0001 busy', 'then everyone''s allowance used up refuses an account that has its own left');
select is(pg_temp.take('c', 'aal1', 'quick-add'), 'left ' || (pg_temp.own('quick-add') - 1), 'other features go on');

-- 4. A moderator has no limit, and every use is still recorded.
do $$ begin perform pg_temp.used('1', 'ask', pg_temp.own('ask'), '1 hour'); end $$;
select is(pg_temp.take('1', 'aal1', 'ask'), 'left null', 'a moderator past its own and everyone''s limit takes a use, with no count');
select is(pg_temp.take('1', 'aal1', 'setup'), 'left null', 'even of a feature that is off for everyone');
select is(pg_temp.uses_of('1', 'ask'), pg_temp.own('ask') + 1, 'the moderator''s use is recorded');

-- 5. Old uses are pruned; nothing signed in reads the table; the uses go with the account.
do $$ begin perform pg_temp.used('c', 'quick-add', 3, '3 days'); end $$;
select is(pg_temp.take('c', 'aal1', 'quick-add'), 'left ' || (pg_temp.own('quick-add') - 2), 'uses three days old never count');
select is(
  (select count(*)::int from private.ai_uses where feature = 'quick-add' and used_at < now() - interval '2 days'),
  0,
  'a take prunes the feature''s uses older than two days'
);
select ok(
  not has_table_privilege('authenticated', 'private.ai_uses', 'SELECT, INSERT, UPDATE, DELETE'),
  'nobody signed in reads or writes the uses'
);
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select is(pg_temp.uses_of('b', 'quick-add') + pg_temp.uses_of('b', 'ask') + pg_temp.uses_of('b', 'setup'), 0, 'deleting the account deletes its uses');

-- 6. The limits in force: Groq's free plan (src/features/ai/server/limits.test.ts reads the same migration).
select is(
  array[pg_temp.own('quick-add'), pg_temp.own('ask'), pg_temp.own('setup')],
  array[30, 6, 0],
  'per account: 30 quick-add lines, 6 questions and no setup chat a day'
);
select is(
  array[pg_temp.everyone('quick-add'), pg_temp.everyone('ask'), pg_temp.everyone('setup')],
  array[120, 36, 0],
  'for everyone: 120 lines, 36 questions and no setup chat a day'
);
select is(pg_temp.take('d', 'aal1', 'setup'), 'P0001 daily-limit', 'a setup chat call is refused before the model, as a daily limit');
select is(pg_temp.uses_of('d', 'setup'), 0, 'and records nothing');

select * from finish();
rollback;
