-- Discounts added from the app (community, chunk 4; migration 20261111101604_community_discounts.sql), and their
-- positions (discount map, chunk 7; 20261111151901_discount_positions.sql). Run with `npm run test:db`. Everything happens in one transaction that is rolled back. Users are played as in hacks.test.sql.
--   A (roshan) adds discounts. B votes. C, D, E, F and 4 report. 1 moderates. 2 has two-step sign-in. 3 has no
--   username.

begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com', '{"username": "roshan", "label": "student", "batch": "2027"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com', '{"username": "bea"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@example.com', '{"username": "cem"}'),
  ('00000000-0000-4000-8000-00000000000d', 'd@example.com', '{"username": "dana"}'),
  ('00000000-0000-4000-8000-00000000000e', 'e@example.com', '{"username": "emil"}'),
  ('00000000-0000-4000-8000-00000000000f', 'f@example.com', '{"username": "fay"}'),
  ('00000000-0000-4000-8000-000000000001', 'm@example.com', '{"username": "mod_one"}'),
  ('00000000-0000-4000-8000-000000000002', 't@example.com', '{"username": "two_step"}'),
  ('00000000-0000-4000-8000-000000000003', 'n@example.com', null),
  ('00000000-0000-4000-8000-000000000004', 'v@example.com', '{"username": "vic"}');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'phone', 'totp', 'verified', now(), now());

insert into private.moderators (user_id) values ('00000000-0000-4000-8000-000000000001');

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

-- Runs `statement` as `who`: 'ok', or the SQLSTATE and the hint it raised. Everything the statement names is worked
-- out before the call, as the test's owner (as `who`, row-level security hides other accounts' rows).
create function pg_temp.call_as(who text, aal text, statement text)
returns text
language plpgsql
as $$
declare
  hint text;
begin
  perform pg_temp.act_as(who, aal);
  execute statement;
  execute 'reset role';
  return 'ok';
exception when others then
  get stacked diagnostics hint = pg_exception_hint;
  execute 'reset role';
  return sqlstate || coalesce(' ' || nullif(hint, ''), '');
end;
$$;

-- `who` adds a discount at `place` with `offer`, at aal1: its id.
create function pg_temp.add_as(who text, place text, offer text)
returns uuid
language plpgsql
as $$
declare
  made uuid;
begin
  perform pg_temp.act_as(who, 'aal1');
  made := public.post_discount(place, '', offer, '  ', 'food', 'https://www.example.de/offer', 'en');
  execute 'reset role';
  return made;
end;
$$;

-- The discount at the place starting with `start`, read as the owner.
create function pg_temp.discount_id(start text)
returns uuid
language sql
as $$
  select d.id from public.community_discounts d where d.place like start || '%';
$$;

-- The list `who` gets: place, username and whether it is theirs, in the order given.
create function pg_temp.feed_of(who text)
returns table (n bigint, place text, username text, mine boolean)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.act_as(who, 'aal1');
  return query
    select row_number() over (), f.place, f.username, f.mine from public.community_discounts_feed() f;
  execute 'reset role';
end;
$$;

-- The positions in the list `who` gets, by place.
create function pg_temp.positions_of(who text)
returns table (place text, lat double precision, lng double precision)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.act_as(who, 'aal1');
  return query select f.place, f.lat, f.lng from public.community_discounts_feed() f;
  execute 'reset role';
end;
$$;

-- The moderator's queue, as 1 at aal2, by place.
create function pg_temp.queue()
returns table (place text, reports bigint, hidden_by_hand boolean, hidden_by_reports boolean)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.act_as('1', 'aal2');
  return query
    select q.place, q.reports_since_kept, q.hidden_by_hand, q.hidden_by_reports from public.discount_queue() q;
  execute 'reset role';
end;
$$;

