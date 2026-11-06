-- The weekly reminder's schedule (chunk 3; migration 20261106084903_weekly_reminder_schedule.sql). Run with
-- `npm run test:db`. Everything happens in one transaction that is rolled back, so nothing queued here is ever sent:
-- pg_net sends only committed requests.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- The job.
select is(
  (select schedule from cron.job where jobname = 'weekly-reminder'),
  '*/15 * * * *',
  'the job runs every 15 minutes'
);
select is(
  (select command from cron.job where jobname = 'weekly-reminder'),
  'select private.request_weekly_reminders()',
  'and asks for a run'
);
select is((select active from cron.job where jobname = 'weekly-reminder'), true, 'it is on');

-- Only the job starts a run.
select ok(not has_function_privilege('anon', 'private.request_weekly_reminders()', 'execute'), 'anon cannot start a run');
select ok(
  not has_function_privilege('authenticated', 'private.request_weekly_reminders()', 'execute'),
  'nor can a signed-in user'
);
select ok(
  not has_function_privilege('service_role', 'private.request_weekly_reminders()', 'execute'),
  'nor the service role'
);

-- Without its settings in Vault, a run asks for nothing.
select is(
  (select count(*) from vault.decrypted_secrets where name in ('weekly_reminder_url', 'weekly_reminder_secret')),
  0::bigint,
  'the local stack holds no settings for it'
);
select is(private.request_weekly_reminders(), null::bigint, 'so a run asks for nothing');
select is(
  (select count(*) from net.http_request_queue where url like '%/functions/v1/weekly-reminder'),
  0::bigint,
  'and queues no request'
);

-- With them, it calls the function at the project's URL with the function's secret.
select vault.create_secret('https://project-ref.supabase.co/', 'weekly_reminder_url');
select vault.create_secret('the-cron-secret', 'weekly_reminder_secret');

select isnt(private.request_weekly_reminders(), null::bigint, 'with them, a run asks for the function');
select is(
  (select url from net.http_request_queue where url like '%/functions/v1/weekly-reminder' order by id desc limit 1),
  'https://project-ref.supabase.co/functions/v1/weekly-reminder',
  'at the project''s URL'
);
select is(
  (select method from net.http_request_queue where url like '%/functions/v1/weekly-reminder' order by id desc limit 1),
  'POST',
  'as a POST'
);
select is(
  (select headers ->> 'x-reminder-secret' from net.http_request_queue
   where url like '%/functions/v1/weekly-reminder' order by id desc limit 1),
  'the-cron-secret',
  'with the function''s secret'
);
select is(
  (select timeout_milliseconds from net.http_request_queue
   where url like '%/functions/v1/weekly-reminder' order by id desc limit 1),
  60000,
  'waiting up to a minute'
);

-- The sender reads the reminders with the service role, saves the week and deletes a gone address.
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'SELECT'), 'the sender reads the reminders');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'UPDATE'), 'saves the week');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'DELETE'), 'and deletes a gone address');

select * from finish();
rollback;
