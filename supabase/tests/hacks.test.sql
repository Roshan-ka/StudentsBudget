-- The hacks feed's posts, votes, reports and moderation (chunk 3; migration 20261105110007_hacks.sql). Run with
-- `npm run test:db`. Everything happens in one transaction that is rolled back. Users are played as in two_step.test.sql.
--   A (roshan) posts. B to F vote and report. 1 moderates. 2 has two-step sign-in. 3 has no username.

begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

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
  ('00000000-0000-4000-8000-000000000003', 'n@example.com', null);

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

-- Runs `statement` as `who`: 'ok', or the SQLSTATE and the hint it raised.
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

-- A post by `who`, in Regensburg, about food, in English: its id.
create function pg_temp.post_as(who text, body text)
returns uuid
language plpgsql
as $$
declare
  made uuid;
begin
  perform pg_temp.act_as(who, 'aal1');
  made := public.post_hack(body, 'regensburg', 'food', null, 'en');
  execute 'reset role';
  return made;
end;
$$;

-- The post whose text starts with `start`, read as the owner.
create function pg_temp.post_id(start text)
returns uuid
language sql
as $$
  select h.id from public.hacks h where h.body like start || '%';
$$;

-- The feed `who` gets, by the posts' first word.
create function pg_temp.feed_of(who text)
returns table (word text, username text, mine boolean, ups bigint, worked bigint, outdated bigint, my_up boolean, my_verdict text)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.act_as(who, 'aal1');
  return query
    select split_part(f.body, ' ', 1), f.username, f.mine, f.ups, f.worked, f.outdated, f.my_up, f.my_verdict
    from public.hacks_feed() f;
  execute 'reset role';
end;
$$;

-- The moderator's queue, as 1 at aal2, by the posts' first word.
create function pg_temp.queue()
returns table (word text, reports bigint, hidden_by_hand boolean, hidden_by_reports boolean)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.act_as('1', 'aal2');
  return query
    select split_part(q.body, ' ', 1), q.reports_since_kept, q.hidden_by_hand, q.hidden_by_reports
    from public.moderation_queue() q;
  execute 'reset role';
end;
$$;

-- 1. Signed-in users only read their own rows of the three tables, and write none directly; anon gets nothing.
select is_empty(
  $$ select t from unnest(array['hacks', 'hack_votes', 'hack_reports']) t
     where not has_table_privilege('authenticated', 'public.' || t, 'SELECT')
        or has_table_privilege('authenticated', 'public.' || t, 'INSERT')
        or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
        or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
        or has_table_privilege('anon', 'public.' || t, 'SELECT') $$,
  'authenticated may only read hacks, hack_votes and hack_reports; anon not even that'
);
select is_empty(
  $$ select t from unnest(array['hacks', 'hack_votes', 'hack_reports']) t
     where not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = t
                         and p.policyname = 'second step when the account has one' and p.permissive = 'RESTRICTIVE') $$,
  'the three tables have the restrictive second-step policy'
);
select is_empty(
  $$ select f from unnest(array[
       'public.post_hack(text, text, text, text, text)', 'public.delete_hack(uuid)',
       'public.vote_hack(uuid, boolean, text)', 'public.report_hack(uuid)', 'public.hacks_feed()',
       'public.am_i_moderator()', 'public.moderation_queue()', 'public.moderate_hack(uuid, text)'
     ]) f
     where has_function_privilege('anon', f, 'EXECUTE') or not has_function_privilege('authenticated', f, 'EXECUTE') $$,
  'every hacks function is for signed-in users only'
);
select ok(
  not has_table_privilege('authenticated', 'private.moderators', 'SELECT'),
  'nobody signed in reads who moderates'
);

-- 2. The feed and the queue name authors by username, never by user id.
select is(
  pg_get_function_result('public.hacks_feed()'::regprocedure),
  'TABLE(id uuid, body text, city text, category text, link text, lang text, created_at timestamp with time zone, '
    || 'username text, label text, batch smallint, mine boolean, ups bigint, worked bigint, outdated bigint, '
    || 'my_up boolean, my_verdict text)',
  'hacks_feed returns the posts with usernames and totals, and no user id'
);
select ok(
  position('user_id' in pg_get_function_result('public.moderation_queue()'::regprocedure)) = 0,
  'moderation_queue returns no user id'
);