-- 1. Signed-in users only read their own rows of the two tables, and write none directly; anon gets nothing.
select is_empty(
  $$ select t from unnest(array['community_discounts', 'community_discount_reports']) t
     where not has_table_privilege('authenticated', 'public.' || t, 'SELECT')
        or has_table_privilege('authenticated', 'public.' || t, 'INSERT')
        or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
        or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
        or has_table_privilege('anon', 'public.' || t, 'SELECT') $$,
  'authenticated may only read community_discounts and its reports; anon not even that'
);
select is_empty(
  $$ select t from unnest(array['community_discounts', 'community_discount_reports']) t
     where not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = t
                         and p.policyname = 'second step when the account has one' and p.permissive = 'RESTRICTIVE') $$,
  'the two tables have the restrictive second-step policy'
);
select is_empty(
  $$ select f from unnest(array[
       'public.post_discount(text, text, text, text, text, text, text, double precision, double precision)',
       'public.delete_discount(uuid)',
       'public.report_discount(uuid)', 'public.community_discounts_feed()', 'public.discount_queue()',
       'public.moderate_discount(uuid, text)'
     ]) f
     where has_function_privilege('anon', f, 'EXECUTE') or not has_function_privilege('authenticated', f, 'EXECUTE') $$,
  'every discount function is for signed-in users only'
);
select ok(
  not has_function_privilege('authenticated', 'private.discount_visible(uuid, uuid)', 'EXECUTE'),
  'nobody signed in runs the visibility helper directly'
);

-- 2. The list and the queue name authors by username, never by user id.
select is(
  pg_get_function_result('public.community_discounts_feed()'::regprocedure),
  'TABLE(id uuid, place text, address text, offer text, conditions text, category text, link text, lang text, '
    || 'created_at timestamp with time zone, username text, label text, batch smallint, mine boolean, '
    || 'lat double precision, lng double precision)',
  'community_discounts_feed returns the discounts with usernames and positions, and no user id'
);
select ok(
  position('user_id' in pg_get_function_result('public.discount_queue()'::regprocedure)) = 0,
  'discount_queue returns no user id'
);

-- 3. Adding: with a username, at most 3 a day, the second step given, a source link, and the table's checks.
select isnt(pg_temp.add_as('a', 'Bakery Kappl', '10% off bread for students'), null, 'A adds a discount');
select results_eq(
  $$ select address, conditions, city from public.community_discounts where place = 'Bakery Kappl' $$,
  $$ values (null::text, null::text, 'regensburg'::text) $$,
  'an empty address and conditions are left out, and the city is Regensburg'
);
select isnt(pg_temp.add_as('a', 'Gym Sportpark', 'No joining fee for students'), null, 'A adds a second');
select is(
  pg_temp.call_as('3', 'aal1', $$ select public.post_discount('Some shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en') $$),
  'P0001 needs-username',
  'an account without a username cannot add one'
);
select is(
  pg_temp.call_as('2', 'aal1', $$ select public.post_discount('Some shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en') $$),
  '42501',
  'an account with two-step sign-in cannot add one before giving its code'
);
select is(
  pg_temp.call_as('2', 'aal2', $$ select public.post_discount('Twostep Cafe', null, 'Free refill with a student ID', null, 'eating-out', 'https://x.de', 'de') $$),
  'ok',
  'with the code given, it can'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_discount('X', null, 'Ten percent off', null, 'food', 'https://x.de', 'en') $$),
  '23514',
  'a place shorter than 2 characters is refused'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_discount('Some shop', null, 'Ten percent off', null, 'food', 'http://x.de', 'en') $$),
  '23514',
  'a link that is not https is refused'
);
select is(
  left(pg_temp.call_as('b', 'aal1', $$ select public.post_discount('Some shop', null, 'Ten percent off', null, 'food', null, 'en') $$), 5),
  '23502',
  'a discount without a source link is refused'
);
insert into public.community_discounts (user_id, place, offer, category, link, lang)
select '00000000-0000-4000-8000-00000000000d', 'Dana shop ' || n, 'Five percent off', 'food', 'https://x.de', 'en'
from generate_series(1, 3) n;
select is(
  pg_temp.call_as('d', 'aal1', $$ select public.post_discount('A fourth shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en') $$),
  'P0001 daily-limit',
  'a fourth discount within a day is refused'
);
-- The SQLSTATE alone: a permission error comes with PostgreSQL's own hint on which grant is missing.
select is(
  left(pg_temp.call_as('b', 'aal1', $$ insert into public.community_discounts (place, offer, category, link, lang) values ('Around', 'The functions', 'food', 'https://x.de', 'en') $$), 5),
  '42501',
  'nobody writes the table directly'
);

