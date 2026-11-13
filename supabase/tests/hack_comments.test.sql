-- Comments on hacks (community, chunk 1; migration 20261111092551_hack_comments.sql). Run with `npm run test:db`.
-- Everything happens in one transaction that is rolled back. Users are played as in hacks.test.sql.
--   A (roshan) wrote the posts. B comments; C, D, E, F and 4 report. 1 moderates. 2 has two-step sign-in. 3 has no
--   username.

begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

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

-- A's posts, written straight into the table: one to comment on, one for Dana's comments, one the moderator hid and
-- one A deleted.
insert into public.hacks (user_id, body, city, category, lang, hidden_at, deleted_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'Bread is half price after 6 pm at the bakery', 'regensburg', 'food', 'en', null, null),
  ('00000000-0000-4000-8000-00000000000a', 'Mensa dessert is free on Fridays before 2 pm', 'regensburg', 'food', 'en', null, null),
  ('00000000-0000-4000-8000-00000000000a', 'Hidden post the moderator took out of the feed', 'anywhere', 'food', 'en', now(), null),
  ('00000000-0000-4000-8000-00000000000a', 'Gone post that its author deleted again', 'anywhere', 'food', 'en', null, now());

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

-- The post whose text starts with `start`, read as the owner.
create function pg_temp.post_id(start text)
returns uuid
language sql
as $$
  select h.id from public.hacks h where h.body like start || '%';
$$;

-- The comment whose text starts with `start`, read as the owner.
create function pg_temp.comment_id(start text)
returns uuid
language sql
as $$
  select c.id from public.hack_comments c where c.body like start || '%';
$$;

-- `who` comments `body` on the post starting with `post`, at aal1: the comment's id. The post is looked up first: as
-- `who`, row-level security would hide another account's post.
create function pg_temp.comment_as(who text, post text, body text)
returns uuid
language plpgsql
as $$
declare
  hack uuid := pg_temp.post_id(post);
  made uuid;
begin
  perform pg_temp.act_as(who, 'aal1');
  made := public.post_comment(hack, body, 'en');
  execute 'reset role';
  return made;
end;
$$;

-- The comments `who` sees on the post starting with `post`, by their first word, in the order given (the post looked
-- up first, as in comment_as).
create function pg_temp.comments_of(who text, post text)
returns table (n bigint, word text, username text, mine boolean)
language plpgsql
as $$
#variable_conflict use_column
declare
  hack uuid := pg_temp.post_id(post);
begin
  perform pg_temp.act_as(who, 'aal1');
  return query
    select row_number() over (), split_part(c.body, ' ', 1), c.username, c.mine
    from public.comments_for(hack) c;
  execute 'reset role';
end;
$$;

-- The comment counts `who` sees, by the posts' first word: read as `who`, then named as the owner (as `who`, row-level
-- security would hide another account's posts).
create function pg_temp.counts_of(who text)
returns table (word text, comments bigint)
language plpgsql
as $$
#variable_conflict use_column
declare
  got jsonb;
begin
  perform pg_temp.act_as(who, 'aal1');
  select coalesce(jsonb_agg(jsonb_build_object('hack', k.hack_id, 'n', k.comments)), '[]'::jsonb) into got
  from public.comment_counts() k;
  execute 'reset role';
  return query
    select split_part(h.body, ' ', 1), (e ->> 'n')::bigint
    from jsonb_array_elements(got) e join public.hacks h on h.id = (e ->> 'hack')::uuid
    order by 1;
end;
$$;

-- The moderator's queue, as 1 at aal2, by the comments' first word.
create function pg_temp.queue()
returns table (word text, reports bigint, hidden_by_hand boolean, hidden_by_reports boolean)
language plpgsql
as $$
#variable_conflict use_column
begin
  perform pg_temp.act_as('1', 'aal2');
  return query
    select split_part(q.body, ' ', 1), q.reports_since_kept, q.hidden_by_hand, q.hidden_by_reports
    from public.comment_queue() q;
  execute 'reset role';
end;
$$;