-- 3. Posting: with a username, at most 5 a day, the second step given, and the table's checks.
select isnt(pg_temp.post_as('a', 'Bread is half price after 6 pm at the bakery'), null, 'A posts');
select isnt(pg_temp.post_as('a', 'Mensa dessert is free on Fridays before 2 pm'), null, 'A posts again');
select isnt(pg_temp.post_as('a', 'Library lockers cost nothing with the student card'), null, 'A posts a third');
select is(
  pg_temp.call_as('3', 'aal1', $$ select public.post_hack('Somebody without a name posts this', 'anywhere', 'food', null, 'en') $$),
  'P0001 needs-username',
  'an account without a username cannot post'
);
select is(
  pg_temp.call_as('2', 'aal1', $$ select public.post_hack('Two-step accounts need their code first', 'anywhere', 'food', null, 'en') $$),
  '42501',
  'an account with two-step sign-in cannot post before giving its code'
);
select is(
  pg_temp.call_as('2', 'aal2', $$ select public.post_hack('Two-step accounts post once the code is in', 'anywhere', 'study', null, 'de') $$),
  'ok',
  'with the code given, it can'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_hack('cheap', 'regensburg', 'food', null, 'en') $$),
  '23514',
  'a text shorter than 10 characters is refused'
);
select is(
  pg_temp.call_as('b', 'aal1', $$ select public.post_hack('A link that is not https is refused', 'regensburg', 'food', 'http://x.de', 'en') $$),
  '23514',
  'a link that is not https is refused'
);
insert into public.hacks (user_id, body, city, category, lang)
select '00000000-0000-4000-8000-00000000000d', 'Dana posted this already, number ' || n, 'anywhere', 'food', 'en'
from generate_series(1, 5) n;
select is(
  pg_temp.call_as('d', 'aal1', $$ select public.post_hack('A sixth post on the same day', 'anywhere', 'food', null, 'en') $$),
  'P0001 daily-limit',
  'a sixth post within a day is refused'
);
-- The SQLSTATE alone: a permission error comes with PostgreSQL's own hint on which grant is missing.
select is(
  left(pg_temp.call_as('b', 'aal1', $$ insert into public.hacks (body, city, category, lang) values ('Written around the functions', 'anywhere', 'food', 'en') $$), 5),
  '42501',
  'nobody writes the table directly'
);

-- 4. Votes: totals for everyone, one's own vote for oneself, none on one's own post.
select is(
  pg_temp.call_as('b', 'aal1', format('select public.vote_hack(%L, true, %L)', pg_temp.post_id('Bread'), 'worked')),
  'ok',
  'B upvotes the bread post and says it worked'
);
select is(
  pg_temp.call_as('c', 'aal1', format('select public.vote_hack(%L, false, %L)', pg_temp.post_id('Bread'), 'outdated')),
  'ok',
  'C says it is outdated'
);
select is(
  pg_temp.call_as('a', 'aal1', format('select public.vote_hack(%L, true, null)', pg_temp.post_id('Bread'))),
  'P0001 own-post',
  'A cannot vote on its own post'
);
select is(
  pg_temp.call_as('b', 'aal1', format('select public.vote_hack(%L, true, %L)', pg_temp.post_id('Bread'), 'great')),
  '23514',
  'a verdict that is not worked or outdated is refused'
);
select results_eq(
  $$ select username, mine, ups, worked, outdated, my_up, my_verdict from pg_temp.feed_of('b') where word = 'Bread' $$,
  $$ values ('roshan'::text, false, 1::bigint, 1::bigint, 1::bigint, true, 'worked'::text) $$,
  'B sees the totals, its own vote, and the author by username'
);
select results_eq(
  $$ select mine, my_up, my_verdict from pg_temp.feed_of('a') where word = 'Bread' $$,
  $$ values (true, false, null::text) $$,
  'A sees the post as its own'
);

