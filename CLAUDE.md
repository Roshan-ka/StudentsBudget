# StudentsBudget

@AGENTS.md

Installable Next.js web app for students new to a city (local-first: the phone's data lives in the browser's IndexedDB; since P2.1 an optional email-and-password account keeps a copy in Supabase, and since P2.2 a linked phone syncs it with Sync now; no AI yet). The plan is in `docs/superpowers/plans/2026-10-16-p1-test-project.md`, P2.1 (email-and-password accounts and a Supabase database, done) in `docs/superpowers/plans/2026-10-23-p2-1-accounts-and-database.md`, P2.2 (sync, cut down to linking and Sync now, done) in `docs/superpowers/plans/2026-10-26-p2-2-live-sync.md`, the local StudentsBudget MCP server in `docs/superpowers/plans/2026-10-28-mcp-server.md`, optional two-step sign-in (P2.3a, done) in `docs/superpowers/plans/2026-10-28-p2-3a-two-step-sign-in.md`, passkeys (P2.3b, done; recovery codes parked) in `docs/superpowers/plans/2026-10-29-p2-3b-passkeys-and-recovery-codes.md`, the language switch (plan 1, English and German) in `docs/superpowers/plans/2026-11-02-language-switch.md`, the redesign (a warm, outlined look in light and dark, and dates by region) in `docs/superpowers/plans/2026-11-04-redesign.md`, and the pain points (a calmer Home, Settings in pages, charts that always show) in `docs/superpowers/plans/2026-11-05-pain-points.md`; `docs/` is an Obsidian vault and stays notes-only.

## Stack

All versions are pinned exactly (`.npmrc` has `save-exact=true`). Node 24, npm.

| Package | Version |
|---|---|
| next | 16.4.2 |
| react, react-dom | 19.3.0 |
| react-is (matches react, for recharts) | 19.3.0 |
| typescript | 5.9.3 |
| tailwindcss, @tailwindcss/turbopack | 4.3.3 |
| shadcn (style `base-nova`) | 4.21.5 |
| @base-ui/react | 1.9.0 |
| class-variance-authority | 0.7.1 |
| cn | 0.4.0 |
| lucide-react | 1.58.0 |
| tw-animate-css | 1.4.0 |
| date-fns | 4.4.0 |
| dexie | 4.4.6 |
| dexie-react-hooks | 4.4.0 |
| recharts | 3.8.0 |
| zod | 4.6.7 |
| @supabase/supabase-js | 2.118.0 |
| eslint, eslint-config-next | 9.39.5, 16.4.2 |
| vitest | 5.0.5 |
| fake-indexeddb | 6.2.5 |
| @playwright/test | 1.64.1 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| supabase (the CLI, a dev dependency) | 2.121.0 |
| @modelcontextprotocol/sdk (the MCP server in `mcp/`, a dev dependency) | 1.32.2 |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen`, then `tsc --noEmit` |
| `npm run build` | Production build (`next build`); catches Cache Components errors that dev mode hides |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`, `scripts/**/*.test.mjs`, `mcp/**/*.test.ts`) |
| `npm run mcp` | The StudentsBudget MCP server on stdio (`node mcp/server.ts`); Claude Code starts it through `.mcp.json` |
| `npm run test:e2e` | Playwright on `desktop-chrome` and `iphone` (WebKit); starts the dev server if none is running. `E2E_PORT=3001 npm run test:e2e` (PowerShell: `$env:E2E_PORT=3001; npm run test:e2e`) moves it off port 3000, for a second checkout |
| `npm run test:offline` | Production build, `next start` on :3100 (the port must be free: it never reuses a server), then the Playwright offline check (`desktop-chrome`) |
| `npm run cert:https` | mkcert makes the HTTPS certificate for phone testing into `certs/` (git-ignored); it never runs `mkcert -install` |
| `npm run start:https` | Production build, then serves it over HTTPS on :3443 (`HTTPS_PORT`, `HTTPS_CERT`, `HTTPS_KEY` override); needs the certificate |
| `npm run supabase:start` / `supabase:stop` | The local Supabase stack in Docker (`supabase/config.toml`), with the migrations applied; Studio on http://127.0.0.1:54323, and Mailpit on http://127.0.0.1:54324, where its emails land (sign-up needs the emailed code since P2.4) |
| `npm run test:db` | pgTAP tests in `supabase/tests` against the running local stack |
| `npm run test:contract` | Every `*.contract.test.ts` against the running local stack, as signed-in users: the account store (`src/sync/store.ts`) and the emailed codes (`src/features/account/email-codes.contract.test.ts`), which read the emails from Mailpit (`src/sync/mailpit.ts`). Needs `SUPABASE_TEST_URL`, `SUPABASE_TEST_KEY` and `SUPABASE_TEST_MAIL_URL`, which `node scripts/supabase-test-env.mjs` prints, and Mailpit running. Skipped in `npm test` without them |

