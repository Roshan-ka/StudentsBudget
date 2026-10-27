# StudentsBudget P2.1 Implementation Plan: accounts and the database

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan chunk by chunk. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- Sign up and sign in with an email and a password.
- Save this phone's data to the account, in a Supabase database in Frankfurt.
- Load it onto another phone.

This turns StudentsBudget into a working prototype with a real database that later features can build on. It is not live sync yet: saving and loading are buttons. Live sync is the next plan.

**Status (2026-10-26):** done. Day 1 (chunks 1–3) merged in PR #13, day 2 (chunks 4–5) in PR #14. Next: [[2026-10-26-p2-2-live-sync|P2.2 plan]].

**Spec:** [[Student Budget App - Concept]]: P2 (:58), login and the EU database (:71), EU data (:194–196). [[Student Budget App - Tech Stack]]. Open items: [[Student Budget App - P1 follow-ups]].

## How this plan is built

- **Five chunks of about 2 hours,** done one at a time in order. Each one ends with its checks green and one commit, and Roshan can stop or redirect between chunks.
- **About two days:** chunks 1–3 are day one (`feat/p2-1-accounts`), and chunks 4–5 are day two (`feat/p2-1-database`). Each day is one branch and one Draft PR.
- **Checks:** each chunk runs lint, typecheck, unit tests and its own e2e spec. The full build, e2e on chrome and iphone, and `test:offline` run once per day before the PR.
- **Signed out, nothing changes.** Without an account, the app stays exactly as in P1, and nothing leaves the phone. Without the Supabase settings, the account UI is hidden.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Login | Email and password through Supabase Auth | Supabase supports it natively. A username would need its own table and lookup, and would reveal which names exist. |
| Sign-up | Open in the app, with **"Confirm email" off** | This needs no email provider, domain or SMTP. Anyone with the link can create an account, but RLS keeps every account's data private, and sign-ups can be switched off in the dashboard at any time. |
| Password | At least 8 characters | Supabase's setting. Its leaked-password check is a Pro feature. |
| Session | Kept by `@supabase/supabase-js` in the browser (localStorage) | There is no server code, no cookies and no proxy. Every page stays static and works offline. |
| Database | One table per kind of data. Each row is `user_id`, `id` and `data jsonb`, with RLS so a user reads and writes only their own rows. | One simple shape for every table. The app's zod schemas check `data` on the way in and out. |
| Saving and loading | Buttons: "Save to my account" and "Load from my account" | This proves the database end to end. P2.2 makes it automatic. |
| Legal pages | Not now | Fine while only Roshan and test accounts use it. A short privacy notice is needed before friends store real data (see Not in this plan). |

## Before chunk 2: Roshan's setup (about 20 min)

- [ ] **Create the project** at supabase.com:
  - a personal account and organization, on the Free plan;
  - project `studentsbudget`, region **Central EU (Frankfurt)**. The region can't be changed later.
  - Store the database password in a password manager.
- [ ] **Authentication → Sign In / Providers → Email:**
  - Email: on.
  - **Confirm email: off.**
  - Allow new users to sign up: on.
  - Minimum password length: 8.
