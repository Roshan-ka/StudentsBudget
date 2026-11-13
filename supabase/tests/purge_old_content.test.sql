-- The daily purge (data retention, chunk 1; migration 20261113081710_purge_old_content.sql). Run with
-- `npm run test:db`. Everything happens in one transaction that is rolled back; `now()` stays the same throughout.
--   A wrote everything; 1 to 5 report. The rows are written straight into the tables with the ages each case needs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- The job, and who may run it.
select is((select schedule from cron.job where jobname = 'purge-old-content'), '20 3 * * *', 'the purge runs daily at 03:20 UTC');
select is(
  (select command from cron.job where jobname = 'purge-old-content'),
  'select private.purge_old_content()',
  'and calls the purge'
);
select is((select active from cron.job where jobname = 'purge-old-content'), true, 'it is on');
select ok(not has_function_privilege('anon', 'private.purge_old_content()', 'execute'), 'anon cannot purge');
select ok(not has_function_privilege('authenticated', 'private.purge_old_content()', 'execute'), 'nor can a signed-in user');
select ok(not has_function_privilege('service_role', 'private.purge_old_content()', 'execute'), 'nor the service role');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com', '{"username": "roshan", "label": "student", "batch": "2027", "lang": "de"}'),
  ('00000000-0000-4000-8000-000000000001', 'r1@example.com', null),
  ('00000000-0000-4000-8000-000000000002', 'r2@example.com', null),
  ('00000000-0000-4000-8000-000000000003', 'r3@example.com', null),
  ('00000000-0000-4000-8000-000000000004', 'r4@example.com', null),
  ('00000000-0000-4000-8000-000000000005', 'r5@example.com', '{"lang": "en"}');

-- A's hacks, one per case (the last two digits name it).
insert into public.hacks (id, user_id, body, city, category, lang, created_at, deleted_at, hidden_at, kept_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'A live post nobody deleted', 'regensburg', 'food', 'en', now() - interval '90 days', null, null, null),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'Deleted, posted two days ago', 'regensburg', 'food', 'en', now() - interval '2 days', now() - interval '1 day', null, null),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 'Deleted, posted two hours ago', 'regensburg', 'food', 'en', now() - interval '2 hours', now() - interval '1 hour', null, null),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a', 'Hidden by the moderator 31 days ago', 'regensburg', 'food', 'en', now() - interval '60 days', null, now() - interval '31 days', null),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-00000000000a', 'Hidden by the moderator 29 days ago', 'regensburg', 'food', 'en', now() - interval '60 days', null, now() - interval '29 days', null),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-00000000000a', 'Hidden by five reports 31 days ago', 'regensburg', 'food', 'en', now() - interval '60 days', null, null, null),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-00000000000a', 'Five old reports, kept since', 'regensburg', 'food', 'en', now() - interval '60 days', null, null, now() - interval '10 days'),
  ('20000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-00000000000a', 'Four old reports, still shown', 'regensburg', 'food', 'en', now() - interval '60 days', null, null, null),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-00000000000a', 'Hidden by five reports, the fifth 29 days ago', 'regensburg', 'food', 'en', now() - interval '60 days', null, null, null);

-- Reports: five on 06 (the fifth 31 days ago), five on 07 before it was kept, four on 08, five on 09 (the fifth 29
-- days ago).
insert into public.hack_reports (user_id, hack_id, created_at)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, '20000000-0000-4000-8000-000000000006'::uuid, now() - make_interval(days => 36 - n)
from generate_series(1, 5) n
union all
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, '20000000-0000-4000-8000-000000000007'::uuid, now() - make_interval(days => 40 - n)
from generate_series(1, 5) n
union all
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, '20000000-0000-4000-8000-000000000008'::uuid, now() - make_interval(days => 45 - n)
from generate_series(1, 4) n
union all
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, '20000000-0000-4000-8000-000000000009'::uuid, now() - make_interval(days => 34 - n)
from generate_series(1, 5) n;

-- Comments: one on the deleted post 02 (it goes with it), and on the live post 01 one per case.
insert into public.hack_comments (id, hack_id, user_id, body, lang, created_at, deleted_at, hidden_at)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'On a deleted post', 'en', now() - interval '2 days', null, null),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'A live comment', 'en', now() - interval '90 days', null, null),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'Deleted two days after', 'en', now() - interval '3 days', now() - interval '2 days', null),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'Hidden 31 days ago', 'en', now() - interval '60 days', null, now() - interval '31 days');

