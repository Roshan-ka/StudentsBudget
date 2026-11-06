-- The weekly reminder, chunk 3 (docs/superpowers/plans/2026-11-05-weekly-reminder.md): the schedule. Every 15 minutes
-- pg_cron asks the `weekly-reminder` Edge Function (supabase/functions/weekly-reminder) through pg_net to send the
-- reminders due then. A reminder's window is 15 minutes too, so each quarter-hour time falls in one run.
--
-- Where to call, and with what secret, are read from Vault at each run: `weekly_reminder_url` (the project's URL,
-- https://<ref>.supabase.co) and `weekly_reminder_secret` (the function's CRON_SECRET). While either is missing a run
-- does nothing, so the local stack and CI never call out. The secret is the function's own, not the project's secret
-- key: pg_net keeps a request's headers in net.http_request_queue until it goes, and this secret can only start a run.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Queues one call of the function: the pg_net request's id, or null while Vault lacks either setting.
create function private.request_weekly_reminders()
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  select s.decrypted_secret into base_url from vault.decrypted_secrets s where s.name = 'weekly_reminder_url';
  select s.decrypted_secret into secret from vault.decrypted_secrets s where s.name = 'weekly_reminder_secret';
  if coalesce(base_url, '') = '' or coalesce(secret, '') = '' then
    return null;
  end if;
  return net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/weekly-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reminder-secret', secret),
    body := '{}'::jsonb,
    -- A run sends ten at a time: more than pg_net's 2 seconds.
    timeout_milliseconds := 60000
  );
end;
$$;

-- Only the job (which runs as the owner) starts a run.
revoke all on function private.request_weekly_reminders() from public, anon, authenticated, service_role;

select cron.schedule('weekly-reminder', '*/15 * * * *', 'select private.request_weekly_reminders()');