-- 4. Reading: newest first, by username, one's own marked. One transaction keeps now() still: times of their own.
update public.community_discounts set created_at = now() - interval '3 minutes' where place = 'Bakery Kappl';
update public.community_discounts set created_at = now() - interval '2 minutes' where place = 'Gym Sportpark';
update public.community_discounts set created_at = now() - interval '1 minute' where place = 'Twostep Cafe';
update public.community_discounts set created_at = now() - interval '1 hour' where place like 'Dana shop%';
select results_eq(
  $$ select place, username, mine from pg_temp.feed_of('c') where place not like 'Dana%' order by n $$,
  $$ values ('Twostep Cafe'::text, 'two_step'::text, false), ('Gym Sportpark'::text, 'roshan'::text, false),
            ('Bakery Kappl'::text, 'roshan'::text, false) $$,
  'C sees the discounts newest first, by username'
);
select results_eq(
  $$ select mine from pg_temp.feed_of('a') where place = 'Bakery Kappl' $$,
  $$ values (true) $$,
  'A sees its own discount as its own'
);

-- 5. Votes on a submitted discount count across accounts, as on the app's own: by its id.
insert into public.discount_votes (user_id, id, data)
values (
  '00000000-0000-4000-8000-00000000000b',
  pg_temp.discount_id('Bakery')::text,
  json_build_object('discountId', pg_temp.discount_id('Bakery')::text, 'vote', 'works', 'on', current_date::text)::jsonb
);
select results_eq(
  format(
    $$ select works_since, outdated_since from public.discount_confirmations(current_date - 30) where discount_id = %L $$,
    pg_temp.discount_id('Bakery')::text
  ),
  $$ values (1::bigint, 0::bigint) $$,
  'discount_confirmations counts B''s "still works" on A''s discount'
);

-- 6. Reports: gone for the reporter at once, for everyone at 5 since the moderator last kept it.
select is(
  pg_temp.call_as('a', 'aal1', format('select public.report_discount(%L)', pg_temp.discount_id('Gym'))),
  'P0001 own-post',
  'A cannot report its own discount'
);
select is(
  pg_temp.call_as('c', 'aal1', format('select public.report_discount(%L)', pg_temp.discount_id('Gym'))),
  'ok',
  'C reports the gym discount'
);
select is(
  (select count(*)::int from pg_temp.feed_of('c') where place = 'Gym Sportpark'),
  0,
  'C no longer sees the discount it reported'
);
select is(
  (select count(*)::int from pg_temp.feed_of('b') where place = 'Gym Sportpark'),
  1,
  'one report hides it for the reporter only'
);
-- In a DO block: a plain select would print 'ok' rows among the test's own lines.
do $$
begin
  perform pg_temp.call_as(who, 'aal1', format('select public.report_discount(%L)', pg_temp.discount_id('Gym')))
  from unnest(array['d', 'e', 'f', '4']) who;
end;
$$;
select is(
  (select count(*)::int from pg_temp.feed_of('a') where place = 'Gym Sportpark'),
  0,
  'five reports hide it for everyone, its author too'
);

