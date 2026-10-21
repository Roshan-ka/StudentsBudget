# StudentsBudget

@AGENTS.md

Installable Next.js web app for students new to a city (P1: no AI, no login, all data in the browser's IndexedDB). The plan is in `docs/superpowers/plans/2026-10-16-p1-test-project.md`; `docs/` is an Obsidian vault and stays notes-only.

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
| eslint, eslint-config-next | 9.39.5, 16.4.2 |
| vitest | 5.0.5 |
| fake-indexeddb | 6.2.5 |
| @playwright/test | 1.64.1 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen`, then `tsc --noEmit` |
| `npm run build` | Production build (`next build`); catches Cache Components errors that dev mode hides |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`, `scripts/**/*.test.mjs`) |
| `npm run test:e2e` | Playwright on `desktop-chrome` and `iphone` (WebKit); starts the dev server if none is running. `E2E_PORT=3001 npm run test:e2e` (PowerShell: `$env:E2E_PORT=3001; npm run test:e2e`) moves it off port 3000, for a second checkout |
| `npm run test:offline` | Production build, `next start` on :3100 (the port must be free: it never reuses a server), then the Playwright offline check (`desktop-chrome`) |
| `npm run cert:https` | mkcert makes the HTTPS certificate for phone testing into `certs/` (git-ignored); it never runs `mkcert -install` |
| `npm run start:https` | Production build, then serves it over HTTPS on :3443 (`HTTPS_PORT`, `HTTPS_CERT`, `HTTPS_KEY` override); needs the certificate |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, unit tests, e2e and the offline check on every pull request.

## Framework rules

- **Cache Components:** with `cacheComponents: true`, any client component that reads search params (`useSearchParams`) or the pathname on a dynamic-param route must render inside `<Suspense>`.
- **Dexie:** never query it during render, only in effects or `useLiveQuery`. The db module is safe during server rendering only as long as nothing opens it there.
- **Setup:** totals never block it: an over plan, blanks and €0 all save; only text that isn't an amount, an unnamed account, or a one-off with an amount but no name or future due month stops a step. `spendingBudgetMinor` (asked at the top of the envelopes step) only guides the envelope suggestions, in setup and on Home (which splits the lesser of it and what is available); a new setup asks only `SETUP_*_IDS` (`categories.ts`), Edit plan asks every category.
- **Hidden pages stay mounted:** Next 16 keeps a page you navigate away from mounted but hidden (Activity): its effects clean up and re-run on return, and its state survives. Re-read data in effects before redirecting, and don't rely on unmount to reset state.
- **Hidden pages in e2e:** a hidden-but-mounted page keeps its labels and text in the DOM, so `getByLabel` and `getByText` can match hidden elements and trip strict mode. Prefer `getByRole` (with `exact` names) for anything on a page that may be hidden.
- **Recurring entries:** one schedule per plan line. Posting is idempotent by period; a new, resumed or repaired line starts tomorrow (nothing before that), and periods missed while the app was closed are caught up on the next open. "First added on" skips a period that already holds an automatic entry of the line (`holdsAutomaticEntry`), as the poster does. Don't log a scheduled item by hand, it would count twice.
- **Agent worktrees:** worktrees in `.claude/worktrees/` (each with its own `node_modules`) make the main checkout's `next dev` hang on "Compiling /". Remove them before running e2e in the main checkout, and clear `.next/dev` if Turbopack then reports a stale task.
- **Worktree installs:** run `npm ci` in one worktree at a time, or `npm ci --prefer-offline` from a warm cache; parallel installs stall for 20 minutes or more.
- **Secure origins:** browser APIs such as `crypto.randomUUID` and service workers exist only on secure origins (HTTPS or localhost). Use `newId()` from `@/lib/new-id`, and test the phone via `npm run start:https`, never a plain-HTTP LAN address.
- **Dexie schema:** a schema change adds a new `db.version(n)`; never edit a version that has shipped.
- **Backup v3:** it reads v1–v3 files (`READABLE_VERSIONS`). A table added to the backup needs a zod default in `backup.ts` (`[]` or `null`), so older files and the demo fixture still restore.
- **Budget maths:** no day-based proration. `monthStatus` (Home, charts, reveal) plans the whole monthly amount, in the setup month too, and counts spending from the setup day. Home's "This week" and the check-in's shares come from `weekToSpend`: what is left at the week's start, with expenses dated later in the month already off it (so "This week" never exceeds "Left this month"), ÷ `weeksLeftInMonth` (a stub week counts whole), less this week's spending. An envelope's share is clamped at €0; the total is not. New badge week records use `weekAllowance` (the same, before the week's own spending and before any later-dated expenses, clamped at €0 because backup refuses negatives); recorded rows are never rewritten.
- **Week results:** each Monday–Sunday week is recorded once, keyed by its Monday, from the Wednesday after it ends (`GRACE_DAYS`), and never rewritten, so a plan edit never changes a past week. The three weekly badges read only these rows; Latte Survivor reads the entries, so editing an old month can change it.
- **Quick add:** `QuickAddField` reads every line through a `QuickAddProvider` (default `localQuickAddProvider`), and every reading passes `checkReading` before it is saved. Don't call `parseQuickAdd` or `suggestCategory` from the field.
- **Default account:** new entries, quick add, a transfer's From and new recurring lines (in Settings, setup and Edit plan) start on `defaultAccount` (`balances.ts`) over accounts in `sortAccounts` order (setup: draft order): the account marked `isDefault`, else the first euro bank account, else any euro account, else the first bank account, else the first account. Never `accounts[0]`. A quick-add line written with a euro marker (€, eur, euro) goes to `euroAccount` (the euro part of that rule) when the default is not in euros.
- **Service worker** (`public/sw.js`, registered by `AppInit`):
  - Production only: `next dev` never registers it.
  - Never run `next start` on port 3000, or a production worker sits in front of `next dev` there; `npm run test:offline` uses 3100.
  - Its cache name follows the commit SHA (`NEXT_PUBLIC_BUILD_VERSION`), so commit before building for the phone, or an installed app keeps its old offline copy.
  - Don't enable `experimental.useOffline`: offline taps rely on Next's hard-navigation fallback when an RSC fetch fails.

## Global Constraints

**Code**
- TypeScript `strict`; no `any`.
- **Money:** integer minor units (`Minor`), never floats. Plan, envelope and city amounts are in EUR. Each entry keeps its account's currency in `amountMinor`, plus `eurMinor` converted at save time.
- **Dates:** local `IsoDate` strings (`YYYY-MM-DD`) and `IsoMonth` strings (`YYYY-MM`). Shown as `DD-MM-YYYY` with `formatDate` wherever a full date appears; short labels like "Mon 26 Oct" stay. Weeks run Monday–Sunday. The check-in is on Sunday.
- **Data:** everything lives in the IndexedDB database `studentsbudget`.

**What P1 leaves out**
- No AI calls, server routes, login, analytics or third-party scripts.
- The only outgoing request: `https://api.frankfurter.dev/v2/rates?base=EUR&quotes=…&providers=ecb`. Confirm the endpoint in Frankfurter's docs before coding.

**Text and layout**
- UI language is English. Money is formatted with `Intl.NumberFormat('en-IE', …)`: `€6.50`, and `€63` for headlines.
- Calm wording: overspending reads "€12 over", never "failed" or "warning!".
- Phone first: works at 375 px width, 16 px side gutters, no horizontal page scroll, bottom navigation.
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

## Keeping this file honest

Update this file when Claude gets something wrong twice. Add the rule here, in one line, instead of correcting it again in chat.