CI (`.github/workflows/ci.yml`) starts on its own only for a pull request that is ready for review (Roshan, 2026-11-02): on opening, on Ready for review and on each push after it, never for a draft. That run is `quick`: `checks` and, when reached, `db`; no e2e and no offline check. Every other run starts only from Actions → CI → **Run workflow** (or `gh workflow run ci.yml --ref <branch> -f scope=…`), and Claude asks Roshan before each one. Options: `scope` is `changed` (the default: what the branch changes against `main`, as `scripts/ci-affected.mjs` picks it; the job summary says why) or `full` (everything, only after Roshan approves it); `browsers` is `auto` (Chromium for changed, both projects for full), `chromium` or `all`; `languages` is `auto` (the default language for changed, all for full), `default` or `all` (adds the 375 px tour of every page in each offered language besides English, `e2e/language-tour.spec.ts`). A new run on the same branch and scope stops the one before it:
- `checks`: lint, typecheck, build and the whole unit suite, for anything but notes (`docs/`, Markdown, `.claude/`).
- `e2e`: the specs of every route whose page imports a changed module, directly or through others (`e2e/affected-map.json`), plus smoke. A change that reaches the root layout, setup, Home or Settings runs every spec, in four shards merged into one HTML report (`playwright-report-e2e`), and so does a path no rule matches. `supabase/`, `mcp/` and unit tests alone run no spec. A new route or spec needs an entry in the map, or the unit tests fail.
- `offline` (the service worker, the manifest, `public/`, `next.config.*`) and `db` (the migrations, `test:db` and `test:contract` on a local Supabase stack, for `supabase/`, `src/sync/`, the lockfile and what the contract tests import) run only when flagged.
- `gate` posts the run's verdict as a commit status (`node scripts/ci-affected.mjs verdict`), on a pull request's head commit, where the PR shows it: `full-gate` only for a full run on every browser and language, green only when every job passed (skipped, cancelled or no result fails it); `partial-check` for a full run narrowed by an option; `quick-check` for a changed or quick run (every job passed or skipped). Before merging, a ready pull request's `quick-check` is the check (Roshan, 2026-11-02: no full run needed); a full run is optional, by hand. No branch protection requires any of them yet. A failed offline check uploads its HTML report and traces as `playwright-report-offline`.

## Framework rules

