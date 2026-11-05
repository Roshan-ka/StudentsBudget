# The weekly reminder by push (05-11-2026)

## Context

The P2 roadmap's weekly reminder: a push notification once a week that it's time for the check-in. The Concept rules out daily nudges, guilt trips and streaks, so it is one calm line, off until someone turns it on. It is the app's first server-side code: a scheduled Supabase function sends it. Until now the browser has only talked to Supabase directly.

Roshan approved this plan on 05-11-2026, after a builder's read raised three questions he answered (other days, the calendar reminder, following the phone).

## Decided

**By Roshan (05-11-2026):**
- **When:** each phone picks a day and a time (quarter hours), defaulting to **Sunday at 18:00** on the phone's own clock. Once a week at most.
- **Who:** signed-in accounts only. Each phone turns it on for itself, under Settings, and it starts off.
- **What it says:** one calm, day-neutral line with no amounts, in the phone's language: "Time for your weekly check-in". A tap opens `/check-in`.
  - The check-in itself stays as it is: it looks at the Monday–Sunday week so far.
  - A hint by the day picker says so.
  - Home keeps "Your weekly check-in is on Sunday."
- **Already checked in:** it comes anyway. The check-in lives on the phone.
- **The calendar reminder stays.** The check-in's "Add weekly reminder to calendar" (`.ics`, Sunday 18:00) is the only reminder for signed-out phones and iPhones that haven't installed the app. The calendar link and the new page point to each other and say to pick one, so nobody gets two.
- **It follows the phone.** While the reminder is on for this phone, the saved time zone and language are updated quietly whenever they differ:
  - when the app opens;
  - when the language changes.

  It is the app's first write without a tap. CLAUDE.md's "Outgoing requests" says so.

**My calls (from the review, not objected to):**
- Standard Web Push with VAPID keys, from the app's own service worker.
- A data-protection note before turning it on.
- Signing out turns this phone's reminder off. Deleting the account removes every reminder (cascade).
- **Once a week means once per Monday–Sunday week of the phone's zone:** `last_sent_week` holds that week's Monday. Moving the day mid-week never sends twice.
- Only known push services' addresses are accepted: Apple's, Google's FCM, Mozilla's and Microsoft's hosts, checked in the table and in the function. The sender never posts to an address a user made up.
- The cron job does nothing while Vault holds no URL or secret, so it is harmless on the local stack and in CI.
- An account with two-step sign-in, before its code is given, sees why it can't turn the reminder on yet.
- The phone keeps a copy of its reminder (on, day, time; localStorage via `phone-pref`), so the Settings row says "Off" or "Sundays at 18:00" offline.

## Design

### Database (a new migration)
- **`push_subscriptions`**, one row per phone with the reminder on.
  - Columns:
    - `id`;
    - `user_id` (cascades from `auth.users`);
    - `endpoint` (unique; the host is checked against the push services);
    - `p256dh` and `auth`;
    - `weekday` (1–7, Monday = 1);
    - `local_time` (quarter hours);
    - `time_zone` (IANA);
    - `lang`;
    - `last_sent_week` (date: the Monday of the week last sent, or null);
    - `created_at`, `updated_at`.
  - RLS: owner select, insert, update and delete, plus the restrictive second-step policy.
  - **An exception to "never hard-deleted":** the table isn't synced, so turning the reminder off deletes the row.
  - Tests: pgTAP (grants, policies, endpoint check, cascade), and `user_data.test.sql`'s `tables_are`.
- **The schedule:** Supabase Cron (`pg_cron`) every 15 minutes calls the function through `pg_net`. The project URL and the cron secret come from Vault at run time, and the job is a no-op without them.

### The sender: `supabase/functions/weekly-reminder/`
- **A Deno Edge Function.** It refuses calls without the cron secret, then:
  1. reads the due rows with the service role;
  2. sends each one an encrypted Web Push message `{ title, body, url: '/check-in' }`;
  3. sets `last_sent_week`;
  4. deletes a row the push service answers 404 or 410 for.
- **What's due**, as pure TypeScript in `supabase/functions/_shared/reminder.ts`, shared with Vitest:
  - `isDue(now, row)`: in the row's zone, it is the weekday, the time is within the 15 minutes from `local_time`, and this week's Monday isn't `last_sent_week`;
  - `reminderText(lang)`: the line in each offered language, English otherwise.

  Unit tests cover time zones, summer and winter time, the window, once a week, a day moved mid-week, and every offered language.
- **The Web Push library for Deno is the builder's call,** after a short spike in chunk 3.