- [ ] **Project Settings → API Keys:** copy the Project URL and the **Publishable** key into a new `.env.local` in the repo root:

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  ```

  The publishable key is meant for the browser, because RLS protects the data. P2.1 needs no secret key. `.env.local` is git-ignored.
- [ ] **Recommended before chunk 3: Docker Desktop (with WSL2).** It lets the database tests run on this machine. Without it, they run only in CI.
- [ ] **On Vercel, after chunk 5 works:** add the same two variables (Production) and redeploy.

## Chunks

### Chunk 1 – Supabase client (no visible change)

- [x] **The package:** `@supabase/supabase-js`, at the latest stable version, pinned exactly. Add it to CLAUDE.md's Stack table.
- [x] **`src/lib/supabase/env.ts`:** `readSupabaseEnv(): { url: string; publishableKey: string } | null`.
  - It reads `process.env.NEXT_PUBLIC_SUPABASE_URL` and `…_PUBLISHABLE_KEY` literally, since dynamic lookups are not inlined, and validates them with zod.
  - Unset or invalid values give `null`.
- [x] **`src/lib/supabase/client.ts`:** `getSupabase(): SupabaseClient | null` is a browser singleton.
  - Options: `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'studentsbudget-auth' }`.
  - It is called only in effects and event handlers, never during render or on the server.
- [x] **`.env.example`** with the two names, and `!.env.example` in `.gitignore`, because today the `.env*` pattern would hide it.
- [x] **Tests:** `env.test.ts` covers unset, valid, a bad URL and an empty key.
- **Done when:** lint, typecheck and unit tests pass, and the app is unchanged with and without `.env.local`.

### Chunk 2 – Sign up, sign in, sign out

- [x] **`src/features/account/use-auth.ts`:** `useAuth()` returns `{ status: 'off' | 'loading' | 'signed-out' | 'signed-in'; email?: string }`, built from `onAuthStateChange`. `INITIAL_SESSION` arrives first.
- [x] **`src/app/settings/account/page.tsx`:** a static shell that renders `account-view.tsx` (client).
  - **Signed out:** an Email field, a Password field and a **Sign in** button, plus "New here? Create an account", which switches the button to **Create account**.
    - Fields use `autoComplete="email"` and `current-password` or `new-password`.
    - Create account checks for 8 characters before sending.
  - **Signed in:** "Signed in as …", a **Sign out** button (`signOut({ scope: 'local' })`) and the line "Your data stays on this phone."
- [x] **`src/features/account/auth-errors.ts`:** maps the Supabase error codes to calm text. Unit tested.
  - `invalid_credentials`: "Email or password is wrong."
  - `user_already_exists`: "This email already has an account. Sign in instead."
  - `weak_password`.
  - The rate limit.
  - Offline: "You're offline. Signing in needs a connection."
- [x] **Settings:** an **Account** card at the top links to `/settings/account`. It shows "Signed in as …" when signed in, and is hidden when Supabase isn't configured.
- [x] **Offline:** `public/sw.js` PAGES gains `/settings/account`, with matching changes in `src/lib/sw.test.ts` and `e2e/offline.spec.ts`.
- [x] **The install hint:** iOS keeps Safari and the Home Screen app apart, so sign in inside the app.
- [x] **e2e:**
  - The Playwright configs set a fake `NEXT_PUBLIC_SUPABASE_URL` (`https://e2e.supabase.invalid`) and a fake key.
  - `e2e/account.spec.ts` mocks `**/auth/v1/**` **by path**, so the mock holds even against a dev server that has the real `.env.local`.
  - It covers: create an account, sign in, a wrong password, sign out, and offline.
- **Done when:** the spec passes on chrome and iphone, and Roshan signs up on his own project and sees the user under Authentication → Users.

### Chunk 3 – The database tables

