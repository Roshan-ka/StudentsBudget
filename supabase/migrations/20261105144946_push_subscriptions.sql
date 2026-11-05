-- The weekly reminder, chunk 1 (docs/superpowers/plans/2026-11-05-weekly-reminder.md): one row per phone that turned
-- the reminder on. The phone's push address (an endpoint at its browser maker's push service, and its keys), the day
-- and time it chose on its own clock, its time zone and language, and the week the reminder last went. The sender
-- (chunk 3) reads them with the service role.
--
-- Each user reads and deletes only their own rows, with the second-step policy every user table has. Turning the
-- reminder off deletes the row: the table isn't synced, so there is no tombstone. Rows are written only through
-- `save_push_subscription`, which hands the phone's address to whoever saves it: an address is held by the phone
-- alone, so a phone that a second account signs in on simply moves to it. Everything goes with the account.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Only the push services browsers use (Google's FCM, Apple, Mozilla, Microsoft), so the sender never posts to an
  -- address someone made up.
  endpoint text not null unique check (
    char_length(endpoint) <= 1000
    and endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
  ),
  p256dh text not null check (char_length(p256dh) between 16 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  -- 1–7, Monday = 1; a quarter hour on the phone's clock.
  weekday smallint not null default 7 check (weekday between 1 and 7),
  local_time time not null default '18:00' check (
    extract(minute from local_time)::int % 15 = 0 and extract(second from local_time) = 0
  ),
  time_zone text not null default 'Europe/Berlin' check (char_length(time_zone) between 1 and 64),
  lang text not null default 'en' check (lang ~ '^[a-z]{2}$'),
  -- The Monday of the week the reminder last went in, in the row's own zone: once a week, even when the day moves.
  last_sent_week date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_by_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Signed-in users read and delete their own rows; writes go through save_push_subscription.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;

create policy "owner reads" on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "owner deletes" on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);
-- As on every user table (20261028150013_two_step_sign_in.sql).
create policy "second step when the account has one" on public.push_subscriptions as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()))
  with check ((select auth.jwt() ->> 'aal') = 'aal2' or not (select private.has_verified_factor()));

create trigger stamp_updated_at before insert or update on public.push_subscriptions
  for each row execute function private.stamp_updated_at();

-- Saves this phone's reminder for the signed-in user: turned on, its day or time changed, or its zone or language
-- following the phone. Keyed by the push address; an address another account saved before moves to this one (the
-- phone holds it, so whoever presents it is that phone's user now). The week it last went is kept, so moving the day
-- never sends twice in a week. The table's checks refuse a bad address, key, day, time, zone or language (23514).
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_weekday smallint,
  p_local_time time,
  p_time_zone text,
  p_lang text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.acting_user();
begin
  delete from public.push_subscriptions s where s.endpoint = p_endpoint and s.user_id <> me;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, weekday, local_time, time_zone, lang)
  values (me, p_endpoint, p_p256dh, p_auth, p_weekday, p_local_time, p_time_zone, p_lang)
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    weekday = excluded.weekday,
    local_time = excluded.local_time,
    time_zone = excluded.time_zone,
    lang = excluded.lang;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, smallint, time, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, smallint, time, text, text) to authenticated;
