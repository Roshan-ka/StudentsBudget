# Recurring: the month that starts on a Monday

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan chunk by chunk. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a weekly line changed to monthly posts the month's entry even when the month starts on a Monday and its first week was already posted.

**Builds on:** the data-bugs plan (`docs/superpowers/plans/2026-11-04-data-bugs.md`), chunk 1's As built and review, which left this as a known gap. It is pinned in `src/features/recurring/post-due.test.ts` ("still skips a month that starts on a Monday once its first week was posted (known gap)") and named in CLAUDE.md's "Recurring entries" rule. Starts from `main` once #58, #59 and #61 are merged.

**Tech:** the app's own Dexie, vitest and fake-indexeddb; no new dependency.

## The gap

A schedule's entry for a period has the id `rec:<scheduleId>:<periodStart>`. A week starts on a Monday and a month on the 1st, so when the 1st is a Monday, the week and the month have the same id. A schedule's own entry holds exactly the period its id names (chunk 1), so the weekly entry of the week of Monday 1 February 2027 holds February too. After a change to monthly, the poster passes over February. The `bulkGet` guard in `post-due.ts` would refuse the entry anyway, because the id already exists.

It needs a weekly line changed to monthly, in a month that starts on a Monday, after that month's first week posted. Months that start on a Monday: June 2026, February 2027, March 2027, November 2027, May 2028. The poster never posts before `plan.createdOn` and the first plans date from October 2026, so no entry stored today has the ambiguous form.

## Options

### A. A frequency change gives the schedule a new id and a link to the ids it replaced

`applyLineChange` and the wizard (`draftToRecords`) give a schedule whose frequency changes a new id, with `replaces: string[]`. The poster leaves entries of a replaced id to the watermark; without the link they would count as an earlier schedule's (by date), which is the bug chunk 1 fixed.

| Stored data | Change |
|---|---|
| `Schedule` type (`src/db/types.ts`) | `replaces?: string[]` |
| Row schemas (`src/db/schemas.ts`) | the schedule schema gains `replaces: z.array(id).optional()` |
| Backup type check | none beyond the schema (an optional field, so older files restore) |
| Sync row checks (`ROW_CHECKS`) | none beyond the schema |
| Supabase migration | none (the plan is `jsonb`); `keep_watermarks` matches schedules by id, so the new id simply carries the copied watermark |