-- 5. Reports: gone for the reporter at once, for everyone at 5 since the moderator last kept it.
select is(
  pg_temp.call_as('b', 'aal1', format('select public.report_hack(%L)', pg_temp.post_id('Mensa'))),
  'ok',
  'B reports the Mensa post'
);
select is(
  (select count(*)::int from pg_temp.feed_of('b') where word = 'Mensa') * 10
    + (select count(*)::int from pg_temp.feed_of('c') where word = 'Mensa'),
  1,
  'it leaves B''s feed and stays in C''s'
);
select is(
  pg_temp.call_as('a', 'aal1', format('select public.report_hack(%L)', pg_temp.post_id('Mensa'))),
  'P0001 own-post',
  'A cannot report its own post'
);
select is(
  (select string_agg(pg_temp.call_as(who, 'aal1', format('select public.report_hack(%L)', pg_temp.post_id('Library'))), ',')
   from unnest(array['b', 'c', 'd', 'e', 'f', 'b']) who),
  'ok,ok,ok,ok,ok,ok',
  'five accounts report the Library post, and a second report by B changes nothing'
);
select is(
  (select count(*)::int from pg_temp.feed_of('a') where word = 'Library'),
  0,
  'five reports hide it for everyone, its author too'
);

-- 6. Moderation: the moderator alone, with the code given.
select is(
  pg_temp.call_as('1', 'aal1', 'select public.moderation_queue()'),
  '42501',
  'the moderator needs the code even without two-step sign-in set up'
);
select is(
  pg_temp.call_as('b', 'aal2', 'select public.moderation_queue()'),
  '42501',
  'someone who does not moderate gets no queue'
);
select results_eq(
  $$ select word, reports, hidden_by_hand, hidden_by_reports from pg_temp.queue() order by word $$,
  $$ values ('Library'::text, 5::bigint, false, true), ('Mensa', 1::bigint, false, false) $$,
  'the queue lists the reported posts, with what hides them'
);
-- The decisions are the moderator's alone too (the role matrix, e2e-real/roles/matrix.json, names these checks).
select is(
  left(pg_temp.call_as('b', 'aal2', format('select public.moderate_hack(%L, %L)', pg_temp.post_id('Mensa'), 'hide')), 5),
  '42501',
  'someone who does not moderate cannot hide a post'
);
select is(
  left(pg_temp.call_as('1', 'aal1', format('select public.moderate_hack(%L, %L)', pg_temp.post_id('Mensa'), 'hide')), 5),
  '42501',
  'the moderator cannot hide a post without the code'
);
select is(
  pg_temp.call_as('1', 'aal2', format('select public.moderate_hack(%L, %L)', pg_temp.post_id('Library'), 'keep')),
  'ok',
  'the moderator keeps the Library post'
);
select is(
  (select count(*)::int from pg_temp.feed_of('a') where word = 'Library') * 10
    + (select count(*)::int from pg_temp.feed_of('b') where word = 'Library'),
  10,
  'kept, it is back for its author, while B, who reported it, still does not see it'
);
-- Each change in its own statement: the order inside one expression isn't guaranteed.
select is(
  pg_temp.call_as('1', 'aal2', format('select public.moderate_hack(%L, %L)', pg_temp.post_id('Bread'), 'hide')),
  'ok',
  'the moderator hides the bread post'
);
select is(
  (select count(*)::int from pg_temp.feed_of('c') where word = 'Bread'),
  0,
  'hidden by the moderator, a post leaves every feed'
);

-- 7. Deleting: one's own posts only; the row goes with the account.
select is(
  pg_temp.call_as('b', 'aal1', format('select public.delete_hack(%L)', pg_temp.post_id('Mensa'))),
  'P0001 not-found',
  'B cannot delete A''s post'
);
select is(
  pg_temp.call_as('a', 'aal1', format('select public.delete_hack(%L)', pg_temp.post_id('Mensa'))),
  'ok',
  'A deletes its own post'
);
select is(
  (select count(*)::int from pg_temp.feed_of('c') where word = 'Mensa'),
  0,
  'a deleted post leaves every feed'
);
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
select is_empty(
  $$ select 1 from public.hacks where user_id = '00000000-0000-4000-8000-00000000000a'
     union all
     select 1 from public.hack_votes v where not exists (select 1 from public.hacks h where h.id = v.hack_id) $$,
  'deleting A deletes its posts and every vote on them'
);

select * from finish();
rollback;