-- 1. Signed-in users only read their own rows of the two tables, and write none directly; anon gets nothing.
select is_empty(
  $$ select t from unnest(array['hack_comments', 'hack_comment_reports']) t
     where not has_table_privilege('authenticated', 'public.' || t, 'SELECT')
        or has_table_privilege('authenticated', 'public.' || t, 'INSERT')
        or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
        or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
        or has_table_privilege('anon', 'public.' || t, 'SELECT') $$,
  'authenticated may only read hack_comments and hack_comment_reports; anon not even that'
);
select is_empty(
  $$ select t from unnest(array['hack_comments', 'hack_comment_reports']) t
     where not exists (select 1 from pg_policies p
                       where p.schemaname = 'public' and p.tablename = t
                         and p.policyname = 'second step when the account has one' and p.permissive = 'RESTRICTIVE') $$,
  'the two tables have the restrictive second-step policy'
);
select is_empty(
  $$ select f from unnest(array[
       'public.post_comment(uuid, text, text)', 'public.delete_comment(uuid)', 'public.report_comment(uuid)',
       'public.comments_for(uuid)', 'public.comment_counts()', 'public.comment_queue()',
       'public.moderate_comment(uuid, text)'
     ]) f
     where has_function_privilege('anon', f, 'EXECUTE') or not has_function_privilege('authenticated', f, 'EXECUTE') $$,
  'every comment function is for signed-in users only'
);
select ok(
  not has_function_privilege('authenticated', 'private.post_visible(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.comment_visible(uuid, uuid)', 'EXECUTE'),
  'nobody signed in runs the visibility helpers directly'
);

-- 2. The lists name authors by username, never by user id.
select is(
  pg_get_function_result('public.comments_for(uuid)'::regprocedure),
  'TABLE(id uuid, body text, lang text, created_at timestamp with time zone, username text, label text, '
    || 'batch smallint, mine boolean)',
  'comments_for returns the comments with usernames, and no user id'
);
select is(
  pg_get_function_result('public.comment_counts()'::regprocedure),
  'TABLE(hack_id uuid, comments bigint)',
  'comment_counts returns a count per post'
);
select ok(
  position('user_id' in pg_get_function_result('public.comment_queue()'::regprocedure)) = 0,
  'comment_queue returns no user id'
);

