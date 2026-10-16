# StudentsBudget P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an installable web app that works on one phone. It turns a step-by-step setup into a city-aware envelope plan, logs spending in seconds (typed or dictated), shows "Safe to spend this week", charts and guess vs. reality, and stores everything only in the browser.

**Architecture:**
- Next.js (App Router), with every screen a client component reading IndexedDB through Dexie (`useLiveQuery`).
- All money and calendar rules are pure TypeScript in `src/lib` and `src/features/*/*.ts`, unit-tested with Vitest. Screens stay thin.
- No server code and no login. The only network request is the daily ECB exchange rate from Frankfurter.

**Tech stack:**
- Next.js 16, React 19, TypeScript strict
- Tailwind CSS with shadcn/ui; charts are shadcn's Recharts-based components
- Dexie 4 with `dexie-react-hooks`, and Zod
- date-fns
- Vitest with `fake-indexeddb`; Playwright on Chromium and WebKit (iPhone emulation)
- Vercel Hobby and GitHub Actions

Exact versions are whatever `create-next-app` installs on day 1, pinned and listed in `CLAUDE.md`.

**Spec:** `docs/Student Budget App - Concept.md` ([[Student Budget App - Concept]])

## Global Constraints
**Code**
- TypeScript `strict`; no `any`.
- **Money:** integer minor units (`Minor`), never floats. Plan, envelope and city amounts are in EUR. Each entry keeps its account's currency in `amountMinor`, plus `eurMinor` converted at save time.
- **Dates:** local `IsoDate` strings (`YYYY-MM-DD`) and `IsoMonth` strings (`YYYY-MM`). Weeks run Monday–Sunday. The check-in is on Sunday.
- **Data:** everything lives in the IndexedDB database `studentsbudget`.

**What P1 leaves out**
- No AI calls, server routes, login, analytics or third-party scripts.
- The only outgoing request: `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=…`. Confirm the endpoint in Frankfurter's docs before coding.

**Text and layout**
- UI language is English. Money is formatted with `Intl.NumberFormat('en-IE', …)`: `€6.50`, and `€63` for headlines.
- Calm wording: overspending reads "€12 over", never "failed" or "warning!".
- Phone first: works at 375 px width, 16 px side gutters, no horizontal page scroll, bottom navigation.

**Data rules**
- City: Regensburg only. Every city number has a source, a URL and a checked date. A number without a source is labelled "Estimate".
- Guesses are saved once in setup and never edited afterwards.

**Repo**
- A project `.npmrc` with `save-exact=true` (never the global npm config); versions listed in `CLAUDE.md`.
- `.gitattributes` with `* text=auto eol=lf`.
- Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- One branch and one Draft PR per day, from `main`. Nothing is pushed to `main` after the initial commit, and Roshan merges.

## Review Focus
1. **A week that crosses into a new month** (Mon 26 Oct – Sun 1 Nov). On 1 Nov the number must count only November's days and November's spending, and leftover from October must not carry over. Pinned in Task 6 (`counts only the current month's days in a split week`).
2. **Amounts the way people type or dictate them:** "Döner 6 €", "€6", "6€", "6,50", "döner six euros", "2 coffees 7,40". The right amount is picked, and "döner" with no number asks for an amount instead of saving €0. Pinned in Task 8.
3. **No exchange rate available:** offline, Frankfurter down, or first use with an INR account. The last rate stays, labelled with its date; a manual rate always wins; saving an INR entry with no rate at all is refused with a message pointing to Settings. Pinned in Tasks 4 and 9.
4. **A wrong or newer backup file is imported:** random JSON, a newer version, a truncated file. It's rejected with a clear message, and the data on the phone is untouched. Pinned in Task 14.
5. **Data entered in iPhone Safari before installing.** A home-screen app has its own storage, so the setup screen tells iPhone Safari users to install first. Pinned by `shouldShowInstallHint` in Task 7, and checked by hand in Task 15.

---

## Workflow

### Day 0: your steps before day 1 (about 1 h)
1. ✅ Repo created: `SupportRW/StudentsBudget` (public). Settings checklist: [[Student Budget App - Repo Setup]].
2. Install the GitHub CLI with the command below, then run `gh auth login`. The PR steps and the review skills use it.

```bash
winget install --id GitHub.cli -e
```

3. Sign in at vercel.com with GitHub (Hobby plan). You create the account; I can't do that for you.
4. Open a Claude Code session in the repo folder, in normal permission mode.

### Every day
1. Create the day's branch: `feat/p1-day<N>-<slug>`.
   - It starts from `main` once the previous day's PR is merged. Until then, it starts from the previous day's branch (stacked).
   - With "Automatically delete head branches" on, GitHub retargets the next PR to `main` when the merged branch is deleted.
2. Do the day's tasks test-first: write the failing test, watch it fail, write the code, watch it pass, commit.
3. After each task, ask: *"Explain this change to someone who knows Java and SQL, and point out anything new."* Note a concept that comes up twice.
4. Push, then open a Draft PR (`gh pr create --draft`). Its body covers What/Why, Impact, Tested and Reviewers. Check the Vercel preview in desktop Chrome.
5. PR review, following the team's PR review flow, each step in a separate session:
   1. `run-independent-reviews`
   2. `triage-findings`: you pick the rows to fix
   3. `apply-review-fixes`: skip its Jira suggestions, since there's no Jira here
   4. `review-pr-narrow` on your own PR
   5. You merge.
6. Log the day (journal and timesheet).

### Days, PRs and what "done" means

| Day | Branch / PR | Tasks | Done when |
|---|---|---|---|
| 1 | `feat/p1-day1-foundation` | Learning (4 h: TS for Java programmers, async/await, React Quick Start), 1–3 | The empty app installs from a Vercel preview; helpers and database are tested |
| 2 | `feat/p1-day2-plan` | 4–7 | Setup saves a plan with Regensburg ranges; INR rate works, including offline |
| 3 | `feat/p1-day3-logging` | 8–10 | "döner 6" updates "Safe to spend this week" in desktop Chrome |
| 4 | `feat/p1-day4-insights` | 11–15 | Charts, reveal, check-in and backup work; installed and used on the iPhone |

**If it runs over**, cut in this order (from the spec):
1. Task 13's calendar file
2. Task 13's check-in screen
3. Task 12's reveal screen

