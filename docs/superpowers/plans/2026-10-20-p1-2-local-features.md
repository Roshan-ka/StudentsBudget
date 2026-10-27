# StudentsBudget P1.2 Implementation Plan: local-first features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** five features that run fully on the phone today, each behind an interface a server or the AI phase can fill later:
- rule-based swaps
- personal badges
- a discount list
- a quick-add provider interface
- a local profile

**Order** (Roshan's choice): Task 1 F2 → Task 2 storage → Task 3 F3 → Task 4 F4 → Task 5 F5 → Task 6 F7. Day A is Tasks 1–3; Day B is Tasks 4–6. Each day gets its own branch and Draft PR.

**Spec:** `docs/Student Budget App - Concept.md` ([[Student Budget App - Concept]]), sections 9, 11, 12 and 13, plus the "P1.2" notes added with this plan. Open items: [[Student Budget App - P1 follow-ups]].

## Global Constraints
**Code**
- TypeScript `strict`; no `any`.
- **Money:** integer minor units (`Minor`), never floats; plan and city amounts in EUR.
- **Dates:** local `IsoDate`/`IsoMonth` strings, shown as `DD-MM-YYYY` via `formatDate`. Weeks run Monday–Sunday.
- **Data:** everything lives in IndexedDB `studentsbudget`. Never query Dexie during render. A schema change adds a new `db.version(n)`. New ids come from `newId()` (`src/lib/new-id.ts`).

**What stays out**
- No server code, login, AI calls, analytics or third-party scripts.
- The only outgoing request is Frankfurter.
- No new npm dependencies.

**Text and layout**
- English, calm wording ("€12 over", never "failed"). No loss or guilt wording in badges.
- Phone first: 375 px, 16 px gutters, no horizontal scroll.

**Data rules**
- Every city number, swap amount and discount has a source, a URL and a checked date. A number no page states is labelled "Estimate".
- No alcohol deals or drinking tips.
- Guesses are never edited.

**Repo**
- Everything goes only to `SupportRW/StudentsBudget`.
- One branch and one Draft PR per day; Roshan merges.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- E2e locators are hidden-page-safe (`getByRole`, exact names).
- A new route goes into `public/sw.js`'s page list and `e2e/offline.spec.ts`.

## Review Focus
1. **Every number shown has a source.** That covers swaps, discounts, and the semester dates in the profile.
2. **Badges never change after the fact.** Week snapshots are idempotent, and a plan edit doesn't rewrite past weeks.
3. **Old backups still restore** after the v3 schema: v1, v2 and Roshan's demo fixture.
4. **Quick add behaves exactly as before** behind the new provider interface.

---

### Task 1: F2, rule-based swaps

**Files:**
- Create: `src/data/swaps.ts` (+ test), `src/features/swaps/suggest.ts` (+ test), `src/features/swaps/swap-line.tsx`, `e2e/swaps.spec.ts`
- Modify: `src/features/home/envelope-list.tsx` (the `EnvelopeItem` row), `src/features/check-in/check-in-view.tsx` (the `WeekPart` rows)

**Interfaces (Produces):**
```ts
// src/data/swaps.ts
export type Swap = { id: string; categoryId: string; title: string; body: string;
  fromMinor: Minor; toMinor: Minor; per: string; // e.g. 'meal', 'ticket', 'month'
  source: string; url: string; checked: IsoDate; tipId?: string };
export const SWAPS: Swap[];
// src/features/swaps/suggest.ts
export type Suggestion = { categoryId: string; swap: Swap; savingPerUseMinor: Minor };
export interface SuggestionProvider { suggest(ctx: { rows: { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[]; today: IsoDate }): Suggestion[] }
export const localSuggestions: SuggestionProvider;
```

**What it does:**
- **Data:**
  - Every swap belongs to a **flexible** category: food, eating-out, going-out, transport, shopping or study.
  - Its two amounts per use are stated on the source page, or the swap reads "Estimate".
  - Reuse the numbers already sourced in `src/data/cities.ts` and `src/data/tips.ts`, for example the Mensa main dish against a restaurant meal, or a Deutschlandticket student upgrade against single tickets.
  - Don't invent a number. If no source states it, there's no swap.
  - Aim for 1–3 swaps per covered category.
- **Rules:**
  - A row gets at most one suggestion.
  - It qualifies when the row is over plan (`spentMinor > plannedMinor`), or when spending passes 90% of plan before the last 7 days of the month.
  - Pick the swap with the largest `fromMinor − toMinor`.
  - Rows planned at €0 with nothing spent get nothing. So do categories with no swap.
- **UI:**
  - Under a qualifying envelope row on Home, and under a qualifying row in the check-in: one line, "Try this: <title> · save about €X per <per>".
  - Tapping it shows the body, the source with its checked date (reuse `RangeSource` from `src/features/setup/steps/range-source.tsx`) and the linked tip.
  - Calm wording. Nothing shows when nothing qualifies.
- **Later:** the AI phase implements `SuggestionProvider` too and must keep citing sources.

- [ ] **Step 1: Failing tests:**
  - **data:** every swap has a flexible `categoryId`, `fromMinor > toMinor > 0`, a source, an https URL and a checked date; ids are unique
  - **rules:** over → one suggestion; 92% on day 10 → one; 92% on day 26 → none; under → none; a category without a swap → none; the largest saving wins
- [ ] **Step 2: Implement**, including a research pass that checks every number against its source page.
- [ ] **Step 3: e2e** (both projects, 375 px): seed an over eating-out envelope, then the Home row shows "Try this", it opens with a source, and the check-in row shows it too. No horizontal scroll.
- [ ] **Step 4: Commit:** `feat(swaps): suggest a sourced swap where an envelope runs over`.

### Task 2: Storage v3 for badges, discounts and the profile

**Files:** `src/db/types.ts`, `src/db/db.ts` (+ test), `src/db/bulk.ts` (+ test), `src/features/backup/backup.ts` (+ test)

**Interfaces (Produces):**
```ts
export type WeekResult = { weekStart: IsoDate; weekEnd: IsoDate; plannedMinor: Minor; spentMinor: Minor;
  foodSpentMinor: Minor; eatingOutSpentMinor: Minor; handLoggedCount: number; paused: boolean; recordedAt: string };
export type DiscountVote = { discountId: string; vote: 'works' | 'outdated'; on: IsoDate };
export type Profile = { id: 'current'; name: string; university: 'ur' | 'oth' | 'other' | '';
  semesterStart: IsoDate | ''; semesterEnd: IsoDate | ''; updatedAt: string };
// db.version(3).stores({ weekResults: 'weekStart', discountVotes: 'discountId', profile: 'id' })
// BackupData gains weekResults, discountVotes, profile: Profile | null; BACKUP_VERSION = 3; READABLE_VERSIONS = [1, 2, 3]
```

**What it does:**
- **Schema:** `db.version(3)` lists only the new stores.
- **`bulk.ts`:** `allTables()`, `exportAll` and `replaceAll` include the new tables. The profile is one row, like the plan.
- **Backup v3:**
  - The schema gives the new keys defaults (`[]`, `null`), so v1 and v2 files restore without them.
  - `keyLists` checks for duplicate `weekStart` and `discountId`.
  - Amounts in week results must be ≥ 0.
  - The two-way type-equality check stays intact.

- [ ] **Step 1: Failing tests:**
  - a v2 database upgrades to v3 with every row kept, and `verno` is 3
  - export → parse → replace round-trips all tables
  - v1, v2 and `fixtures/studentsbudget-demo-2026-10.json` still restore
  - a duplicate `weekStart` is refused
- [ ] **Step 2: Implement.** Run the full suite.
- [ ] **Step 3: Commit:** `feat(db): add storage for weekly results, discount votes and the profile`.

### Task 3: F3, personal badges

**Files:**
- Create: `src/features/badges/week-results.ts` (+ test), `src/features/badges/badges.ts` (+ test), `src/features/badges/badges-card.tsx`, `src/features/badges/badges-view.tsx`, `src/app/badges/page.tsx`, `e2e/badges.spec.ts`
- Modify: `src/components/app-init.tsx` (record weeks after recurring posting), `src/features/home/home.tsx` (the card), `src/features/check-in/check-in-view.tsx` (the "I was away this week" toggle), `public/sw.js` (the page list), `e2e/offline.spec.ts`

**Interfaces (Produces):**
```ts
export function completedWeeks(plan: Plan, today: IsoDate): { start: IsoDate; end: IsoDate }[]; // Mon–Sun weeks since plan.createdOn, fully past
export function weekResultOf(plan: Plan, entries: Entry[], week: { start: IsoDate; end: IsoDate }): Omit<WeekResult, 'paused' | 'recordedAt'>;
export async function recordCompletedWeeks(today: IsoDate): Promise<{ recorded: number }>; // idempotent by weekStart, one rw transaction
export type Badge = { id: 'under-budget-week' | 'logging-streak' | 'ramen-royalty' | 'latte-survivor'; title: string;
  tier: 'bronze' | 'silver' | 'gold' | null; progress: string; earnedOn: IsoDate | null };
export function badgesFrom(results: WeekResult[], semesterWeeks: number): Badge[];
```

**What it does:**
- **Week snapshots:**
  - A week counts as planned vs spent the way the check-in measures it: envelopes only, the sum of `weekShareMinor` and `spentThisWeekMinor`. A week split by a month boundary adds its two parts (`safeToSpend` for each part's last day).
  - `handLoggedCount` counts entries whose `createdAt` falls in the week, recurring ones excluded.
  - Recording runs on app open and on `visibilitychange`, after the recurring poster. It never overwrites an existing `weekStart`, so later plan edits don't change past weeks.
  - The first run backfills with the current plan.
- **"I was away this week":** a toggle in the check-in for the current week. It sets `paused` on that week's result when it's recorded (and on an existing one).
- **Badges** (Concept §9: earned, never bought, never reward spending, weekly and pausable):
  - **Under-Budget Week:** counts weeks with `spentMinor ≤ plannedMinor`; bronze 4, silver 12, gold `semesterWeeks` (26 until the profile gives semester dates).
  - **Logging Streak:** consecutive recorded weeks with `handLoggedCount > 0`. A paused week neither breaks nor adds.
  - **Ramen Royalty:** your cheapest food week so far (food > 0).
  - **Latte Survivor:** a month whose eating-out spending is at most half of your first full month's.
  - Progress copy is calm, e.g. "3 of 4 weeks" or "Your streak is paused". Never "lost" or "broken".
- **UI:** a small Home card "Badges" (earned count plus the next one) linking to `/badges`, which lists all four with tier, progress and the date earned.

- [ ] **Step 1: Failing tests:**
  - **weeks:** completed-week list across a month boundary and a year end; split-week sum; recording twice doesn't duplicate; a plan edit after recording leaves stored weeks unchanged
  - **badges:** tiers at 3/4, 11/12 and gold; a streak with a paused week; Ramen and Latte rules; nothing earned on no data
- [ ] **Step 2: Implement.**
- [ ] **Step 3: e2e:** seed entries over five past weeks with a clock, then Home shows the card and `/badges` shows the bronze Under-Budget Week; the "I was away" toggle keeps the streak; `/badges` opens offline (`e2e/offline.spec.ts`).
- [ ] **Step 4: Commit:** `feat(badges): record each finished week and award personal badges`.

### Task 4: F4, the discount list

**Files:**
- Create: `src/data/discounts.ts` (+ test), `src/features/discounts/discounts.ts` (+ test), `src/features/discounts/discounts-view.tsx`, `e2e/discounts.spec.ts`
- Modify: `src/features/tips/tips-view.tsx` (a "Tips | Discounts" switch)

**Interfaces (Produces):**
```ts
export type Discount = { id: string; place: string; address: string; offer: string; conditions: string;
  categoryId: string; source: string; url: string; checked: IsoDate };
export interface DiscountSource { list(): Promise<Discount[]> } // bundled now, server later
export const bundledDiscounts: DiscountSource;
export function freshness(d: Discount, vote: DiscountVote | undefined, today: IsoDate): { lastConfirmed: IsoDate; outdated: boolean; mayBeOutdated: boolean };
export function sortByFreshness(...): ...;
```

**What it does:**
- **Seeded data:**
  - Local Regensburg student discounts: cafés, restaurants, cinemas, bowling, karting, climbing, museums, theatre and similar.
  - Researched only from the venues' own pages, Studierendenwerk Niederbayern/Oberpfalz, or the Universität and OTH Regensburg pages.
  - **No alcohol deals.** Facts only, no ratings.
  - Each discount has the place, address, what you get, conditions (student ID, days, times), a category id, its source, URL and checked date.
  - If a page doesn't state the offer, it isn't in the list. Aim for 10–20 entries.
- **Confirmations:**
  - "Still works" and "Doesn't work anymore" store a `DiscountVote` dated today. Tapping again changes the vote.
  - "Last confirmed" is the later of your vote and `checked`.
  - Unconfirmed for 8 weeks → sinks and shows "May be outdated". A "doesn't work" vote → sinks and shows "You marked this as not working".
- **UI:** the Tips tab gets a two-option switch, Tips | Discounts. The discounts view has category chips like the tips view. `/tips` stays the only route.

- [ ] **Step 1: Failing tests:**
  - **data:** unique ids, a source with an https URL and checked date, a known category, no alcohol words in the offer
  - **freshness:** 8-week sink; a vote overrides; sort order
- [ ] **Step 2: Implement**, with a research pass checking every entry on its source page.
- [ ] **Step 3: e2e** (both projects, 375 px): switch to Discounts, confirm one, and it moves up with today's date; mark one outdated and it sinks; the votes survive a reload.
- [ ] **Step 4: Commit:** `feat(discounts): a sourced Regensburg discount list with local confirmations`.

### Task 5: F5, the quick-add provider interface

**Files:**
- Create: `src/features/entries/quick-add-provider.ts` (+ test)
- Modify: `src/features/entries/quick-add-field.tsx`

**Interfaces (Produces):**
```ts
export type QuickAddContext = { today: IsoDate; accounts: Account[]; history: Entry[] };
export type QuickAddReading =
  | { kind: 'amount'; amountMinor: Minor; note: string; categoryId: string | null; accountId?: string; date?: IsoDate }
  | { kind: 'choice'; options: [Minor, Minor]; note: string; categoryId: string | null };
export interface QuickAddProvider { read(text: string, ctx: QuickAddContext): Promise<QuickAddReading | null> }
export const localQuickAddProvider: QuickAddProvider; // wraps parseQuickAdd + suggestCategory, unchanged
```

**What it does:**
- `QuickAddField` takes `provider` (default `localQuickAddProvider`) and loads the context once per submit.
- The category is resolved once per line, so a choice tap doesn't re-run `suggestCategory`.
- The field checks the reading's `categoryId` and `accountId` against the context. An unknown one falls back to the chips or `pickQuickAddAccount`, and a missing `date` means today.
- `runOnce`, `buildEntry`, `saveEntry`, Undo and the amount buttons stay as they are.
- `parseQuickAdd` and its tests don't change.

- [ ] **Step 1: Failing tests:**
  - the local provider gives the same results as `parseQuickAdd` plus `suggestCategory` on the existing parser fixtures
  - an unknown `categoryId` or `accountId` from a fake provider falls back
- [ ] **Step 2: Implement.**
- [ ] **Step 3:** run the existing `home`, `entries` and quick-add e2e **without editing them**. They must pass.
- [ ] **Step 4: Commit:** `refactor(entries): read quick add through a provider interface`.

### Task 6: F7, the local profile

**Files:**
- Create: `src/features/profile/profile.ts` (+ test), `src/features/profile/profile-section.tsx`, `src/data/semesters.ts` (+ test), `e2e/profile.spec.ts`
- Modify: `src/app/settings/page.tsx` (Profile first), `src/features/badges/badges-view.tsx` and `badges-card.tsx` (semester weeks), `src/features/setup/steps/one-offs.tsx` and `src/features/recurring/recurring-editor.tsx` (the semester-fee suggestion, one-offs only), `src/features/home/home.tsx` (optional greeting), `README.md` (privacy)

**What it does:**
- **Settings → "Profile"** comes first. It has:
  - name (optional)
  - university: Universität Regensburg, OTH Regensburg or Other
  - semester start and end, prefilled from the current Bavarian semester periods in `src/data/semesters.ts` (each with source, URL and checked date) and editable
- **Storage:** saved in the `profile` table, included in the backup, never sent anywhere.
- **Uses:**
  - **Badges:** gold Under-Budget Week = the number of weeks in the saved semester.
  - **One-offs step:** offers "Semester fee, due <month before the next semester starts>" as one tap that fills a row. The amount stays empty unless a sourced fee exists in `cities.ts`, and is never guessed.
  - **Home:** "Hi <name>" when a name is set.

- [ ] **Step 1: Failing tests:**
  - **semesters data:** sourced, valid dates
  - **profile:** validation (end after start), the semester-weeks count
  - **badges:** gold uses the profile's semester when one is set
- [ ] **Step 2: Implement.**
- [ ] **Step 3: e2e:**
  - save a profile, then Settings shows it after a reload
  - the backup round-trip keeps it
  - the one-offs step offers the semester fee
  - the Home greeting appears
- [ ] **Step 4: Commit:** `feat(profile): a local profile with university and semester dates`.

### Finish each day
1. Run the full suite: lint, typecheck, build, unit, e2e on both projects, `test:offline`.
2. Whole-branch review (opus), one fix wave, scoped re-review.
3. Update README and CLAUDE.md.
4. Push after Roshan's go; give the PR link, title and description.