-- Students' discounts, one per case.
insert into public.community_discounts (id, user_id, place, offer, category, link, lang, created_at, deleted_at, hidden_at)
values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'Live place', 'Ten percent off', 'food', 'https://example.com/a', 'en', now() - interval '90 days', null, null),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'Deleted place', 'Ten percent off', 'food', 'https://example.com/b', 'en', now() - interval '3 days', now() - interval '2 days', null),
  ('40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 'Report-hidden place', 'Ten percent off', 'food', 'https://example.com/c', 'en', now() - interval '60 days', null, null),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a', 'Hidden 29 days ago', 'Ten percent off', 'food', 'https://example.com/d', 'en', now() - interval '60 days', null, now() - interval '29 days');
insert into public.community_discount_reports (user_id, discount_id, created_at)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, '40000000-0000-4000-8000-000000000003'::uuid, now() - make_interval(days => 36 - n)
from generate_series(1, 5) n;

-- AI uses: one three days old, one an hour old.
insert into private.ai_uses (user_id, feature, used_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'quick-add', now() - interval '3 days'),
  ('00000000-0000-4000-8000-00000000000a', 'ask', now() - interval '1 hour');

create temp table first_run as select private.purge_old_content() as result;

-- Hacks.
select ok(exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000001'), 'a live post stays');
select ok(not exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000002'), 'a deleted post posted over a day ago goes');
select ok(
  not exists (select 1 from public.hack_comments where id = '30000000-0000-4000-8000-000000000001'),
  'and takes its comments with it'
);
select ok(
  exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000003'),
  'a deleted post posted within the day stays, for the daily limit'
);
select ok(not exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000004'), 'a post hidden by the moderator 31 days ago goes');
select ok(exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000005'), 'one hidden 29 days ago stays');
select ok(not exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000006'), 'a post hidden by five reports 31 days ago goes');
select ok(
  exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000007'),
  'one the moderator kept after its reports stays'
);
select ok(exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000008'), 'one with four old reports, still shown, stays');
select ok(
  exists (select 1 from public.hacks where id = '20000000-0000-4000-8000-000000000009'),
  'one whose fifth report came 29 days ago stays'
);

-- Comments.
select ok(exists (select 1 from public.hack_comments where id = '30000000-0000-4000-8000-000000000002'), 'a live comment stays');
select ok(not exists (select 1 from public.hack_comments where id = '30000000-0000-4000-8000-000000000003'), 'a deleted comment goes');
select ok(not exists (select 1 from public.hack_comments where id = '30000000-0000-4000-8000-000000000004'), 'a comment hidden 31 days ago goes');

-- Students' discounts.
select ok(exists (select 1 from public.community_discounts where id = '40000000-0000-4000-8000-000000000001'), 'a live discount stays');
select ok(not exists (select 1 from public.community_discounts where id = '40000000-0000-4000-8000-000000000002'), 'a deleted discount goes');
select ok(
  not exists (select 1 from public.community_discounts where id = '40000000-0000-4000-8000-000000000003'),
  'a discount hidden by five reports 31 days ago goes'
);
select ok(
  not exists (select 1 from public.community_discount_reports where discount_id = '40000000-0000-4000-8000-000000000003'),
  'and its reports with it'
);
select ok(exists (select 1 from public.community_discounts where id = '40000000-0000-4000-8000-000000000004'), 'one hidden 29 days ago stays');

-- AI uses.
select is((select count(*) from private.ai_uses where used_at < now() - interval '2 days'), 0::bigint, 'AI uses over two days old go');
select is((select count(*) from private.ai_uses where used_at > now() - interval '2 days'), 1::bigint, 'newer ones stay');

-- The sign-up metadata.
select is(
  (select raw_user_meta_data from auth.users where id = '00000000-0000-4000-8000-00000000000a'),
  '{"lang": "de"}'::jsonb,
  'the sign-up name leaves the metadata, and the language stays for the emails'
);
select is(
  (select username from public.public_profiles where user_id = '00000000-0000-4000-8000-00000000000a'),
  'roshan',
  'while the posting name stays where the app reads it'
);
select is(
  (select raw_user_meta_data from auth.users where id = '00000000-0000-4000-8000-000000000005'),
  '{"lang": "en"}'::jsonb,
  'metadata without a name is left as it is'
);

-- What the run reports, and a second run that finds nothing.
select is(
  (select result - 'metadata' from first_run),
  '{"hacks": 3, "comments": 2, "discounts": 2, "ai_uses": 1}'::jsonb,
  'the run says what went of each kind'
);
select is(
  private.purge_old_content(),
  '{"hacks": 0, "comments": 0, "discounts": 0, "ai_uses": 0, "metadata": 0}'::jsonb,
  'a second run finds nothing left to delete'
);

select * from finish();
rollback;