The guesses are already stored, so nothing is lost.

---

## File structure

| Path | Responsibility |
|---|---|
| `src/lib/money.ts` | `Minor`, currencies, parsing and formatting amounts |
| `src/lib/dates.ts` | `IsoDate`/`IsoMonth` helpers, Monday–Sunday week clipped to its month |
| `src/lib/budget.ts` | Set-asides, plan summary, safe to spend, month status, range warnings |
| `src/lib/fx.ts` | Converting to EUR, fetching ECB rates |
| `src/db/types.ts`, `src/db/db.ts` | Record types, the Dexie database, persistence request |
| `src/db/repo.ts` | Writes that enforce rules (seed, guesses lock, account delete) |
| `src/db/rates.ts` | Daily rate refresh and manual override |
| `src/db/bulk.ts` | Export all, replace all, delete everything |
| `src/data/categories.ts`, `src/data/cities.ts` | Category seed; Regensburg ranges and prices with sources |
| `src/features/<feature>/` | Pure logic + components per feature: `accounts`, `setup`, `entries`, `home`, `charts`, `reveal`, `check-in`, `backup` |
| `src/components/` | Shared UI: `bottom-nav.tsx`, `app-init.tsx`, shadcn components in `ui/` |
| `src/app/<route>/page.tsx` | Thin route files: `/`, `/setup`, `/entries`, `/entries/new`, `/charts`, `/check-in`, `/reveal`, `/settings` |
| `e2e/*.spec.ts`, `e2e/helpers/setup.ts` | Playwright flows; `completeSetup()` fixture |
| `public/weekly-check-in.ics` | Static weekly calendar reminder |

Commands:

| Command | Runs |
|---|---|
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Unit tests sit next to their file as `*.test.ts`.

---

### Task 1: Scaffold, installable shell, CI