-- 3. Commenting: with a username, on a post one may see, at most 20 a day, the second step given, and the checks.
select isnt(pg_temp.comment_as('b', 'Bread', 'Good tip, thanks for sharing'), null, 'B comments on the bread post');
select isnt(pg_temp.comment_as('a', 'Bread', 'Author here: it works every day'), null, 'A comments on its own post');
select is(
  pg_temp.call_as('3', 'aal1', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Bread'), 'No name yet', 'en')),
  'P0001 needs-username',
  'an account without a username cannot comment'
);
select is(
  pg_temp.call_as('2', 'aal1', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Bread'), 'Before the code', 'en')),
  '42501',
  'an account with two-step sign-in cannot comment before giving its code'
);
select is(
  pg_temp.call_as('2', 'aal2', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Bread'), 'Twostep says it works', 'de')),
  'ok',
  'with the code given, it can'
);
select is(
  pg_temp.call_as('b', 'aal1', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Bread'), 'ok', 'en')),
  '23514',
  'a comment shorter than 3 characters is refused'
);
select is(
  pg_temp.call_as('b', 'aal1', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Hidden'), 'On a hidden post', 'en')),
  'P0001 not-found',
  'no comment on a post the moderator hid'
);
select is(
  pg_temp.call_as('b', 'aal1', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Gone'), 'On a deleted post', 'en')),
  'P0001 not-found',
  'no comment on a deleted post'
);
insert into public.hack_comments (hack_id, user_id, body, lang)
select pg_temp.post_id('Mensa'), '00000000-0000-4000-8000-00000000000d', 'Dana comment number ' || n, 'en'
from generate_series(1, 20) n;
select is(
  pg_temp.call_as('d', 'aal1', format('select public.post_comment(%L, %L, %L)', pg_temp.post_id('Mensa'), 'A 21st today', 'en')),
  'P0001 daily-limit',
  'a 21st comment within a day is refused'
);
-- The SQLSTATE alone: a permission error comes with PostgreSQL's own hint on which grant is missing.
select is(
  left(pg_temp.call_as('b', 'aal1', format('insert into public.hack_comments (hack_id, body, lang) values (%L, %L, %L)', pg_temp.post_id('Bread'), 'Written around the functions', 'en')), 5),
  '42501',
  'nobody writes the table directly'
);

-- 4. Reading: oldest first, by username, one's own marked; counts per post; nothing on a post one may not see.
-- Everything here runs in one transaction, where now() never moves: the three comments get times of their own.
update public.hack_comments set created_at = now() - interval '3 minutes' where body like 'Good%';
update public.hack_comments set created_at = now() - interval '2 minutes' where body like 'Author%';
update public.hack_comments set created_at = now() - interval '1 minute' where body like 'Twostep%';
select results_eq(
  $$ select word, username, mine from pg_temp.comments_of('c', 'Bread') order by n $$,
  $$ values ('Good'::text, 'bea'::text, false), ('Author'::text, 'roshan'::text, false), ('Twostep'::text, 'two_step'::text, false) $$,
  'C sees the three comments on the bread post, oldest first, by username'
);
select results_eq(
  $$ select mine from pg_temp.comments_of('b', 'Bread') where word = 'Good' $$,
  $$ values (true) $$,
  'B sees its own comment as its own'
);
select results_eq(
  $$ select word, comments from pg_temp.counts_of('c') $$,
  $$ values ('Bread'::text, 3::bigint), ('Mensa'::text, 20::bigint) $$,
  'comment_counts gives each visible post its visible comments'
);
select is(
  (select count(*)::int from pg_temp.comments_of('c', 'Hidden')),
  0,
  'a hidden post shows no comments'
);

-- 5. Reports: gone for the reporter at once, for everyone at 5 since the moderator last kept it.
select is(
  pg_temp.call_as('b', 'aal1', format('select public.report_comment(%L)', pg_temp.comment_id('Good'))),
  'P0001 own-post',
  'B cannot report its own comment'
);
select is(
  pg_temp.call_as('c', 'aal1', format('select public.report_comment(%L)', pg_temp.comment_id('Good'))),
  'ok',
  'C reports B''s comment'
);
select is(
  (select count(*)::int from pg_temp.comments_of('c', 'Bread') where word = 'Good'),
  0,
  'C no longer sees the comment it reported'
);
select is(
  (select count(*)::int from pg_temp.comments_of('a', 'Bread') where word = 'Good'),
  1,
  'one report hides it for the reporter only'
);
-- In a DO block: a plain select would print 'ok' rows among the test's own lines.
do $$
begin
  perform pg_temp.call_as(who, 'aal1', format('select public.report_comment(%L)', pg_temp.comment_id('Good')))
  from unnest(array['d', 'e', 'f', '4']) who;
end;
$$;
select is(
  (select count(*)::int from pg_temp.comments_of('a', 'Bread') where word = 'Good'),
  0,
  'five reports hide it for everyone'
);

-- 6. Moderation: the queue and the decisions, for a moderator with the code given.
select is(
  left(pg_temp.call_as('a', 'aal2', 'select * from public.comment_queue()'), 5),
  '42501',
  'someone who does not moderate gets no queue'
);
select is(
  left(pg_temp.call_as('1', 'aal1', 'select * from public.comment_queue()'), 5),
  '42501',
  'the moderator needs the code first'
);
select results_eq(
  $$ select word, reports, hidden_by_hand, hidden_by_reports from pg_temp.queue() $$,
  $$ values ('Good'::text, 5::bigint, false, true) $$,
  'the queue holds the reported comment, hidden by reports'
);
-- The decisions are the moderator's alone too (the role matrix, e2e-real/roles/matrix.json, names these checks).
select is(
  left(pg_temp.call_as('a', 'aal2', format('select public.moderate_comment(%L, %L)', pg_temp.comment_id('Good'), 'hide')), 5),
  '42501',
  'someone who does not moderate cannot hide a comment'
);
select is(
  left(pg_temp.call_as('1', 'aal1', format('select public.moderate_comment(%L, %L)', pg_temp.comment_id('Good'), 'hide')), 5),
  '42501',
  'the moderator cannot hide a comment without the code'
);
select is(
  pg_temp.call_as('1', 'aal2', format('select public.moderate_comment(%L, %L)', pg_temp.comment_id('Good'), 'keep')),
  'ok',
  'the moderator keeps it'
);
select results_eq(
  $$ select (select count(*)::int from pg_temp.comments_of('a', 'Bread') where word = 'Good'),
            (select count(*)::int from pg_temp.comments_of('c', 'Bread') where word = 'Good') $$,
  $$ values (1, 0) $$,
  'kept, it is back for A, while C, who reported it, still does not see it'
);
select is(
  pg_temp.call_as('1', 'aal2', format('select public.moderate_comment(%L, %L)', pg_temp.comment_id('Good'), 'hide')),
  'ok',
  'the moderator hides it'
);

-- 7. Deleting: one's own comments only.
select is(
  pg_temp.call_as('c', 'aal1', format('select public.delete_comment(%L)', pg_temp.comment_id('Author'))),
  'P0001 not-found',
  'C cannot delete A''s comment'
);
select is(
  pg_temp.call_as('a', 'aal1', format('select public.delete_comment(%L)', pg_temp.comment_id('Author'))),
  'ok',
  'A deletes its own comment'
);
select results_eq(
  $$ select word from pg_temp.comments_of('d', 'Bread') order by n $$,
  $$ values ('Twostep'::text) $$,
  'a deleted and a hidden comment leave the list'
);

-- 8. A comment and its reports go with the account that made them.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select is_empty(
  $$ select 1 from public.hack_comments where user_id = '00000000-0000-4000-8000-00000000000b'
     union all
     select 1 from public.hack_comment_reports r where not exists (select 1 from public.hack_comments c where c.id = r.comment_id) $$,
  'deleting B deletes its comments and every report on them'
);

select * from finish();
rollback;
