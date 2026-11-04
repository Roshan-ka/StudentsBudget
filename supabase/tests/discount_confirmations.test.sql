-- Shared discount confirmations (P2.6, migration 20261104142424_discount_confirmations.sql). Run with `npm run test:db`.
-- Everything happens in one transaction that is rolled back. Users are played as in two_step.test.sql.
--   A and B vote on discounts; C, who asks, has a vote whose day isn't a date. d1 has two "still works" (one before the
--   semester), d2 one "doesn't work anymore", d3 a "still works" dated in the future, d4 only a tombstone.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com');

-- Written as the database owner, as a sync would leave them: one row per discount per user, a tombstone with data null.
insert into public.discount_votes (user_id, id, data)
values
  ('00000000-0000-4000-8000-00000000000a', 'd1', '{"discountId": "d1", "vote": "works", "on": "2026-10-30"}'),
  ('00000000-0000-4000-8000-00000000000a', 'd2', '{"discountId": "d2", "vote": "outdated", "on": "2026-10-25"}'),
  ('00000000-0000-4000-8000-00000000000b', 'd1', '{"discountId": "d1", "vote": "works", "on": "2026-09-01"}'),
  ('00000000-0000-4000-8000-00000000000b', 'd3', '{"discountId": "d3", "vote": "works", "on": "2999-01-01"}'),
  ('00000000-0000-4000-8000-00000000000b', 'd4', null),
  ('00000000-0000-4000-8000-00000000000c', 'd5', '{"discountId": "d5", "vote": "works", "on": "04.11.2026"}');

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

-- The totals as C, a signed-in user, gets them.
create function pg_temp.totals_for_c(p_since date)
returns table (discount_id text, last_works date, works_since bigint, outdated_since bigint)
language plpgsql
as $$
begin
  perform pg_temp.act_as('c');
  return query select * from public.discount_confirmations(p_since);
  execute 'reset role';
end;
$$;

-- 1. Only a signed-in user may ask, and the date helper is nobody's to call.
select ok(
  not has_function_privilege('anon', 'public.discount_confirmations(date)', 'EXECUTE'),
  'anon cannot execute discount_confirmations'
);
select ok(
  has_function_privilege('authenticated', 'public.discount_confirmations(date)', 'EXECUTE'),
  'authenticated can execute discount_confirmations'
);
select ok(
  not has_function_privilege('authenticated', 'private.date_or_null(text)', 'EXECUTE'),
  'authenticated cannot execute private.date_or_null'
);

-- 2. Totals only: no user id, no single vote.
select is(
  pg_get_function_result('public.discount_confirmations(date)'::regprocedure),
  'TABLE(discount_id text, last_works date, works_since bigint, outdated_since bigint)',
  'discount_confirmations returns totals per discount and nothing else'
);

-- 3. The totals since the semester began on 01-10-2026: across both voters, tombstones and bad dates left out.
select results_eq(
  $$ select discount_id, works_since, outdated_since from pg_temp.totals_for_c('2026-10-01') $$,
  $$ values ('d1', 1::bigint, 0::bigint), ('d2', 0::bigint, 1::bigint), ('d3', 1::bigint, 0::bigint) $$,
  'counts each kind of vote since the date, across accounts, without tombstones or votes whose day is not a date'
);
select is(
  (select last_works from pg_temp.totals_for_c('2026-10-01') where discount_id = 'd1'),
  '2026-10-30'::date,
  'the last "still works" is the latest of anyone''s, also from before the date'
);
select is(
  (select last_works from pg_temp.totals_for_c('2026-10-01') where discount_id = 'd3'),
  current_date,
  'a "still works" dated in the future counts as today'
);
select ok(
  (select last_works is null from pg_temp.totals_for_c('2026-10-01') where discount_id = 'd2'),
  'a discount only marked as not working has no last "still works"'
);

select * from finish();
rollback;