**Files:**
- Create (via `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`): the Next.js app
- Create: `src/app/manifest.ts`, `public/icon-192.png`, `public/icon-512.png`, `src/app/apple-icon.png` (180), `src/components/bottom-nav.tsx`, `vitest.config.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `.npmrc`, `.gitattributes`, `CLAUDE.md`
- Icons: simple generated PNGs (a plain "S" on the theme colour is fine), made locally with no new runtime dependency. The manifest references the two `public/` icons.
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `package.json`, `README.md`

**Interfaces:**
- Produces: `NAV_ITEMS: { href: string; label: string }[]` in `bottom-nav.tsx`, starting with Home only. Later tasks add Settings (5), Entries (9) and Charts (11).
- Produces: scripts `test`, `test:e2e`, `typecheck`, `lint`.

- [ ] **Step 1:** Run `create-next-app` as above. Then:
  - write `.npmrc` with `save-exact=true` and `.gitattributes` with `* text=auto eol=lf`; pin the versions `create-next-app` wrote (strip `^`/`~`, then `npm install`)
  - `npx shadcn@latest init`
  - `npm i -D vitest fake-indexeddb @playwright/test`
  - `npx playwright install chromium webkit`
- [ ] **Step 2: Write the failing smoke test** in `e2e/smoke.spec.ts`:

```ts
test('home shows the app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'StudentsBudget' })).toBeVisible();
});
test('manifest makes it installable', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('StudentsBudget');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
});
```

  - `playwright.config.ts`:
    - projects `desktop-chrome` (`devices['Desktop Chrome']`) and `iphone` (`devices['iPhone 15']`)
    - `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }`
  - `vitest.config.ts`: `environment: 'node'`, alias `@` → `./src`, include `src/**/*.test.ts`.
- [ ] **Step 3: Run `npm run test:e2e`.** Expected: FAIL, because the heading and the manifest don't exist yet.
- [ ] **Step 4: Implement**
  - `manifest.ts`: name/short_name `StudentsBudget`, `display: 'standalone'`, `start_url: '/'`, background and theme colours, icons.
  - `layout.tsx`:
    - viewport metadata
    - `appleWebApp: { capable: true, title: 'StudentsBudget' }`
    - a top bar with `<h1>StudentsBudget</h1>` on every page, so the smoke test still passes after Task 7 redirects `/` to `/setup`; page titles are `h2`
    - `<BottomNav />`
  - `page.tsx`: a placeholder.
  - `create-next-app` refuses a folder that already holds `README.md`. Scaffold in a temp folder and move the files in, without touching `docs/`. Keep the README's existing title and description line at the top.
- [ ] **Step 5: Run `npm run test:e2e`, `npm run lint` and `npm run typecheck`.** Expected: all pass in both projects.
- [ ] **Step 6: Write `ci.yml` and `CLAUDE.md`.**
  - `ci.yml` (on PR): `npm ci`, lint, typecheck, `npm test`, `npx playwright install --with-deps chromium webkit`, `npm run test:e2e`.
  - `CLAUDE.md`: stack with pinned versions, commands, the Global Constraints above, "update this file when Claude gets something wrong twice".
- [ ] **Step 7: Commit:** `feat(app): scaffold installable StudentsBudget shell with tests and CI`.
- [ ] **Step 8: Deploy (Roshan):**
  - Push the branch and import the repo in Vercel.
  - Open the preview URL in desktop Chrome. The install icon appears in the address bar.

### Task 2: Money and calendar helpers

**Files:** Create `src/lib/money.ts`, `src/lib/money.test.ts`, `src/lib/dates.ts`, `src/lib/dates.test.ts` (`npm i date-fns`)

**Interfaces (Produces):**
```ts
export type Minor = number;                       // integer cents / paise
export type CurrencyCode = 'EUR' | 'INR' | 'USD' | 'GBP' | 'CHF' | 'CNY' | 'TRY';
export const CURRENCIES: CurrencyCode[];
export function parseAmount(text: string): Minor | null;          // > 0 only
export function formatMoney(m: Minor, c: CurrencyCode, o?: { whole?: boolean }): string;
export function formatRange(minM: Minor, maxM: Minor): string;    // EUR, whole
export type IsoDate = string; export type IsoMonth = string;
export function todayIso(now?: Date): IsoDate;                    // local time
export function monthOf(d: IsoDate): IsoMonth;
export function firstOfMonth(m: IsoMonth): IsoDate;
export function daysInMonth(m: IsoMonth): number;
export function addDays(d: IsoDate, n: number): IsoDate;
export function daysBetween(a: IsoDate, b: IsoDate): number;      // b − a
export function monthsBetween(a: IsoMonth, b: IsoMonth): number;  // b − a
export function weekInMonth(d: IsoDate): { start: IsoDate; end: IsoDate }; // Mon–Sun ∩ month of d
```

- [ ] **Step 1: Write failing tests.**

```ts
expect(parseAmount('6')).toBe(600); expect(parseAmount('6,50')).toBe(650);
expect(parseAmount('6.5')).toBe(650); expect(parseAmount('1234,56')).toBe(123456);
for (const bad of ['0', '-5', 'abc', '6,505', '']) expect(parseAmount(bad)).toBeNull();
expect(formatMoney(650, 'EUR')).toBe('€6.50');
expect(formatMoney(6300, 'EUR', { whole: true })).toBe('€63');
expect(formatMoney(100000, 'INR')).toContain('1,000.00');
expect(formatRange(20000, 26000)).toBe('€200–260');
expect(weekInMonth('2026-10-16')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
expect(weekInMonth('2026-10-30')).toEqual({ start: '2026-10-26', end: '2026-10-31' });
expect(weekInMonth('2026-11-01')).toEqual({ start: '2026-11-01', end: '2026-11-01' });
expect(daysInMonth('2028-02')).toBe(29); expect(monthsBetween('2026-10', '2027-03')).toBe(5);
expect(todayIso(new Date(2026, 9, 16, 23, 30))).toBe('2026-10-16');
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement both files.** Use date-fns for the date maths. Rounding is `Math.round(major * 100)`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(lib): add money and calendar helpers`.

### Task 3: Local database and category seed

**Files:**
- Create: `src/db/types.ts`, `src/db/db.ts`, `src/db/repo.ts`, `src/db/repo.test.ts`, `src/data/categories.ts`, `src/components/app-init.tsx`
- Modify: `src/app/layout.tsx` to mount `<AppInit />`
- Install: `npm i dexie dexie-react-hooks`

**Interfaces (Produces):**
```ts
export type Account = { id: string; name: string; kind: 'bank' | 'cash'; currency: CurrencyCode; openingMinor: Minor; createdAt: string };
export type CategoryKind = 'flexible' | 'fixed' | 'oneoff' | 'income';
export type Category = { id: string; name: string; kind: CategoryKind; order: number };
type EntryBase = { id: string; date: IsoDate; accountId: string; amountMinor: Minor; eurMinor: Minor; note: string; createdAt: string };
export type Entry = (EntryBase & { type: 'expense' | 'income'; categoryId: string })
                  | (EntryBase & { type: 'transfer'; toAccountId: string; toAmountMinor: Minor });
export type OneOff = { id: string; name: string; amountMinor: Minor; createdMonth: IsoMonth; dueMonth: IsoMonth };
export type Amount = { categoryId: string; monthlyMinor: Minor };
export type Plan = { id: 'current'; cityId: 'regensburg'; incomes: Amount[]; fixed: Amount[]; oneOffs: OneOff[]; envelopes: Amount[]; createdOn: IsoDate };
export type Guess = { categoryId: string; monthlyMinor: Minor; guessedOn: IsoDate };
export type Rate = { currency: CurrencyCode; perEur: number; rateDate: IsoDate; fetchedOn: IsoDate; source: 'ecb' | 'manual' };
// db.ts — Dexie 'studentsbudget', version 1:
// accounts 'id' · categories 'id, kind' · entries 'id, date, accountId, categoryId, type' · plan 'id' · guesses 'categoryId' · rates 'currency'
export const db: StudentsBudgetDb;
export async function requestPersistence(): Promise<boolean>;     // navigator.storage.persist()
// repo.ts
export class GuessesLockedError extends Error {}; export class AccountInUseError extends Error {};
export async function ensureSeeded(): Promise<void>;
export async function saveEntry(e: Entry): Promise<void>;
export async function deleteEntry(id: string): Promise<void>;
export async function entriesInRange(from: IsoDate, to: IsoDate): Promise<Entry[]>; // inclusive
export async function saveGuesses(gs: Guess[]): Promise<void>;    // throws GuessesLockedError if any exist
export async function deleteAccount(id: string): Promise<void>;   // throws AccountInUseError if referenced
```

`CATEGORIES` (18 ids, in this order):

| Kind | Categories (id label) |
|---|---|
| flexible | `food` Food & groceries, `eating-out` Eating out, `going-out` Going out, `transport` Transport, `shopping` Shopping, `other` Other |
| fixed | `rent` Rent, `phone` Phone & internet, `insurance` Insurance, `subscriptions` Subscriptions, `transport-pass` Deutschlandticket / semester ticket |
| oneoff | `one-off` One-off costs |
| income | `income-job` Job, `income-parents` Parents, `income-bafoeg` BAföG, `income-sperrkonto` Blocked account, `income-scholarship` Scholarship, `income-other` Other income |

- [ ] **Step 1: Write failing tests** with `import 'fake-indexeddb/auto'`. Clear the db in `beforeEach`.
  - `seeds the 18 categories once`: call `ensureSeeded()` twice, then `db.categories.count()` is `18`.
  - `entriesInRange includes both edge dates`: entries on `2026-10-01`, `2026-10-31` and `2026-11-01`; the range Oct 1–31 returns 2.
  - `saveGuesses refuses to overwrite`: the second call rejects with `GuessesLockedError`.
  - `deleteAccount refuses an account with entries`: rejects with `AccountInUseError`. An unused account is deleted.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `types.ts`, `db.ts`, `repo.ts` and `categories.ts`. `AppInit` (`'use client'`) calls `ensureSeeded()` and `requestPersistence()` once on mount.
- [ ] **Step 4: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(db): add local IndexedDB store with category seed`.

### Task 4: Exchange rates

**Files:**
- Create: `src/lib/fx.ts`, `src/lib/fx.test.ts`, `src/db/rates.ts`, `src/db/rates.test.ts`
- Modify: `src/components/app-init.tsx`

**Interfaces:**
- Consumes: `Rate`, `db` (Task 3); `Minor`, `CurrencyCode`, `IsoDate` (Task 2)
- Produces:
```ts
export type RateMap = Partial<Record<CurrencyCode, Rate>>;
export function toEurMinor(amount: Minor, c: CurrencyCode, rates: RateMap): Minor | null;  // EUR → same; no rate → null
export async function fetchEcbRates(symbols: CurrencyCode[], fetchFn?: typeof fetch):
  Promise<{ rateDate: IsoDate; perEur: Partial<Record<CurrencyCode, number>> }>;      // throws on non-OK
export async function refreshRates(today: IsoDate, fetchFn?: typeof fetch): Promise<'updated' | 'fresh' | 'failed' | 'none-needed'>;
export async function setManualRate(c: CurrencyCode, perEur: number, today: IsoDate): Promise<void>;
export async function clearManualRate(c: CurrencyCode): Promise<void>;
export async function loadRates(): Promise<RateMap>;
```
- `refreshRates`:
  - It fetches only the non-EUR currencies used by accounts (`none-needed` if there are none).
  - At most once a day: if every ECB row has `fetchedOn === today`, it returns `fresh`.
  - It never overwrites `source: 'manual'` rows.

- [ ] **Step 1: Write failing tests.**

```ts
expect(toEurMinor(9500, 'INR', { INR: rate(95) })).toBe(100);
expect(toEurMinor(650, 'EUR', {})).toBe(650);
expect(toEurMinor(100, 'INR', {})).toBeNull();
// fetchEcbRates with a fake fetch returning {amount:1,base:'EUR',date:'2026-10-16',rates:{INR:95.12}}
expect(await fetchEcbRates(['INR'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
```
  - `refreshRates` tests:
    - `returns fresh without fetching when fetched today`
    - `keeps the old rate when the fetch fails`: expect `'failed'`, and the stored INR rate is unchanged
    - `never overwrites a manual rate`
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.** `AppInit` calls `refreshRates(todayIso())` after seeding.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(fx): add daily ECB rates with manual override`.

### Task 5: Accounts, transfers and the settings page

**Files:**
- Create: `src/features/accounts/balances.ts`, `src/features/accounts/balances.test.ts`, `src/features/accounts/accounts-panel.tsx`, `src/features/accounts/rates-panel.tsx`, `src/features/accounts/transfer-form.tsx`, `src/app/settings/page.tsx`, `e2e/accounts.spec.ts`
- Modify: `bottom-nav.tsx` (add Settings)

**Interfaces:**
- Consumes: Tasks 2–4
- Produces:
```ts
export function accountBalance(a: Account, entries: Entry[]): Minor;      // in a.currency
export function totalInEur(accounts: Account[], entries: Entry[], rates: RateMap): { totalMinor: Minor; missingRates: CurrencyCode[] };
export function TransferForm(props: { onSaved?: () => void }): JSX.Element; // reused by Task 9
```

What the screens do:
- **Accounts panel:** list with balances, add and edit (name, bank/cash, currency, opening balance), delete. Delete catches `AccountInUseError` and shows "This account has entries. Delete them first."
- **Rates panel:** for each non-EUR account currency, "1 € = 95.12 INR · ECB, 16 Oct". With a manual rate it shows "· set by you", a manual rate field and "Use ECB rate again". With no rate it shows "No rate yet. Enter one to log INR spending."
- **After saving an account in a non-EUR currency**, the accounts panel calls `refreshRates(todayIso())`, so the rate appears without a reload.
- **Transfer form:** from account, amount, to account, amount received, date, note.

- [ ] **Step 1: Write failing tests.**
  - `balance adds income and transfers in, subtracts expenses and transfers out`:
    - opening 10000, expense 650, income 5000, transfer out 2000 → 12350
    - a transfer in with `toAmountMinor` 1000 adds 1000
  - `totalInEur converts with the rate and reports missing ones`:
    - EUR 10000 + INR 950000 at 95 → 20000
    - INR with no rate → `missingRates: ['INR']` and a total of 10000
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `balances.ts`, then the panels and the settings page.
- [ ] **Step 4: Write the e2e test** `e2e/accounts.spec.ts`. Mock Frankfurter with `page.route('**/api.frankfurter.dev/**', …)` returning INR 95.
  - Add "Home bank", INR, opening 50000 → the list shows `50,000.00`.
  - The rates panel shows "1 € = 95 INR".
  - With the route aborted and a fresh db → "No rate yet".
- [ ] **Step 5: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 6: Commit:** `feat(accounts): add accounts, transfers and rate settings`.

### Task 6: Budget maths and Regensburg numbers

**Files:** Create `src/lib/budget.ts`, `src/lib/budget.test.ts`, `src/data/cities.ts`, `src/data/cities.test.ts`

**Interfaces (Produces):**
```ts
export function setAsideMonthly(o: OneOff, month: IsoMonth): Minor;
export type PlanSummary = { incomeMinor: Minor; fixedMinor: Minor; setAsideMinor: Minor; availableMinor: Minor; envelopesMinor: Minor; overByMinor: Minor };
export function planSummary(plan: Plan, month: IsoMonth): PlanSummary;
export type EnvelopeWeek = { categoryId: string; weekShareMinor: Minor; spentThisWeekMinor: Minor; safeMinor: Minor };
export function safeToSpend(plan: Plan, entries: Entry[], today: IsoDate): { weekStart: IsoDate; weekEnd: IsoDate; totalMinor: Minor; envelopes: EnvelopeWeek[] };
export function monthStatus(plan: Plan, entries: Entry[], month: IsoMonth): { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[];
// src/data/cities.ts (budget.ts imports City from here)
export type CityRange = { categoryId: string; minMinor: Minor; maxMinor: Minor; source: string; url: string; checked: IsoDate };
export type CityPrice = { label: string; minor: Minor; source: string; url: string; checked: IsoDate };
export type City = { id: 'regensburg'; name: 'Regensburg'; ranges: CityRange[]; prices: CityPrice[] };
export const CITIES: { regensburg: City };
// src/lib/budget.ts again
export type RangeWarning = { categoryId: string; typicalMinMinor: Minor; typicalMaxMinor: Minor };
export function rangeWarnings(plan: Plan, city: City): RangeWarning[];  // flexible envelopes below the city's min only; the rent range is information in setup step 1
```

Rules the signatures don't settle:

**`setAsideMonthly`**
- `n = max(1, monthsBetween(createdMonth, dueMonth))`.
- It returns `Math.ceil(amount / n)` for `createdMonth ≤ month < dueMonth`, and 0 otherwise.

**`planSummary`**
- `available = income − fixed − setAside`.
- `overBy = max(0, envelopes − available)`.

**`safeToSpend`**

```
{start,end} = weekInMonth(today); M = monthOf(today); D = daysInMonth(M); first = firstOfMonth(M)
per envelope e:  through = round(e.monthly × (daysBetween(first,end)+1) / D)
                 before  = round(e.monthly × daysBetween(first,start) / D)
                 spentToEnd = Σ eurMinor of expenses in e.categoryId dated first..end
                 weekShare = through − before;  spentThisWeek = Σ … dated start..end
                 safe = through − spentToEnd          // may be negative
total = Σ safe
```
Transfers and expenses in non-envelope categories never count.

- [ ] **Step 1: Write failing tests.** The fixture plan: `incomes` 90000; `fixed` rent 40000; `oneOffs` semester fee 30000 (`2026-10` → `2027-03`); `envelopes` food 31000 and going-out 15500.

```ts
expect(setAsideMonthly(fee, '2026-10')).toBe(6000); expect(setAsideMonthly(fee, '2027-02')).toBe(6000);
expect(setAsideMonthly(fee, '2027-03')).toBe(0);   expect(setAsideMonthly(fee, '2026-09')).toBe(0);
expect(planSummary(plan, '2026-10')).toEqual({ incomeMinor: 90000, fixedMinor: 40000, setAsideMinor: 6000,
  availableMinor: 44000, envelopesMinor: 46500, overByMinor: 2500 });
// food only, entries: food 5000 on 2026-10-05, food 2000 on 2026-10-14
const s = safeToSpend(foodOnly, entries, '2026-10-16');
expect(s.weekStart).toBe('2026-10-12'); expect(s.weekEnd).toBe('2026-10-18');
expect(s.envelopes[0]).toEqual({ categoryId: 'food', weekShareMinor: 7000, spentThisWeekMinor: 2000, safeMinor: 11000 });
```
  - `counts only the current month's days in a split week` (Review Focus 1): November food 30000, an October entry of food 9999 on `2026-10-31`, today `2026-11-01` → total `1000`.
  - `goes negative when overspent`: food 20000 on `2026-10-14` → safe `-2000`.
  - `ignores transfers and fixed-category expenses`.
  - `warns when food is below the city minimum`: using a small fixture City (not the researched Regensburg numbers), plan food 15000 with a city food min of 20000 → one warning for `food`; food 21000 → none.
  - In `cities.test.ts`:
    - `every Regensburg number has source, url, checked date and min ≤ max`
    - `covers rent and the six flexible categories`
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `budget.ts`.
- [ ] **Step 4: Research and fill `cities.ts`.** Use web search, one source per number, with `checked` set to the research date.
  - **Ranges:** rent (Studierendenwerk Niederbayern/Oberpfalz dorm and WG room prices) and the six flexible envelopes (DSW Sozialerhebung student spending, scaled to Regensburg when there's no local figure).
  - **Prices:** Mensa main meal (student price), Deutschlandticket per month, a beer in a bar, club entry, gym per month.
  - Mark any number without a solid source as `source: 'Estimate'`, and list those in the PR body.
- [ ] **Step 5: Run `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit:** `feat(budget): add envelope maths and Regensburg cost ranges`.

### Task 7: Setup wizard

**Files:**
- Create: `src/features/setup/draft.ts`, `src/features/setup/draft.test.ts`, `src/features/setup/setup-wizard.tsx`, `src/features/setup/steps/{city-rent,accounts,income,fixed,one-offs,guesses,envelopes}.tsx`, `src/features/setup/install-hint.tsx`, `src/app/setup/page.tsx`, `e2e/helpers/setup.ts`, `e2e/setup.spec.ts`
- Modify: `src/app/page.tsx` (no plan → `router.replace('/setup')`), `src/app/settings/page.tsx` ("Edit plan" → `/setup?edit=1`)

**Interfaces:**
- Consumes: `parseAmount` and `formatRange` (2), `db`, `saveGuesses` and `CATEGORIES` (3), `planSummary`, `rangeWarnings` and `CITIES` (6)
- Produces:
```ts
export type SetupDraft = { rentMinor: Minor; accounts: Pick<Account, 'name' | 'kind' | 'currency' | 'openingMinor'>[];
  incomes: Amount[]; fixed: Amount[]; oneOffs: Pick<OneOff, 'name' | 'amountMinor' | 'dueMonth'>[]; guesses: Amount[]; envelopes: Amount[] };
export function draftToRecords(d: SetupDraft, today: IsoDate): { plan: Plan; guesses: Guess[]; accounts: Account[] };
export type StepId = 'city-rent' | 'accounts' | 'income' | 'fixed' | 'one-offs' | 'guesses' | 'envelopes';
export function validateStep(step: StepId, d: SetupDraft): string[];
export function shouldShowInstallHint(env: { isIos: boolean; standalone: boolean }): boolean;
export async function completeSetup(page: Page, overrides?: Partial<SetupFixture>): Promise<void>; // e2e helper
```

**Steps, in order, with their copy:**

| # | Step | Content |
|---|---|---|
| 1 | City and rent | City (Regensburg only), rent |
| 2 | Accounts | Prefilled: "Local bank" EUR, "Home bank" INR, "Cash" EUR, each with an opening balance |
| 3 | Income | Amount per source, with the hint "If it varies, enter a low estimate." |
| 4 | Fixed costs | One amount per fixed category except rent, which step 1 already asked for |
| 5 | One-off costs | Name, amount, due month |
| 6 | Guesses | "What do you think you spend on {category} a month?" for each flexible category |
| 7 | Envelopes | Per envelope: "Students here: €200–260", and below the range "Below what students here typically need." |

- The footer reads "Available €440 · Planned €465 · Over by €25".
- **Save plan** is disabled while `overByMinor > 0`. It writes accounts, plan and guesses in one Dexie transaction, then goes to `/`.
- **Edit mode** (`?edit=1`): prefilled from the saved plan, and skips steps 2 and 6. Accounts are edited in Settings, and guesses are locked.
- **Install hint** (on iOS Safari when not standalone): "Install first: tap Share → Add to Home Screen, then set up there. Data entered in Safari stays in Safari."

- [ ] **Step 1: Write failing unit tests.**
  - `draftToRecords`:
    - rent becomes `plan.fixed` `{ categoryId: 'rent', monthlyMinor: rentMinor }`
    - each one-off gets `createdMonth: '2026-10'` for today `2026-10-16`
    - guesses get `guessedOn: '2026-10-16'`
    - `plan.createdOn` is `'2026-10-16'`
  - `validateStep('guesses')` with no eating-out guess → `['Add a guess for Eating out']`. A guess of 0 is valid.
  - `validateStep('accounts')` with no accounts → `['Add at least one account']`.
  - `shouldShowInstallHint`: `{isIos:true, standalone:false}` → true; standalone → false; not iOS → false.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `draft.ts`, the wizard and its steps, and the install hint.
- [ ] **Step 4: Write the e2e helper and tests.**
  - `completeSetup` fixture:
    - rent 400; accounts Local bank EUR 1000, Home bank INR 50000, Cash EUR 50
    - incomes parents 500 and job 400
    - other fixed costs 0
    - one-off "Semester fee" 300, due 2027-03
    - guesses food 200, eating-out 80, going-out 60, transport 20, shopping 40, other 20
    - envelopes food 310, eating-out 124, the rest 0
    - Frankfurter mocked at INR 95
  - `setup.spec.ts`:
    - `blocks saving while over budget`: eating-out 155 → "Over by €25" is visible and Save is disabled.
    - `saves and lands on home`: after `completeSetup`, the URL is `/`, and after a reload the plan is still there (home shows "Safe to spend this week").
- [ ] **Step 5: Run `npm test` and `npm run test:e2e`.** Expected: PASS in both projects.
- [ ] **Step 6: Commit:** `feat(setup): add step-by-step plan setup with city ranges`.

### Task 8: Quick-add parser

**Files:** Create `src/features/entries/quick-add.ts`, `src/features/entries/quick-add.test.ts`

**Interfaces (Produces):**
```ts
export function parseQuickAdd(text: string): { amountMinor: Minor; note: string } | null;
export function keywordOf(note: string): string | null;   // first word, lower-cased, trimmed
export function suggestCategory(note: string, history: Entry[]): string | null; // most recent expense with same keyword
```

How the parser picks the amount:
- **Candidates:**
  - digit tokens that pass `parseAmount`, with `€` attached or not
  - runs of English number words: zero–nineteen, twenty…ninety, compounds like "twenty five" or "twenty-five", and "hundred"
- **Currency markers:** `€`, `eur`, `euro`, `euros` (any case).
- **Choice:** the candidate next to a marker wins; otherwise the last candidate.
- **Note:** the text with the chosen amount and its marker removed, whitespace collapsed.

- [ ] **Step 1: Write failing tests** (Review Focus 2).

```ts
const cases: [string, number, string][] = [
  ['döner 6', 600, 'döner'], ['Döner 6 €', 600, 'Döner'], ['€6 coffee', 600, 'coffee'],
  ['coffee 6€', 600, 'coffee'], ['kebab 6,50', 650, 'kebab'], ['döner six euros', 600, 'döner'],
  ['pizza twenty-five euros', 2500, 'pizza'], ['2 coffees 7,40', 740, '2 coffees'], ['2 coffees €7', 700, '2 coffees'],
];
for (const [t, a, n] of cases) expect(parseQuickAdd(t)).toEqual({ amountMinor: a, note: n });
expect(parseQuickAdd('döner')).toBeNull(); expect(parseQuickAdd('')).toBeNull();
expect(keywordOf('Döner with Tom')).toBe('döner'); expect(keywordOf('  ')).toBeNull();
```
  - `suggestCategory`:
    - `'döner again'`, with history containing an older "Döner" in eating-out and a newer "döner" in food → `'food'`
    - no match → `null`
    - transfers are ignored
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(entries): parse typed and dictated quick-add text`.

### Task 9: Entries: quick-add field, manual form, list

**Files:**
- Create: `src/features/entries/build-entry.ts`, `src/features/entries/build-entry.test.ts`, `src/features/entries/quick-add-field.tsx`, `src/features/entries/entry-form.tsx`, `src/features/entries/entries-list.tsx`, `src/app/entries/page.tsx`, `src/app/entries/new/page.tsx`, `e2e/entries.spec.ts`
- Modify: `bottom-nav.tsx` (add Entries)

**Interfaces:**
- Consumes: `parseQuickAdd` and `suggestCategory` (8), `toEurMinor` and `loadRates` (4), `saveEntry` and `deleteEntry` (3), `TransferForm` (5)
- Produces:
```ts
export type EntryInput =
  | { id?: string; type: 'expense' | 'income'; date: IsoDate; accountId: string; amountMinor: Minor; categoryId: string; note: string }
  | { id?: string; type: 'transfer'; date: IsoDate; accountId: string; amountMinor: Minor; toAccountId: string; toAmountMinor: Minor; note: string };
export function buildEntry(input: EntryInput, account: Account, rates: RateMap, now: Date, existing?: Entry):
  { ok: true; entry: Entry } | { ok: false; error: string };
export function QuickAddField(): JSX.Element;   // used by Home (10) and Check-in (13)
```

What the screens do:
- **Quick-add field:**
  - It sits at the top of `/entries` (and on Home from Task 10), so this task's e2e test has a page to run on.
  - Unparseable input shows "Add an amount, like “döner 6”".
  - When `suggestCategory` has no answer, it shows chips for the flexible categories.
  - It saves to the first `cash` account (or the first account), dated today.
  - Toast: "Saved €6.00 · Eating out", with an **Undo** button that deletes the entry.
- **Entry form:** tabs Expense / Income / Transfer, the last reusing `TransferForm`.
- **Entries list:**
  - Grouped by date, newest first. It reads `?category=` and `?month=`.
  - Tapping an entry opens the edit form. Delete asks for confirmation first.

- [ ] **Step 1: Write failing tests.**
  - `converts INR at save time`: 95000 INR at 95 → `eurMinor` 1000.
  - `refuses INR without a rate` (Review Focus 3): `{ ok: false, error: 'No exchange rate for INR yet. Set one in Settings.' }`.
  - `transfer stores eurMinor of the sending side`.
  - `editing keeps id and createdAt`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `build-entry.ts`, the field, the form and the list.
- [ ] **Step 4: Write the e2e test** `e2e/entries.spec.ts`, after `completeSetup`:
  - Type "döner 6", choose Eating out → the list shows "döner" and "€6.00".
  - Type "döner 4" → it saves without the chips, because the category was learned.
  - Undo removes it.
- [ ] **Step 5: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 6: Commit:** `feat(entries): add quick add, entry form and entries list`.

### Task 10: Home screen

**Files:**
- Create: `src/features/home/home.tsx`, `src/features/home/safe-to-spend-card.tsx`, `src/features/home/envelope-list.tsx`, `e2e/home.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `safeToSpend` and `monthStatus` (6), `totalInEur` (5), `QuickAddField` (9), `formatMoney` (2)

What the screen shows:
- Quick-add field at the top.
- **"Safe to spend this week"** with `formatMoney(total, 'EUR', { whole: true })`. A negative total reads "€12 over this week".
- The week underneath: "Mon 12 – Sun 18 Oct".
- Each envelope: name, a progress bar of spent vs. planned this month, and "€… left this week".
- "Across all accounts: €…", plus "INR rate missing" when that applies.

- [ ] **Step 1: Write the failing e2e test.** Set `page.clock.setFixedTime(new Date('2026-10-16T12:00:00'))`, then `completeSetup`.
  - Home shows `€252` (food 18000 + eating-out 7200).
  - After quick add "döner 6" in Eating out it shows `€246`.
  - With "döner 300" it shows "over this week".
- [ ] **Step 2: Run `npm run test:e2e -- home`.** Expected: FAIL.
- [ ] **Step 3: Implement** the home components.
- [ ] **Step 4: Run `npm run test:e2e`.** Expected: PASS in both projects.
- [ ] **Step 5: Commit:** `feat(home): show safe to spend this week and envelopes`.

### Task 11: Charts

**Files:**
- Create: `src/features/charts/aggregate.ts`, `src/features/charts/aggregate.test.ts`, `src/features/charts/charts-view.tsx`, `src/app/charts/page.tsx`
- Modify: `bottom-nav.tsx` (add Charts)
- Install: `npx shadcn add chart`

**Interfaces (Produces):**
```ts
export function spendingByCategory(entries: Entry[], plan: Plan, month: IsoMonth): { categoryId: string; spentMinor: Minor; plannedMinor: Minor | null }[]; // spent desc
export function incomeBySource(entries: Entry[], month: IsoMonth): { categoryId: string; amountMinor: Minor }[];
export function categoryHistory(entries: Entry[], categoryId: string, endMonth: IsoMonth, count?: number): { month: IsoMonth; spentMinor: Minor }[]; // default 6, oldest first
```

What the screen shows:
- A month switcher.
- Spending by category as horizontal bars, spent vs. planned.
- Income by source as bars.
- The selected category's last 6 months as bars.
- Tapping a bar opens `/entries?category=<id>&month=<m>`.

- [ ] **Step 1: Write failing tests.**
  - `excludes transfers and uses eurMinor`
  - `incomeBySource counts only income entries`
  - `categoryHistory zero-fills empty months, oldest first, length 6`
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `aggregate.ts` and the view.
- [ ] **Step 4: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(charts): add spending, income and category history charts`.

### Task 12: Guess vs. reality

**Files:**
- Create: `src/features/reveal/reveal.ts`, `src/features/reveal/reveal.test.ts`, `src/features/reveal/reveal-view.tsx`, `src/app/reveal/page.tsx`
- Modify: `src/features/home/home.tsx` (reveal card)

**Interfaces (Produces):**
```ts
export const REVEAL_MIN_DAYS = 21;
export function guessVsReality(guesses: Guess[], entries: Entry[], startedOn: IsoDate, today: IsoDate):
  { unlocked: boolean; unlockOn: IsoDate; rows: { categoryId: string; guessMinor: Minor; actualMonthlyMinor: Minor; diffMinor: Minor }[] };
export function monthRecap(guesses: Guess[], plan: Plan, entries: Entry[], month: IsoMonth):
  { rows: { categoryId: string; guessMinor: Minor; plannedMinor: Minor; spentMinor: Minor }[]; leftoverMinor: Minor };
```

Rules:
- `startedOn = plan.createdOn`; `unlockOn = addDays(startedOn, 21)`; `unlocked = today ≥ unlockOn`.
- `actualMonthly = round(spent in [startedOn, today] × 30 / (daysBetween(startedOn, today) + 1))`.
- `leftover = Σ planned − Σ spent` over the flexible envelopes (it can be negative).

Copy:
- Each row: "You guessed €80. It was €190."
- Locked: "Your guesses unlock on 22 Oct. Keep logging."
- Unlocked: an "Adjust my plan" button that opens `/setup?edit=1`.
- Recaps for each completed month: "€15 left over → savings".
- The home card shows the unlock date until the reveal unlocks.

- [ ] **Step 1: Write failing tests.**
  - startedOn `2026-10-01`, today `2026-10-21` → `unlocked: false`, `unlockOn: '2026-10-22'`; today `2026-10-22` → `unlocked: true`.
  - Today `2026-10-30`, eating-out spent 19000, guess 8000 → `actualMonthlyMinor: 19000`, `diffMinor: 11000`.
  - `monthRecap`: food planned 31000 / spent 25000 and eating-out 15500 / 20000 → `leftoverMinor: 1500`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `reveal.ts`, the view and the home card.
- [ ] **Step 4: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 5: Commit:** `feat(reveal): add guess vs reality and monthly recap`.

### Task 13: Weekly check-in and calendar reminder

**Files:**
- Create: `src/features/check-in/week-line.ts`, `src/features/check-in/week-line.test.ts`, `src/features/check-in/check-in-view.tsx`, `src/app/check-in/page.tsx`, `public/weekly-check-in.ics`, `src/features/check-in/ics.test.ts`, `e2e/check-in.spec.ts`
- Modify: `src/features/home/home.tsx` (check-in card, highlighted on Sundays)

**Interfaces:**
- Consumes: `safeToSpend(...).envelopes` (6), `QuickAddField` (9)
- Produces: `export function weekLine(e: EnvelopeWeek): string;`

What the screen shows:
- The week range, then one `weekLine` per envelope.
- This week's entries.
- "Forgot something? Add it here" with the `QuickAddField`.
- A link "Add weekly reminder to calendar" pointing to `/weekly-check-in.ics`.
- The `.ics` file:
  - `VCALENDAR`/`VEVENT` with `SUMMARY:StudentsBudget weekly check-in`
  - a floating `DTSTART:20261018T180000` (local 18:00), `DURATION:PT10M`
  - `RRULE:FREQ=WEEKLY;BYDAY=SU`

- [ ] **Step 1: Write failing tests.**
  - `weekLine({ weekShareMinor: 7000, spentThisWeekMinor: 2000, … })` → `'€70 planned · €20 spent · €50 under'`.
  - With spent 8200 → `'€70 planned · €82 spent · €12 over'`.
  - `ics.test.ts` reads the file and checks that it contains `BEGIN:VCALENDAR`, `RRULE:FREQ=WEEKLY;BYDAY=SU` and `DTSTART:20261018T180000`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** the view and the file.
- [ ] **Step 4: Write the e2e test:** the check-in page shows a line per envelope; the link's `href` is `/weekly-check-in.ics`; a request to it returns a `text/calendar` content type.
- [ ] **Step 5: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 6: Commit:** `feat(check-in): add weekly check-in and calendar reminder`.

### Task 14: Backup, restore, delete everything

**Files:**
- Create: `src/features/backup/backup.ts`, `src/features/backup/backup.test.ts`, `src/db/bulk.ts`, `src/db/bulk.test.ts`, `src/features/backup/backup-panel.tsx`, `e2e/backup.spec.ts`
- Modify: `src/app/settings/page.tsx`

**Interfaces (Produces):**
```ts
export const BACKUP_VERSION = 1;
export type BackupData = { accounts: Account[]; categories: Category[]; entries: Entry[]; plan: Plan | null; guesses: Guess[]; rates: Rate[] };
export function serializeBackup(d: BackupData, now: Date): string;   // { app: 'studentsbudget', version: 1, exportedAt, data }
export function parseBackup(text: string): { ok: true; data: BackupData; exportedAt: string } | { ok: false; error: string }; // Zod
export async function exportAll(): Promise<BackupData>;
export async function replaceAll(d: BackupData): Promise<void>;      // one transaction across all tables
export async function deleteEverything(): Promise<void>;             // db.delete(), then reopen
```

What the panel does:
- **Export:**
  - The file is `studentsbudget-backup-YYYY-MM-DD.json`.
  - It uses `navigator.share({ files })` when `navigator.canShare` allows it, which is the iPhone share sheet. Otherwise it's a normal download.
- **Import:**
  - Pick a file, then `parseBackup`.
  - Confirm: "Replace all data on this device with the backup from 16 Oct?"
  - Then `replaceAll` and a reload.
- **Delete everything:** type `DELETE` to confirm, then `deleteEverything` and go to `/setup`.

- [ ] **Step 1: Write failing tests** (Review Focus 4).
  - A serialize → parse round trip gives the same data.
  - `parseBackup('not json')` → error `"This isn't a StudentsBudget backup file."`
  - Version 2 → `"This backup is from a newer version of the app."`
  - Missing `data.entries` → `"This backup file is incomplete."`
  - `replaceAll` replaces existing rows: the old entry is gone and the new one is present.
  - `deleteEverything` leaves 0 rows in every table.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** `backup.ts`, `bulk.ts` and the panel.
- [ ] **Step 4: Write the e2e test** (desktop-chrome project):
  1. `completeSetup` and quick add "döner 6".
  2. Export: catch the `download` event and save the file.
  3. Delete everything → you land on `/setup`.
  4. Import the file → "döner" is back in Entries.
  5. Importing a `.txt` file shows the error, and the data is unchanged.
- [ ] **Step 5: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 6: Commit:** `feat(backup): add backup export, restore and delete everything`.

### Task 15: Phone check and README

**Files:** Modify `README.md` (what it is, install on iPhone, commands, privacy) and `CLAUDE.md` (anything learned)

- [ ] **Step 1: Run the full suite.** `npm run lint && npm run typecheck && npm test && npm run test:e2e`. Expected: all green.
- [ ] **Step 2: Check desktop Chrome** on the Vercel preview, or on a local `npm run build && npm run start` if Vercel isn't connected yet: install, set up, quick add, charts, check-in, export, delete, import.
- [ ] **Step 3: iPhone (Roshan), after `main` is deployed to production:**
  1. Safari → the install hint shows.
  2. Share → Add to Home Screen, then open the installed app.
  3. Set up.
  4. Use the keyboard mic: say "Döner 6 Euro", then "coffee six euros". Both are saved with the right amounts.
  5. Airplane mode → the app still opens, and the INR rate shows its date.
  6. Export → the share sheet → save to Files.
  7. Delete everything → import from Files → the data is back.
- [ ] **Step 4: Record results in the PR body.** Write each manual check down, and turn any failure into a fix commit before merging.
- [ ] **Step 5: Commit:** `docs: add README with install steps and privacy notes`.
- [ ] **Step 6: Finish the branch** with `superpowers:finishing-a-development-branch`, then the PR review flow from the Workflow section.

---

## Execution method
**Chosen: subagent-driven (2026-10-16).** A fresh subagent implements each task, and a fresh reviewer checks it before the next one starts. A whole-branch review runs at the end. Each day still ends with the team's PR review flow from the Workflow section.

Steps the subagents don't do, because they're Roshan's:
- Day 0
- Task 1 Step 8 (Vercel)
- Task 15 Step 3 (iPhone)
- pushing and merging

## Verification
- **Per task:** the named tests fail first, then pass. `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e` are green before every commit.
- **Per PR:** CI is green, the Vercel preview works in desktop Chrome, and the review flow is done.
- **End of P1:**
  - Task 15's iPhone checklist passes on the installed app.
  - The concept's P1 success criteria are reachable: installed, used instead of Expense Keep, a cash entry in under 10 seconds.