Code besides the poster: `applyLineChange`, `draftToRecords`, `keepScheduleState` (matches the wizard's schedule by id, to keep a pause), `firstAddedOn`'s preview.

**Two phones on different versions:** an older phone's row check is a `z.object`, which drops keys it doesn't know, and a pull writes the checked row. So the older phone stores the plan without `replaces`. The next plan edit the person makes there (Settings or Edit plan) pushes it without the link, and every phone pulls that. From then on the old weekly entries count as an earlier schedule's, by date, and the month of the change is skipped again: the chunk 1 bug comes back for any weekly-to-monthly change, not only in months that start on a Monday. Until it updates, the older phone's own poster passes over the month of the change too.

### B. Entry ids that name the frequency, with the old ids still read

New entries get an id that says weekly or monthly; the old form is still read. Two ways to cut it:

- **B1, every weekly id:** `rec:<scheduleId>:w:<Monday>` for every week; monthly ids stay `rec:<scheduleId>:<1st>`.
- **B2, only the week that starts on the 1st:** that one week gets `rec:<scheduleId>:w:<Monday>`; every other id stays as it is.

| Stored data | B1 and B2 |
|---|---|
| `Schedule` type | none |
| Row schemas | none (an entry id is `z.string().min(1)`) |
| Backup type check | none |
| Sync row checks | none (they check that the row's id is the entry's id, which holds) |
| Supabase migration | none (`id text`, 1–200 characters; the new id is about 53) |

Reading the old form: for a weekly schedule, a week that starts on the 1st is held by `rec:<s>:w:<1st>` or `rec:<s>:<1st>` (an entry posted before this change). For a monthly schedule, `rec:<s>:<1st>` holds the month, as today.

**Two phones on different versions:** today two linked phones that post the same period agree on its id, and the account keeps one copy (the poster's rows are pushed insert-only). An older phone posts the old id and a newer one the new id, so a week both post before a sync arrives twice, until the older phone updates. Under B1 that is every week of every weekly line; under B2 only weeks that start on the 1st (three in 2027). An older phone also still posts a week of Monday 1st under the month's id. If that line is then changed to monthly, the month is skipped as today. The newer phone reads both forms, so it never posts a third copy.

B1 also changes the ids four pinned tests expect (`rec:job-s:…` three times, `rec:gym-b:2026-11-23`); B2 changes none.

## Recommendation

**B2.** It changes no stored shape (no type, schema, backup, row check or migration), so there is nothing an older phone can strip or refuse. With phones on different versions, the worst case is a duplicate weekly entry in a week that starts on the 1st, which can be deleted by hand. Under A, an older phone silently brings back the bug chunk 1 fixed, for every month. B1 is the close alternative: one rule for every week instead of a special case. But it raises that duplicate to every week while versions differ, for no gain in what the poster does. The special case lives in one function (`recurringEntryId`), with a comment saying why.

## Decided

*Waiting for Roshan's call.*

## Global constraints

- TypeScript `strict`, no `any`; dates as `IsoDate`.
- No Dexie `db.version(n)`, no Supabase migration, no new user-facing text.
- Failing test first; `npm run lint`, `npm run typecheck`, `npm test` (light lane); an "As built" note here; a Conventional Commit ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; a draft PR to `main` on `Roshan-ka/StudentsBudget`. No heavy job (build, e2e) without Roshan's go, and then through the lane.

## Review focus

- Two phones on the same version both post the week of Monday 1 February 2027: the same id (`rec:s:w:2027-02-01`), one entry on the account. Pinned by the `recurringEntryId` test (the id depends only on schedule and period).
- A weekly entry posted before this change under the month's id, moved out of its week: still found by the `bulkGet` guard, not posted again (post-due test, step 1).
- Weekly → monthly → weekly within February 2027: the ids differ (`rec:s:2027-02-01` and `rec:s:w:2027-02-01`) and the watermark keeps the order (the flipped known-gap test covers the first half).
- A line turned off and on (a new schedule id) around a Monday-1st week: an earlier schedule's entry still holds the period it is dated in (the pinned off-and-on tests stay unchanged).
- "First added on" for a repaired weekly line picked again as monthly in February 2027 names the day the poster posts (post-due test, step 1).

## Chunk 1: weekly ids on the 1st name the week (decision B2)

**Files:**
- Modify: `src/features/recurring/schedule.ts` (`recurringEntryId`, new `ownEntryIds`, `LineKey`, `holdsAutomaticEntry`, `firstAddedOn`'s key, their comments)
- Modify: `src/features/recurring/post-due.ts` (the entry id, `postedIn`'s key, the `bulkGet` guard)
- Test: `src/features/recurring/post-due.test.ts`, `src/features/recurring/schedule.test.ts`
- Docs: CLAUDE.md "Recurring entries" (the known-gap sentence becomes the rule), `docs/Student Budget App - P1 follow-ups.md` (the known gap: Done)

**Interfaces:**
- `recurringEntryId(s: Pick<Schedule, 'id' | 'frequency'>, periodStart: IsoDate): string`: `rec:<id>:<periodStart>`, or `rec:<id>:w:<periodStart>` for a weekly period that starts on the 1st. Schedule first, as `periodOf` and `occurrenceIn` take it.
- `ownEntryIds(s: Pick<Schedule, 'id' | 'frequency'>, periodStart: IsoDate): string[]`: `[recurringEntryId(s, periodStart)]`, plus the old `rec:<id>:<periodStart>` for a weekly period that starts on the 1st.
- `LineKey = { type: LineType; categoryId: string; current?: Pick<Schedule, 'id' | 'frequency'> }` (replaces `currentScheduleId`). The current schedule's own entry holds the period when its id is one of `ownEntryIds(current, period.start)`.
- `firstAddedOn` passes `current: { id: stored.id, frequency: timing.frequency }`: the period it looks at is the new timing's.
- `postLine`: the id is `recurringEntryId(s, start)`; a period is left out of the adds when any of `ownEntryIds(s, start)` already exists.

- [ ] **Step 1: failing tests**
  - `post-due.test.ts`, the known-gap test becomes "posts the month's entry in a month that starts on a Monday after its first week was posted": `postDueRecurring('2027-02-15')` → `{ posted: 1 }`; rent ids and dates `[['rec:rent-s:2027-01-25', '2027-01-29'], ['rec:rent-s:w:2027-02-01', '2027-02-05'], ['rec:rent-s:2027-02-01', '2027-02-15']]`; watermark `'2027-02-28'`; then `postDueRecurring('2027-03-15')` → `{ posted: 1 }`. The known-gap comment goes.
  - `post-due.test.ts`, `recurringEntryId`: "names the schedule and the period" calls `recurringEntryId({ id: 'abc', frequency: 'monthly' }, '2026-11-01')` → `'rec:abc:2026-11-01'`; new "marks a week that starts on the 1st as a week, as the month has that id": weekly `'2027-02-01'` → `'rec:abc:w:2027-02-01'`, weekly `'2027-02-08'` → `'rec:abc:2027-02-08'`, monthly `'2027-02-01'` → `'rec:abc:2027-02-01'`. The automatic-mark test's `recurringEntryId('rent-s', …)` takes `schedule()`.
  - `post-due.test.ts`, "does not post a week again that an older version posted under the month's id, moved out of the week" (passing now, pinned): weekly Fridays, `postedThrough '2027-01-31'`, an automatic entry `rec:rent-s:2027-02-01` dated `'2027-02-09'`; `postDueRecurring('2027-02-08')` → `{ posted: 0 }`, watermark `'2027-02-07'`.
  - `post-due.test.ts`, under "the first entry it adds is on the day 'First added on' says": "a repaired weekly line picked again as monthly on day 15 after its week of Monday 1 February: 15 Feb". Weekly Fridays on a second euro account `other` from `'2027-01-25'`; `postDueRecurring('2027-02-08')` → 2; `other` is deleted; `firstAddedOn({ frequency: 'monthly', day: 15 }, stored, '2027-02-08', true, line)` → `'2027-02-15'`; `updatePlan` with `applyLineChange` to monthly day 15 on `local` (a repair: it restarts from tomorrow); `postDueRecurring('2027-02-14')` → `{ posted: 0 }`, `postDueRecurring('2027-02-15')` → `{ posted: 1 }`, and `rec:rent-s:2027-02-01` is dated `'2027-02-15'`. (`expectFirstOn` doesn't fit: the schedule keeps its id, so the weekly entries match it too.)
  - `schedule.test.ts`, `holdsAutomaticEntry`: "a week's entry does not hold the month that starts on its Monday": `current: { id: 's1', frequency: 'monthly' }`, an automatic entry `rec:s1:w:2027-02-01` dated `'2027-02-05'`, February → `false`. "still reads a week's entry posted under the month's id" (passing now, pinned): `current: { id: 's1', frequency: 'weekly' }`, entry `rec:s1:2027-02-01` dated `'2027-02-05'`, the week of 1 February → `true`. The existing `currentScheduleId` tests take `current`.
- [ ] **Step 2:** `npx vitest run src/features/recurring` → the flipped test, both `recurringEntryId` cases, the "First added on" case and the first `holdsAutomaticEntry` case fail; every other test passes.
- [ ] **Step 3:** the fix in `schedule.ts` and `post-due.ts`, as the interfaces say; `recurringEntryId`'s comment says why a week on the 1st is marked.
- [ ] **Step 4:** `npx vitest run src/features/recurring` → all pass; the pinned off-and-on and late-change tests unchanged.
- [ ] **Step 5:** CLAUDE.md "Recurring entries": the known-gap sentence becomes "A week that starts on the 1st has the id `rec:<schedule>:w:<Monday>`, since `rec:<schedule>:<1st>` is that month's; one posted before under the month's id still holds its week." Follow-ups doc: the known gap Done 2026-11-xx (branch).
- [ ] **Step 6:** lint, typecheck, `npm test`; As built; commit `fix(recurring): a week that starts on the 1st no longer takes the month's id`; draft PR (this plan goes with it).

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (light lane).
- No e2e: nothing on screen changes.

## Left out

- Rewriting the ids of entries already stored: none has the ambiguous form (see "The gap"), and a rewrite would change ids other phones already hold.
- The test helper in `schedule.test.ts` that builds ids from the date (deferred in the data-bugs review): it builds monthly-style ids, which stay right for every case it is used in.