- **Cache Components:** with `cacheComponents: true`, any client component that reads search params (`useSearchParams`) or the pathname on a dynamic-param route must render inside `<Suspense>`.
- **Dexie:** never query it during render, only in effects or `useLiveQuery`. The db module is safe during server rendering only as long as nothing opens it there.
- **Setup:** totals never block it: an over plan, blanks and €0 all save; only text that isn't an amount, an unnamed account, or a one-off with an amount but no name or future due month stops a step. `spendingBudgetMinor` (asked at the top of the envelopes step) only guides the envelope suggestions, in setup and on Home (which splits the lesser of it and what is available); a new setup asks only `SETUP_*_IDS` (`categories.ts`), Edit plan asks every category.
- **Hidden pages stay mounted:** Next 16 keeps a page you navigate away from mounted but hidden (Activity): its effects clean up and re-run on return, and its state survives. Re-read data in effects before redirecting, and don't rely on unmount to reset state.
- **Hidden pages in e2e:** a hidden-but-mounted page keeps its labels and text in the DOM, so `getByLabel` and `getByText` can match hidden elements and trip strict mode. Prefer `getByRole` (with `exact` names) for anything on a page that may be hidden.
- **Recurring entries:** one schedule per plan line. Posting is idempotent by period; a new, resumed or repaired line starts tomorrow (nothing before that), and periods missed while the app was closed are caught up on the next open. "First added on" skips a period that already holds an automatic entry of the line (`holdsAutomaticEntry`), as the poster does: an entry of an earlier schedule of the line (turned off and on, or deleted and added again) holds the period it is dated in, while the current schedule's own entry holds only the period its id names, wherever it is dated (its watermark covers the rest, so a moved entry or a change of frequency doesn't hide a period). A weekly line changed to monthly therefore posts the month in full on top of the weeks already posted in it (Roshan, 2026-11-04). A week that starts on the 1st has the id `rec:<schedule>:w:<Monday>`, since `rec:<schedule>:<1st>` is that month's; one posted earlier under the month's id still holds its week (`ownEntryIds`). Don't log a scheduled item by hand, it would count twice.
- **Agent worktrees:** worktrees in `.claude/worktrees/` (each with its own `node_modules`) make the main checkout's `next dev` hang on "Compiling /". Remove them before running e2e in the main checkout, and clear `.next/dev` if Turbopack then reports a stale task.
- **Worktree installs:** run `npm ci` in one worktree at a time, or `npm ci --prefer-offline` from a warm cache; parallel installs stall for 20 minutes or more.
- **Secure origins:** browser APIs such as `crypto.randomUUID` and service workers exist only on secure origins (HTTPS or localhost). Use `newId()` from `@/lib/new-id`, and test the phone via `npm run start:https`, never a plain-HTTP LAN address.
- **Dexie schema:** a schema change adds a new `db.version(n)`; never edit a version that has shipped.
- **Supabase in the app:** `getSupabase()` only in effects and event handlers; the session lives in the browser's localStorage, and no page reads it while rendering, so every page stays static and precached. Without the two `NEXT_PUBLIC_SUPABASE_*` settings the app is local-only and hides the account UI; changing them needs a rebuild.
- **Supabase schema:** a change is a new migration (`npx supabase migration new <name>`), never an edit to an applied one. Every table has row-level security with owner-only select, insert and update policies on `(select auth.uid()) = user_id`, a `user_id` that cascades from `auth.users`, nothing for `anon`, the restrictive `second step when the account has one` policy (P2.3a; pgTAP in `two_step.test.sql`), and pgTAP tests in `supabase/tests`. Rows are never hard-deleted: a delete writes a tombstone (`data` null; the `stamp_sync` trigger sets `deleted_at` and the user's next `rev`), so other phones learn of it through `sync_pull`. The one exception is deleting the account (P2.5): `delete_my_account()` deletes the user, and every user table and `private.sync_meta` cascade from it.
- **Change tracking (P2.2):** a DBCore middleware (`src/sync/track-changes.ts`, registered in `db.ts`) records every write to a synced table in `db.outbox`, in the same transaction, while `syncState.userId` is set; range deletes record the keys they remove. Rows that come from the account are written inside `untracked()`, which must start its own transaction. A new Dexie table the account should keep needs an entry in `dexieSync` (`src/sync/tables.ts`).
- **Sign-in and security** (P2.3a, P2.3b; Settings → Your account → Sign-in and security):
  - Only a verified **TOTP** factor is the second step. `private.has_verified_factor()` (migration `20261029103500_two_step_totp_only`), `authStateOf` and the MCP server's check share that rule: a new kind of factor changes all three together, with pgTAP.
  - An account with one answers an aal1 session with no rows. The app shows the code step until aal2. Before linking to an account that looks empty, when Sync now is refused, and right after a passkey sign-in, the app refreshes the session (`accountWantsCode`): a factor the session doesn't list yet then shows as the code step, not as an empty account. Linking uses `wantsCodeBeforeLinking`, which throws when the refresh fails, so an unchecked session never links to what may only be an account hiding its rows; the other two stay quiet on a failed refresh.
  - A passkey signs in instead of the password, at aal1 (confirmed on the hosted project in the real try, 29-10-2026): the code step still follows when the account has two-step sign-in, and a passkey is no authenticator factor there. A contract test pins that a password alone can't add a passkey to such an account. Passkeys work only on the relying party's host (`students-budget.vercel.app`): not on Vercel previews or the LAN `start:https`.
  - Recovery codes are parked: the server refuses them, and a contract test fails the day it doesn't.
  - Change password (`change-password.tsx`, `docs/superpowers/plans/2026-11-04-change-password.md`): the current password is asked when the session signed in with it (`asksCurrentPassword` over the token's `amr`), and checked on `checkingSupabase()`. A session that signed in with a passkey sets a new one without the old: the way back for a forgotten password while no email can be sent.
  - e2e: `mockSupabaseAuth` answers the MFA and `/passkeys` endpoints (`factors` shares an account's authenticators between two pages; passkeys stay with their page), and the emailed codes: `{ confirmations: true }` turns "Confirm email" on, `/verify` takes `E2E_EMAIL_CODE` for a sign-up or a `recovery` code, `/recover` mails existing accounts, and `PUT /user` sets a new password (aal2 with an authenticator, never the same one). Its passkey sign-in leaves out the factors, so the app can't rely on them. Specs that make or use a passkey run on Chromium only, with `addVirtualAuthenticator`; the rest skip where the browser has no passkeys (Playwright's WebKit on Windows), so the iPhone is checked by hand.
- **Emailed codes** (P2.4, `docs/superpowers/plans/2026-11-04-email-codes.md`):
  - A sign-up is confirmed, and "Forgot password" signs in, with a 6-digit code from an email (`supabase/templates/confirmation.html` and `recovery.html`), never a link. `verifyOtp` types live in `src/features/account/email-codes.ts`, which the contract test proves against the local stack.
  - The local stack has "Confirm email" on; the hosted project keeps its own settings and copies of the two templates in the dashboard, so a template change is pasted there too (never `supabase config push`).
  - Sign-up sends the phone's language as the account's `lang` user metadata, and the templates pick their text by it (English without one).
  - A "Forgot password" code signs in at aal1: an account with two-step sign-in gives its authenticator code next, and Supabase Auth wants aal2 for its new password (contract-tested). `recovery.ts` keeps the reset pending (sessionStorage) from supabase-js's `PASSWORD_RECOVERY` event until the new password is saved, so the account panel and linking wait; signing out ends it.
  - Contract tests read the codes from Mailpit (`src/sync/mailpit.ts`), so `test:contract` and the CI `db` job need it running.
- **Deleting the account** (P2.5, `docs/superpowers/plans/2026-11-04-account-deletion.md`):
  - Settings → Your account ends with Delete my account (`delete-account.tsx`): the password, the authenticator's code for an account with two-step sign-in, and Backup's typed word. The check runs on `checkingSupabase()`, a client with its session in memory, so the tab's session is never swapped (an account with two-step sign-in would drop back to the code step).
  - The account and every row go; this phone's data stays. `unlinkPhone()` clears the link and the outbox under the sync lock, the tab signs out, and the sign-in form says the account is deleted (`account-deleted.ts`).
  - Other phones keep their data. Their session runs out, and their link to the deleted account is forgotten when they next link (above).
- **Shared discount confirmations** (P2.6, `docs/superpowers/plans/2026-11-04-shared-discount-confirmations.md`): `discount_confirmations(p_since)` returns totals per discount across every account (latest "still works", counts since the semester began), never a user id or a single vote; each account's `discount_votes` stays owner-only. Only a signed-in phone reads them, once per visit to the Discounts list (`community.ts`); others' "still works" confirms a discount too (`freshness`'s `community`), their "doesn't work anymore" only shows as a count. Votes count once a linked phone has synced.
- **Posting names** (the hacks feed, chunk 1, `docs/superpowers/plans/2026-11-05-hacks-feed.md`): `public_profiles` holds each user's unique @username, label (student, graduate, alumni) and batch year, owner-only like the user-data tables, with the second-step policy; others will see them only through the feed's functions. Sign-up's metadata fills it through the `profile_from_sign_up` trigger on `auth.users`, which skips a bad or taken name and never fails a sign-up. `username_available` (anon may call it) answers before sign-up. The username rule is written in the table's check and in that function: change both together (pgTAP tests them alike).
- **Linking and sync (P2.2, cut down):**
  - Signed in on the account page only, the phone links (`linkPhone`, `src/sync/link.ts`): an empty side is filled from the other, both with data → the person chooses, linked to another user → blocked, unless that account no longer exists (`linked_account_exists`, P2.5): then `planLink` forgets the link and plans on. Linking sets `syncState` (user, cursor 0) and runs one `syncNow`; a phone already linked to that user changes nothing.
    - The phone's data goes as the phone is when linking, not as planned: the link, every row the phone has and a delete of each row only the account had are queued in one transaction (`linkAndQueue`), then pushed. A push that stops halfway finishes with the next sync.
    - The account's data (`planDownload` + `replaceAll`) replaces the phone's before the link, so the load isn't recorded.
  - `syncNow` (`src/sync/engine.ts`) pushes the outbox (rows as they are now in `WRITE_ORDER`, then the gone ones as tombstones in `DELETE_ORDER`, so entries go before their accounts; an entry whose seq moved on stays queued), then pulls after the cursor (`sync_pull`, rows checked with `ROW_CHECKS` like Load, each page in one untracked transaction, outbox keys skipped). Nothing runs on a timer: Sync now, the first sync after linking, and sign-out (at most 8 s).
  - Push checks each row with `ROW_CHECKS`, as a pull would: a row this app's own checks refuse is held back (logged with its table and id, still queued), the rest goes, and Sync now reports `heldBackText` as its problem. So a bad row never reaches the account, where it would stop every phone's pull.
  - One sync or link at a time across the phone's tabs: `syncNow`, `linkPhone` and `linkWithChoice` take the Web Lock in `src/sync/lock.ts` (not re-entrant: only at those outermost calls, never inside `applyLink` or `push`).
  - Rules between rows hold only on the phone that makes the change, so a pulled tombstone for an account this phone still uses (`accountUse`, as `deleteAccount` asks) is not applied: the account is queued and pushed back in the same sync.
  - The API answers at most `max_rows` (1,000) per call: page after the last revision until an empty page.
  - Plans: a trigger keeps each schedule's `postedThrough` at the later of stored and incoming (`keep_watermarks`, named to fire before `stamp_sync`), and a pulled plan keeps each watermark the phone has moved further (`keepWatermarks`).
  - The poster writes inside `automatic()` (`src/sync/automatic.ts`), which marks its outbox entries `auto` (a later write of the person's takes the mark away). Push sends those rows insert-only (`store.insertNew`): where the account already has the row, edited or deleted on another phone, the account's copy comes back to the phone instead.
  - Load still checks every row with the row schemas (`src/db/schemas.ts`) and `checkBackupData` before one `replaceAll`, so a refused load changes nothing. A new Dexie table the account should keep needs a new migration, an entry in `serverRowsOf` and `dexieSync`/`dexieHome` (`src/sync/tables.ts`), one in `planDownload`, and a row check in `ROW_CHECKS` (`src/sync/rows.ts`).
- **Backup v3:** it reads v1–v3 files (`READABLE_VERSIONS`). A table added to the backup needs a zod default in `backup.ts` (`[]` or `null`), so older files and the demo fixture still restore. A schedule whose account the file lacks restores as it is (the poster skips it and Settings asks for an account), so one such line never makes a backup, or the account's Load, unrestorable.
- **Budget maths:** no day-based proration. `monthStatus` (Home, charts, reveal) plans the whole monthly amount, in the setup month too, and counts spending from the setup day. Home's "This week" and the check-in's shares come from `weekToSpend`: what is left at the week's start, with expenses dated later in the month already off it (so "This week" never exceeds "Left this month"), ÷ `weeksLeftInMonth` (a stub week counts whole), less this week's spending. An envelope's share is clamped at €0; the total is not. New badge week records use `weekAllowance` (the same, before the week's own spending and before any later-dated expenses, clamped at €0 because backup refuses negatives); recorded rows are never rewritten.
- **Week results:** each Monday–Sunday week is recorded once, keyed by its Monday, from the Wednesday after it ends (`GRACE_DAYS`), and never rewritten, so a plan edit never changes a past week. The three weekly badges read only these rows; Latte Survivor reads the entries, so editing an old month can change it.
- **Languages** (plan 1 in `docs/superpowers/plans/2026-11-02-language-switch.md`, plan 2 in `docs/superpowers/plans/2026-11-03-language-switch-2.md`): English, German, French and Spanish are offered, all three besides English before their native read (Roshan's call; Spanish since 04-11-2026).
  - The registry in `src/i18n/languages.ts` is the single source: the `Language` type, the picker, the head script, locales and tests come from it. `OFFERED` lists what is offered; `SELECTABLE` is what the picker lists: `OFFERED` in production, every registry language in a dev build (so `next dev` and the e2e can try a draft). The phone's own languages pick only an offered one, so a phone set to German opens in German until a choice is made. Never hard-code a list of languages elsewhere.
  - The picker (`src/components/language-picker.tsx`) is the first section of Settings and the top of setup, and shows nothing while only one language can be picked.
  - City content (tips, discounts, swaps with their unit, semester and city texts) is translated by item in `src/i18n/city/<code>/` (plan 2, `docs/superpowers/plans/2026-11-03-language-switch-2.md`): only the words, by id, while numbers, URLs, checked dates and order stay in `src/data` in English. `tipIn`, `discountIn`, `swapIn`, `rangeIn` (by category), `periodIn`, `feePartIn` and `reRegistrationIn` return the item with a `textLang`; an item without a translation stays English, marked `lang="en"` (`contentLang`). Semester texts have no id, so they are keyed by their exact English text: changing one makes its translation stale, and the test says so. A translation keeps every number of the English text and the `Estimate` marker, and an offered language has every item (tested in `city.test.ts`, with French spacing for French). German, Spanish and French have all of it. The MCP server answers in English.
  - **Adding a language:**
    1. Add its registry entry.
    2. Add `messages/<code>/<area>.ts` and its `index.ts`, starting as `{ ...en, ...areas }`, and point `MESSAGES` at it. Translate area by area: each German area file has a header comment and the glossary sits in `messages/de/index.ts`, so write the new one's glossary first. Extend `messages.test.ts` with its allow-list of texts that are the same as English.
    3. Write nav labels of at most 9 characters and chart short names of at most 16 (both tested).
    4. Have a native speaker read it.
    5. Add the code to `OFFERED` and drop the `...en` spread (a test refuses an offered language with English underneath).
    6. Run `language.spec.ts` and `language-tour.spec.ts` with `E2E_LANGUAGES=all`, and `npm run test:offline`, through the lane, or a CI run with `languages=all`.
    7. Do a real try on the phone (`npm run start:https`): switch, reload, install, offline.
  - The choice is per phone (localStorage `studentsbudget-language`, `src/i18n/store.ts`): not synced, not backed up. Only creating an account sends it once, as the account's `lang`, for its emails (P2.4). Pages prerender in `DEFAULT_LANGUAGE`; the inline head script (`languageHeadScript`) sets `<html lang>` and `dir` before paint, `LanguageAttributes` keeps them after.
  - Text comes from the dictionaries (`src/i18n/messages/<code>/<area>.ts`, `Messages = typeof en`) through `useT()`, which is the default language in the first render and the phone's right after. A text that takes values is a function. Plurals go through `plural()` (`Intl.PluralRules`, any CLDR form, `other` as fallback). Dictionaries are imported statically, never with `import()`, so they are cached for offline.
  - Playwright runs in `en-GB` (both configs); a spec about another language sets its own `test.use({ locale })`.
- **Regions** (redesign plan, chunk 0, `docs/superpowers/plans/2026-11-04-redesign.md`): a region decides how a full date is written, apart from the language. `src/i18n/regions.ts` is the single source (one region, `de`, so far, and no picker): `formatDate` and `formatDateTime`, the date field's empty form in the language's letters (`datePlaceholder`: TT.MM.JJJJ in German) and `DatedText`'s pattern (`fullDatePattern`) all read it. Never write a date form by hand: specs build expected dates with `formatDate`.
- **Look** (redesign plan, `docs/superpowers/plans/2026-11-04-redesign.md`; Roshan approved it from mockups, 04-11-2026):
  - Colours only through the tokens in `globals.css`: shadcn's slots plus `outline`, `nav`, `highlight`, `track` and the `shadow-offset` utilities, light in `:root` and dark in `.dark`. `tokens.test.ts` holds every text pair to 4.5:1 and every outline and focus ring to 3:1 in both themes, category tints included: a new pair of colours goes into it.
  - A card is `Card` or `cardVariants()` (a `<section>` with its heading takes the class), never a hand-made `rounded-lg border`. Buttons: `chip` for filters and quick picks (`aria-pressed`), `lg` for a step's or a form's main action.
  - Nothing that holds text gets a fixed height (`min-h-*`, labels wrap), and tap targets stay at least 44 px. New code uses logical sides (`ps-`, `pe-`, `ms-`, `me-`, `start`, `end`).
  - A category's tint is `categoryTint(id)` and its icon `CATEGORY_ICONS[id] ?? OTHER_ICON`, looked up while rendering (a function returning a component trips React's static-components rule). Icons are `aria-hidden`; the name is always written beside them.
  - Headings are Bricolage Grotesque (`h1`–`h4` take `font-heading`), text DM Sans. Overspending is never red: a full bar or ring in the same colours, and words.
- **Settings** (pain points, chunks 3 and 4, `docs/superpowers/plans/2026-11-05-pain-points.md`): `/settings` is the language picker and a list of pages (`SettingsLinks`, `src/features/settings/`), each row with a one-line summary (pure helpers in `summaries.ts`, tested): Accounts and transfers (`/settings/accounts`: accounts, transfer, and exchange rates only with an account not in euros), Plan (`/settings/plan`, only once a plan exists: Edit plan and the fixed costs), Profile, Appearance, Your account (its row carries the sign-in and sync status; hidden without Supabase settings) and Backup and data. Each page starts with `BackToSettings` and its `PageHeading`; a page with one section names it by the heading (`htmlId`, e.g. `appearance-heading`) instead of repeating it. A new page joins `PAGES` (`e2e/helpers/pages.ts`) and the map; specs reach a page by its URL or its row (`getByRole('link', { name: /^Profile/ })`).
- **Per-phone choices** (pain points): small things this phone remembers go through `readPref`/`writePref` (`src/lib/phone-pref.ts`, localStorage; not synced, not backed up; blocked storage falls back to the default). Keys: `studentsbudget-entry-form`, the entry form's last category and account per type (`last-choice.ts`).
- **Themes** (chunks 8 and 9): Light (default), Dark or Same as phone, picked in Settings → Appearance (`AppearanceSection` on `/settings/appearance`; "Aussehen" in German, since the charts already use "Darstellung").
  - Per phone, like the language: localStorage `studentsbudget-theme`, not synced, not backed up (`src/theme/`).
  - `themeHeadScript` puts the `dark` class, `color-scheme` and the theme-color meta on the page before the first paint. `ThemeAttributes` keeps them, and follows the phone under Same as phone.
  - Pages prerender light. A spec about dark chooses it in Settings (`theme.spec.ts`).
- **Quick add:** `QuickAddField` reads every line through a `QuickAddProvider` (default `localQuickAddProvider`), and every reading passes `checkReading` before it is saved. Don't call `parseQuickAdd` or `suggestCategory` from the field.
  - The mic button (P2, `docs/superpowers/plans/2026-11-04-mic-button.md`) shows only where the browser has speech recognition (`recognizerFor`, `speech.ts`). It listens once in the language's locale and hands what it heard to the same `addLine` as a typed line, so speech goes through the provider and `checkReading` too, and saves straight away with the Saved line and Undo.
  - The first tap on a phone shows where the speech goes: its data-protection note (below), under its older key `studentsbudget-mic-note`.
  - "Listening…" uses the field's one `role="status"` line, so the specs' `getByRole('status')` stays unique.
  - e2e (`dictation.spec.ts`) installs a stand-in recognizer with `addInitScript`.
- **Data-protection notes** (`docs/superpowers/plans/2026-11-05-privacy-notes.md`): a feature that sends data to someone else says so once per phone, before its first use, through `PrivacyNote` (`src/features/privacy/`), with its flag in `PRIVACY_NOTES` (localStorage: not synced, not backed up). So far: the mic, creating an account, adding a passkey, an account in another currency (Settings and setup's accounts step: Frankfurter) and voting on a discount while signed in. Each shows inline where it's used (in a form, after the form's own checks, in place of its buttons); Continue goes on from the same tap; Cancel sends nothing. Texts in `common.privacy`. A note states only what is certain; the full list waits for the privacy page. Specs about something else accept them up front (`acceptPrivacyNotes`, `e2e/helpers/privacy.ts`; `fillSetup` accepts only the rates note, since the setup draft starts with an INR account; never the mic's, which `dictation.spec.ts` tests after `completeSetup`).
- **Default account:** new entries, quick add, a transfer's From and new recurring lines (in Settings, setup and Edit plan) start on `defaultAccount` (`balances.ts`) over accounts in `sortAccounts` order (setup: draft order): the account marked `isDefault`, else the first euro bank account, else any euro account, else the first bank account, else the first account. Never `accounts[0]`. A quick-add line written with a euro marker (€, eur, euro) goes to `euroAccount` (the euro part of that rule) when the default is not in euros.
- **MCP server** (`mcp/`, plan in `docs/superpowers/plans/2026-10-28-mcp-server.md`):
  - A local stdio server with read-only tools over `src/data`, plus `budget_overview`, `recent_entries` and `week_check_in` (the app's check-in, built with its own `src/features/check-in/` functions). It isn't part of the web app: nothing in `src/` imports it.
  - Two prompts (`mcp/prompts.ts`): `weekly_check_in` and `new_in_regensburg`, which Claude Code shows as slash commands. A prompt states no figure itself: it tells Claude which tools to call and how to write the answer. Every snake_case word in a prompt must be one of the server's tools, and every camelCase word a field of their output (tested).
  - The three account tools read the user's account with the app's own `supabaseStore` and `planDownload`, signed in as the user (`mcp/account.ts`).
    - `server.ts` loads `.env.local`: the app's two Supabase values, plus `STUDENTSBUDGET_MCP_EMAIL` and `STUDENTSBUDGET_MCP_PASSWORD`.
    - The store they get refuses writes (`readOnly`).
    - Summing entries across accounts uses `eurMinor`, never `amountMinor`; balances are converted at the account's rates (`totalInEur`), with no total when nothing converts, as Home does.
    - A problem reading the account is a `state` with a note, not an error. Anything but a missing setting or a failed sign-in is also logged to stderr.
    - It signs in with the password alone, so an account with two-step sign-in gives `needs-second-step` (also when the step was turned on while the server ran): use one without it.
  - Node 24 runs the `.ts` files directly with type stripping (tsconfig `allowImportingTsExtensions`; `erasableSyntaxOnly` refuses enums and parameter properties in `src/`).
    - Typecheck can't catch a type imported without `type`, which fails in Node. `mcp/server.test.ts` starts the real server in plain Node and does.
  - Nothing from `src/` beyond `src/data/*` and `src/lib/money.ts` may load before `registerAppImports()` (`mcp/app-imports.ts`), which teaches Node the `@/` alias and extensionless imports.
    - `server.ts` registers it, then imports `create-server.ts` with a dynamic `import()`, since static imports resolve before any code runs.
    - Every module behind that import may use `@/` freely.
  - The tools use the app's own helpers (category names and order, amounts, savings, staleness, semesters, the check-in's week). Two one-line rules are restated, each with a comment: the manual-over-ECB rate choice (`loadRates` reads Dexie) and the setup-day cut of `beforeSetup`.
  - stdout carries the protocol: log only to stderr.
  - Claude Code hands the model only a tool's structured content, not its text. Whatever the model must know (cite the sources, what a `null` means, that a search missed) goes in the structured `note`, as well as in the text.
  - Every item keeps its source, URL and checked date.
  - What the app never shows, the server leaves out too (`HIDDEN_PRICE_LABELS`: the Deutschlandticket price).
  - A search that finds nothing returns the whole list with a note. A search's example words must find something (tested).
  - `.mcp.json` holds no secrets.
- **Service worker** (`public/sw.js`, registered by `AppInit`):
  - Production only: `next dev` never registers it.
  - Never run `next start` on port 3000, or a production worker sits in front of `next dev` there; `npm run test:offline` uses 3100.
  - Its cache name follows the commit SHA (`NEXT_PUBLIC_BUILD_VERSION`), so commit before building for the phone, or an installed app keeps its old offline copy.
  - Don't enable `experimental.useOffline`: offline taps rely on Next's hard-navigation fallback when an RSC fetch fails.

## Global Constraints

**Code**
- TypeScript `strict`; no `any`.
- **Money:** integer minor units (`Minor`), never floats. Plan, envelope and city amounts are in EUR. Each entry keeps its account's currency in `amountMinor`, plus `eurMinor` converted at save time.
- **Dates:** local `IsoDate` strings (`YYYY-MM-DD`) and `IsoMonth` strings (`YYYY-MM`). Shown in the region's form with `formatDate` wherever a full date appears, whatever the language (Germany, the only region: `DD.MM.YYYY`, so 04.11.2026; Regions, above); short labels like "Mon 26 Oct" stay in the language. Weeks run Monday–Sunday. The check-in is on Sunday.
- **Data:** the phone's data lives in the IndexedDB database `studentsbudget`; the account (Supabase, Frankfurt) holds a copy only once the phone is linked, and it changes with each sync.

**What P2.1 and P2.2 leave out**
- No AI calls, server routes, analytics or third-party scripts. The browser talks to Supabase directly (Auth and the user-data tables), behind row-level security.
- No automatic sync (Sync now is a button; no timers, realtime or background sync), merging of two edits to one row (the last sync wins), purging of tombstones or legal pages yet.
- Outgoing requests: `https://api.frankfurter.dev/v2/rates?base=EUR&quotes=…&providers=ecb` (confirm the endpoint in Frankfurter's docs before coding), and, only when the build has Supabase settings, the Supabase project: sign-in (password, passkey, authenticator code), creating an account (with the phone's language) and confirming it with its emailed code or asking for a new one, deleting the account (the password and code given again on a client of its own), asking whether the account a phone is linked to still exists (only when linking finds another account), other students' discount totals (when the Discounts list opens while signed in), "Forgot password" (the email, its code, the new password), the session refresh supabase-js runs in the background, reading and changing passkeys and two-step sign-in, linking, and each sync (Sync now, the first after linking, the last before signing out). The app sends no audio itself: the mic button uses the browser's speech recognition, which may send the recording to the browser maker's speech service (Google, in Chrome), and the app says so once before the first use.

**Text and layout**
- The UI is in English, German, French and Spanish, picked per phone (Languages, above). Money, numbers and date labels are formatted in the language's registry locale (a full date follows the region): `€6.50` and `€63` for headlines in English (`en-IE`), `6,50 €` and `63 €` in German (`de-DE`), French (`fr-FR`: a no-break space before the €, a narrow one between thousands, `1 006,50 €`) and Spanish (`es-ES`: `1006,50 €`, with a thousands dot only from five digits, `10.006,50 €`). French puts a narrow no-break space before : ; ? ! and inside « » (tested).
- Calm wording: overspending reads "€12 over" ("12 € zu viel", "12 € de trop", "12 € de más"), never "failed" or "warning!".
- Phone first: works at 375 px width, 16 px side gutters, no horizontal page scroll, bottom navigation.
- **One design everywhere** (Roshan's global design rules, 04-11-2026; redesign plan, chunk 10):
  - Brand, type, spacing, components, navigation and accessibility are the same in every region. A region adapts only what its people need (today the date's form), and a language its words, its script's fonts and its direction.
  - Logical sides only (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`; `rtl:` on a directional icon or movement): `global-design.test.ts` refuses left and right in every `.tsx` in `src/` (its allow-list is empty since chunk 12; never add to it).
- **Adding a region's design layer:**
  1. Its entry in `src/i18n/regions.ts`.
  2. `src/app/regions/<code>.css`, holding `[data-region='<code>'] { }` with only `--region-*` tokens (content or imagery the region needs), imported in `globals.css`. Never colours, fonts, spacing or components (tested).
  3. With a second region, a region picker and a stored choice apart from the language, and `data-region` from that choice instead of `DEFAULT_REGION`.
- **A language in another script:** its registry `script`, its fonts through `next/font` in the layout, and a `:lang(<code>)` block in `globals.css` that sets `--font-sans` and `--font-heading` (tested).
- User-facing text states no platform storage-eviction rule without a source (the Concept's iOS 7-day line has none): say only that clearing site data or removing the app deletes the data.

**Data rules**
- City: Regensburg only. Every city number has a source, a URL and a checked date. A number without a source is labelled "Estimate".
- Swaps, discounts, semester dates and semester fees: every amount, offer or date has its own source, URL and checked date, and a swap whose cheaper price is on another page also carries `toSource` and `toUrl`. No alcohol deals or drinking tips.
- Guesses are saved once in setup and never edited afterwards. They cover the original 6 flexible categories only (`GUESS_CATEGORIES`).

**Repo**
- A project `.npmrc` with `save-exact=true` (never the global npm config); versions listed in this file.
- `.gitattributes` with `* text=auto eol=lf`.
- Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- One branch and one Draft PR per day, from `main`. Nothing is pushed to `main` after the initial commit, and Roshan merges.
- **Repos (since 2026-10-27):** the main repo is `Roshan-ka/StudentsBudget` (`origin`, Roshan's personal account): PRs are opened, checked and merged there. `origin` has a second push URL, so every `git push origin` also updates `SupportRW/StudentsBudget` (fetch it as `supportrw`), a backup copy for Roshan's internship mentor to see: no PRs, CI or deploys there, and merged branches are deleted on both. After Roshan merges, `main` is pulled from `origin` and pushed once more, so SupportRW's `main` catches up (fast-forward only). Commits use Roshan's personal identity (repo-local git config), and Vercel and Supabase run on his personal accounts.

## Keeping this file honest

Update this file when Claude gets something wrong twice. Add the rule here, in one line, instead of correcting it again in chat.