- [x] **The CLI:** `supabase` as a pinned dev dependency, run with `npx`. Run `npx supabase init`, which adds `supabase/config.toml` (local values only).
- [x] **Migration `supabase/migrations/<timestamp>_user_data.sql`:**
  - Eight tables: `accounts`, `entries`, `plans`, `guesses`, `manual_rates`, `week_results`, `discount_votes` and `profiles`.
  - Each has: `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `id text not null`, `data jsonb not null`, `updated_at timestamptz not null default now()`, primary key `(user_id, id)`, and `check (pg_column_size(data) <= 65536)`.
  - RLS is on for every table. Four policies (select, insert, update, delete) for `authenticated`, each on `(select auth.uid()) = user_id`. Revoke all from `anon`.
- [x] **pgTAP `supabase/tests/user_data.test.sql`:**
  - every public table has RLS;
  - user A cannot read or change user B's rows;
  - `anon` sees nothing;
  - deleting a user deletes their rows.
- [x] **CI:** a new job `db` runs `npx supabase start` (Docker on ubuntu-latest, no secrets) and then `npx supabase test db`. A script `test:db` does the same locally.
- [x] **Roshan applies it to his project:** either `npx supabase login`, `npx supabase link --project-ref <ref>` and `npx supabase db push`, or pastes the migration into the SQL editor. The plan gives the exact commands.
- **Done when:** the `db` job is green, and the 8 tables show in the dashboard with RLS on.

### Chunk 4 – Save this phone's data to the account

- [x] **`src/db/schemas.ts`:** the zod row schemas move here from `src/features/backup/backup.ts`, which imports them. Backup behaviour is unchanged and its tests still pass.
- [x] **`src/sync/tables.ts`:** the registry, mapping each Dexie table to its server table, its row id and its schema.
  - `plan` and `profile` use id `current`.
  - `fxRates` sends only `manual` rows (id = currency).
  - `categories` are built-in and not sent.
- [x] **`src/sync/upload.ts`:** `uploadAll(supabase)` makes the account mirror the phone.
  - Per table: upsert every local row in batches of 500 (`onConflict: 'user_id,id'`), then delete the server rows this phone no longer has.
  - It returns counts per table.
- [x] **UI:** "Save to my account" on the account page, with the result line "Saved 42 entries, 3 accounts and your plan." Errors are calm, and a failed save changes nothing on the phone.
- [x] **Tests:** `upload.test.ts` against a small in-memory fake of the Supabase query calls:
  - every table is sent;
  - a deleted entry is removed on the server;
  - ECB rates are never sent;
  - a second save changes nothing.
- **Done when:** Roshan saves, sees the rows under Table Editor, deletes an entry on the phone, saves again and sees it gone.

### Chunk 5 – Load the account's data onto this phone, plus docs

- [x] **`src/sync/download.ts`:** `downloadAll(supabase)`.
  - Fetches every table in pages of 1000.
  - Checks every row with the zod schemas (as `checkBackupData` does).
  - Then calls `replaceAll` from `src/db/bulk.ts` in one transaction.
  - Any invalid row means nothing changes, with a calm error.
- [x] **UI:**
  - "Load from my account" asks first: "This replaces the data on this phone with your account's data (128 entries)."
  - Signing in on a phone **without a plan** offers it straight away: "Your account has data. Load it onto this phone?"
- [x] **Tests:**
  - a round trip, upload then download, gives identical data, like the backup round-trip test;
  - an invalid row changes nothing.
- [x] **Docs and copy:**
  - **README:** "Your data stays on your phone unless you sign in and save it to your account", plus how to set up `.env.local`.
  - **CLAUDE.md:** the Commands rows (`test:db`). "What P1 leaves out" becomes "What P2.1 leaves out". New one-line rules:
    - Supabase only in effects and handlers;
    - every table has RLS and a pgTAP test;
    - a schema change is a new migration;
    - `NEXT_PUBLIC_` changes need a rebuild.
  - **In-app text** that says data is "only on this phone" gains "unless you save it to your account" where it is shown signed in.
- **Done when:** in two browser profiles, A saves and B signs in and loads, and Home shows the same numbers. The full build, e2e and offline checks pass, and the day's PR is ready.

## Not in this plan

- **Live sync** (automatic, both ways, with conflicts): P2.2.
- **Account care:**
  - deleting the account from the app (Roshan deletes users in the dashboard for now);
  - "Forgot password" (needs an email provider and a domain; Roshan resets passwords in the dashboard for now);
  - turning "Confirm email" on.
- **Legal:** a privacy notice and probably an Impressum, **before friends store real data.** Once other people's data is on the server, GDPR applies to Roshan as the operator.
- **Security extras:** the CSP and security headers, and an invite-only sign-up.

## Next plans (written one at a time, when we get there)

- **P2.2 – Live sync:** the device tracks its own changes (a Dexie v4 outbox), pushes and pulls automatically, and shows a sync status. Server rows gain a revision cursor and deletion markers.
  - Last write wins per row.
  - Automatic recurring entries (`rec:` ids) and recorded weeks are written once, and the plan's `postedThrough` never moves back.
  - Sync runs on opening the app, when it comes online, every 60 s while visible, and on "Sync now".
- **P2.3 – Account care and going public with friends:** delete the account, password reset by email, the privacy notice, and invite-only sign-up.
- **Later:** shared discounts and the verified badge (P2b), the tips feed with moderation (P2c), and the weekly reminder, community badges and mic (P2d).