### The app
- **`public/sw.js`:** `push` shows the notification; `notificationclick` focuses or opens `/check-in`. Tested in `src/lib/sw.test.ts`, and the offline check runs.
- **Settings → Weekly reminder:** `/settings/reminder` and a row on the Settings list.
  - The page has an on/off switch, a day, a time (quarter hours), the hint that the check-in looks at the week so far, and a link to the calendar option.
  - Turning it on:
    1. the `reminder` note;
    2. the permission prompt, from the same tap;
    3. `pushManager.subscribe` with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`;
    4. an upsert keyed by endpoint, saving the phone's zone and language.
  - Turning it off deletes the row and unsubscribes.
  - Where push can't work, the page says why and offers nothing to turn on:
    - signed out;
    - the code still owed;
    - no settings in the build;
    - no push in the browser;
    - an iPhone not installed: "Add it to your Home Screen first";
    - permission denied.
  - The new route goes into `sw.js`'s precache list, `PAGES` and the map. It gets `shell.headings.reminder` and a `reminder` texts area in four languages.
- **The check-in's calendar link** adds a line pointing to the new page.
- **Following the phone:** at app start (`AppInit`) and on a language change, while this phone's copy says the reminder is on and the zone or language differ, the row is updated (best effort, quietly).
- **Sign-out:** the sign-out paths delete this phone's row and unsubscribe, best effort, next to `syncBeforeSignOut`.
- **The `reminder` data-protection note:** your account in Supabase keeps this phone's push address, your day and time, your time zone and your language, and updates the zone and language when they change on the phone. The reminder travels through your browser maker's push service (Apple, Google, Mozilla or Microsoft), which sees that a message arrives but not what it says.

### CLAUDE.md
- A "Weekly reminder" rule.
- "What P2.1 and P2.2 leave out" now says the app has one server-side sender.
- "Outgoing requests" gains:
  - the subscription's writes (on Save, on/off, sign-out, and the quiet updates);
  - the push service's subscribe.

## Chunks (about 1 h each, one draft PR each, CI on Roshan's OK, Roshan merges)

1. **The table and the schedule logic:**
   - the plan doc (this plan) into the repo;
   - the `push_subscriptions` migration with pgTAP;
   - `_shared/reminder.ts` (`isDue`, `reminderText`) with its unit tests.
2. **The service worker:** `push` and `notificationclick`, with `sw.test.ts`.
3. **The sender:**
   - the spike on Web Push encryption in Deno;
   - the `weekly-reminder` function and the cron migration (Vault, a no-op without it);
   - a unit test of its handler with the sending stubbed;
   - the go-live steps.
4. **The Settings page:**
   - the row, the page, on/off, day and time;
   - the note and the permission;
   - every "can't" case;
   - the calendar cross-links;
   - texts in four languages;
   - e2e with `PushManager` and `Notification` stubbed (`addInitScript`) and the table mocked in `mockSupabaseData`.
5. **Following the phone and sign-out:**
   - the quiet updates;
   - sign-out turning the phone's reminder off;
   - CLAUDE.md;
   - the real try with Roshan.

## Go live (Roshan, after chunks 1, 3 and 4 merge)

1. Generate VAPID keys once:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Put the public key in Vercel and `.env.local` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, then redeploy.
3. Set the function's secrets:

   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… CRON_SECRET=…
   ```

4. Deploy the function:

   ```bash
   npx supabase functions deploy weekly-reminder
   ```

5. In the SQL editor, store the project URL and the same `CRON_SECRET` in Vault, under the names the cron migration reads.
6. Run `npx supabase db push`.

## As built

**Chunk 1 (2026-11-05):**
- Migration `20261105144946_push_subscriptions.sql`: the table (the endpoint's host checked against FCM, Apple, Mozilla and Microsoft; a quarter-hour `local_time`; `weekday` 1–7; a two-letter `lang`), owner select and delete, the second-step policy, and `save_push_subscription` (security definer, `private.acting_user()`), the only way to write: it upserts by endpoint, moves an address another account held, and keeps `last_sent_week`.
- `supabase/functions/_shared/reminder.ts`: `localParts` (Intl, the zone's clock), `mondayOf`, `isDue` (weekday, 15-minute window, once per Monday–Sunday week), `reminderText` and `REMINDER_URL`. Its tests live in `src/features/reminder/schedule.test.ts`, so Vitest's config (a change of which runs every e2e spec in CI) stays as it is.
- Tests: `supabase/tests/push_subscriptions.test.sql` (20: grants, the policy, saving and saving again, an address moving between accounts, owner-only reads and deletes, the checks, the second step, the cascade) and `user_data.test.sql`'s table list.

**Chunk 2 (2026-11-05):**
- `public/sw.js`: `push` shows `{ title, body, url, lang }` with the app's icon under the tag `weekly-reminder`, so a new reminder replaces an old one still in the tray; a push that can't be read still shows "StudentsBudget", since a push left without a notification can cost the site its permission. `notificationclick` closes it, focuses an open window of the app and takes it to the check-in, or opens a new one there. `ownPath` keeps any message's URL on the app.
- `src/lib/sw.test.ts`: the fake worker gained `registration.showNotification`, `clients.matchAll` and `openWindow`, and events with `data` and `notification`; four tests (the line, an unreadable push or another site's URL, an open window, none open).

## Verification

- Each chunk, locally: lint, typecheck and the touched unit tests. In CI, on Roshan's OK: pgTAP and contract (`db`), the offline check (chunk 2) and e2e (chunk 4).
- `isDue`: Sunday 18:00 in Berlin across summer and winter time; another zone; the window; never twice in a week, a day moved mid-week included.
- The real try:
  - the installed iPhone app gets the line at the chosen time, and a tap opens the check-in;
  - off, or signing out, stops it;
  - a German phone gets the German line;
  - changing the phone's language updates the reminder's.

## Left out on purpose

- Reminders without an account.
- Amounts in the notification.
- Skipping after a check-in.
- More than one a week.
- Quiet hours.
- Snooze.
- A check-in that looks back to last week.