-- 7. Moderation: the queue and the decisions, for a moderator with the code given.
select is(
  left(pg_temp.call_as('a', 'aal2', 'select * from public.discount_queue()'), 5),
  '42501',
  'someone who does not moderate gets no queue'
);
select is(
  left(pg_temp.call_as('1', 'aal1', 'select * from public.discount_queue()'), 5),
  '42501',
  'the moderator needs the code first'
);
select results_eq(
  $$ select place, reports, hidden_by_hand, hidden_by_reports from pg_temp.queue() $$,
  $$ values ('Gym Sportpark'::text, 5::bigint, false, true) $$,
  'the queue holds the reported discount, hidden by reports'
);
-- The decisions are the moderator's alone too (the role matrix, e2e-real/roles/matrix.json, names these checks).
select is(
  left(pg_temp.call_as('a', 'aal2', format('select public.moderate_discount(%L, %L)', pg_temp.discount_id('Gym'), 'hide')), 5),
  '42501',
  'someone who does not moderate cannot hide a discount'
);
select is(
  left(pg_temp.call_as('1', 'aal1', format('select public.moderate_discount(%L, %L)', pg_temp.discount_id('Gym'), 'hide')), 5),
  '42501',
  'the moderator cannot hide a discount without the code'
);
select is(
  pg_temp.call_as('1', 'aal2', format('select public.moderate_discount(%L, %L)', pg_temp.discount_id('Gym'), 'keep')),
  'ok',
  'the moderator keeps it'
);
select results_eq(
  $$ select (select count(*)::int from pg_temp.feed_of('a') where place = 'Gym Sportpark'),
            (select count(*)::int from pg_temp.feed_of('c') where place = 'Gym Sportpark') $$,
  $$ values (1, 0) $$,
  'kept, it is back for A, while C, who reported it, still does not see it'
);
select is(
  pg_temp.call_as('1', 'aal2', format('select public.moderate_discount(%L, %L)', pg_temp.discount_id('Gym'), 'hide')),
  'ok',
  'the moderator hides it'
);

-- 8. Deleting: one's own discounts only.
select is(
  pg_temp.call_as('c', 'aal1', format('select public.delete_discount(%L)', pg_temp.discount_id('Bakery'))),
  'P0001 not-found',
  'C cannot delete A''s discount'
);
select is(
  pg_temp.call_as('a', 'aal1', format('select public.delete_discount(%L)', pg_temp.discount_id('Bakery'))),
  'ok',
  'A deletes its own discount'
);
select results_eq(
  $$ select place from pg_temp.feed_of('b') where place not like 'Dana%' order by n $$,
  $$ values ('Twostep Cafe'::text) $$,
  'a deleted and a hidden discount leave the list'
);

-- 9. Positions (discount map, chunk 7): optional, both or neither, inside the box the map covers.
select hasnt_function(
  'public', 'post_discount', array['text', 'text', 'text', 'text', 'text', 'text', 'text'],
  'the 7-argument post_discount is gone, so a call has one function to match'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_discount('Pinned shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en', 49.01936, 12.08965) $$),
  'ok',
  'B adds a discount with a position'
);
select results_eq(
  $$ select place, lat, lng from pg_temp.positions_of('c') where place in ('Pinned shop', 'Twostep Cafe') order by place $$,
  $$ values ('Pinned shop'::text, 49.01936::double precision, 12.08965::double precision),
            ('Twostep Cafe'::text, null::double precision, null::double precision) $$,
  'the list gives a pinned discount its position, and one without a pin none'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_discount('Half shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en', 49.01936, null) $$),
  '23514',
  'half a position is refused'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_discount('Munich shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en', 48.13743, 11.57549) $$),
  '23514',
  'a position outside Regensburg''s box is refused'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_discount('Edge shop', null, 'Ten percent off', null, 'food', 'https://x.de', 'en', 49.02, 12.21) $$),
  '23514',
  'a position just east of the box is refused'
);

-- 10. A discount and its reports go with the account that made them.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is_empty(
  $$ select 1 from public.community_discounts where user_id = '00000000-0000-4000-8000-00000000000a'
     union all
     select 1 from public.community_discount_reports r
     where not exists (select 1 from public.community_discounts d where d.id = r.discount_id) $$,
  'deleting A deletes its discounts and every report on them'
);

select * from finish();
rollback;
