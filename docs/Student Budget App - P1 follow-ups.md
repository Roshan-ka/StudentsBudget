---
tags: [project-idea, follow-ups]
created: 2026-10-20
---

# Student Budget App: P1 follow-ups

See also: [[Student Budget App - Concept]] · [[Student Budget App - Kickoff]] · [[2026-10-16-p1-test-project|P1 plan]] · [[2026-10-19-p1-1-feedback|P1.1 plan]]

What the two build ledgers (P1, 2026-10-16 to 2026-10-19, and P1.1, 2026-10-19 to 2026-10-20) knew, kept here before they are deleted. It has three parts: the decisions made while building, the follow-ups that are still open on the `chore/p1-follow-ups` branch (checked against the code on 2026-10-20), and what only a real iPhone can answer.

## 1. Decisions made during the build

"Cost if wrong" restates the ledger's "costs:" clause: what the choice costs, or what breaks, if it turns out to be wrong. Each line is one ruling. A ruling that a later one changed says so in the same line.

### P1, Day 1 (Tasks 1–3, whole-day review, fix wave)
- R1: the `test` script was `vitest run --passWithNoTests` so Task 1's CI was green before any unit test existed; reversed in the Day 1 fix wave, `npm test` is plain `vitest run`. Cost if wrong: an accidentally empty suite would also pass (why it was reversed).
- R2: Task 1 merges create-next-app's `.gitignore` entries into the existing root `.gitignore` (keeping `/.obsidian/` and `.claude/settings.local.json`) and leaves `.claude/settings.json` alone. Cost if wrong: none.
- R3: Task 1 keeps the whole existing README and appends a short "Development" section with the commands, instead of create-next-app's README. Cost if wrong: none.
- R4: only the layout's top-bar h1 contains "StudentsBudget"; the placeholder page has no heading with that text, so the smoke test's heading query stays unambiguous. Cost if wrong: none.
- R5: the whole-branch review runs at the end of each day over that day's range, not once at the end of P1, because each day ends in its own PR. Cost if wrong: four final reviews instead of one.
- The cacheComponents/Suspense risk is carried into the Task 7 and Task 9 briefs: any client hook reading pathname or search params sits inside `<Suspense>`, and BottomNav gets wrapped when the first such route lands. Cost if wrong: a build error would surface on Vercel before those tasks.
- Commit trailers keep `Co-Authored-By: Claude Opus 5.5` (the plan's constraint and the session's attribution rule) although implementer subagents run on Sonnet 5.5. Cost if wrong: the trailer names the coordinating model, not the one that typed the commit; a one-line constraint change if per-model trailers are wanted.
- The controller does not edit `.claude/settings.json` on a reviewer's request (Roshan approved its exact contents); the finding goes to Roshan with the narrowing (`npx shadcn *`, `npx playwright test *`, drop or narrow `git switch *`), which was applied later in 9868f4a. Cost if wrong: until Roshan decides, an unprompted `npx shadcn@latest` run stays possible.
- Add a small service-worker task on Day 4 before Task 15: hand-written `public/sw.js` registered from AppInit in production only; navigations network-first with cache fallback, `/_next/static/*` cache-first, never cache api.frankfurter.dev; `/sw.js` served with `Cache-Control: no-cache`. Cost if wrong: about 1–2 h of extra work; offline opening would stay broken.
- Task 14 brief: `deleteEverything` is `db.delete()`, then `db.open()`, then `ensureSeeded()` (Dexie 4 `disableAutoOpen` after delete; categories must reseed without a reload). Cost if wrong: none.
- Task 4 brief: keep both an ECB row and a manual row per currency through the compound key `[currency+source]`, and `loadRates` prefers manual, so "Use ECB rate again" works offline; the schema may change freely until the app is installed. Cost if wrong: Task 4 adjusts the Task 3 schema string.
- Task 14 brief: pin `zod` exactly and list it in CLAUDE.md; regex-check IsoDate and IsoMonth in the Zod schema; moving the shadcn CLI to devDependencies stays deferred. Cost if wrong: none.
- Task 7 brief: edit mode keeps `plan.createdOn` and each existing one-off's `createdMonth` (otherwise "Adjust my plan" relocks the reveal for 21 days and restarts set-asides); `useSearchParams` sits inside `<Suspense>`; the save transaction lists `db.guesses`. Cost if wrong: `draftToRecords` needs an `existing?: Plan` parameter.
- Task 4 brief: each AppInit step gets its own try, and rates also refresh on `visibilitychange`. Cost if wrong: one listener.
- Task 7 brief: `validateStep('guesses')` guarantees all six guesses, so `saveGuesses([])` never locks nothing in practice. Cost if wrong: none.
- Keep the P1 build workspace until P1 finishes (Days 2–4 resume from the ledger) instead of deleting it after Day 1; delete it after Day 4's review. Cost if wrong: none.

### P1, Day 2 (Tasks 4–7)
- R6: Task 5 adds a pure `buildTransfer(input, from, rates, now)` in `src/features/accounts/transfer.ts`, used by TransferForm; Task 9's `buildEntry` delegates its transfer branch to it; a missing rate is refused with "No exchange rate for INR yet. Set one in Settings." Cost if wrong: one extra small file, and Task 9's brief must reference it.
- R7: Task 7's save calls `refreshRates(todayIso())` after the transaction commits, so the INR rate exists right after setup. Cost if wrong: one fetch per setup save.
- Accept Task 5's extras: a fourth `buildTransfer` error (received amount ≤ 0) and a currency lock for accounts that have entries; Task 9 inherits the four errors. Cost if wrong: none.
- Keep the food range and the regular Deutschlandticket price for P1 (information and soft warnings); revisit the food minimum once Roshan's own spending exists, and add the student ticket price if setup shows transport-pass guidance. Cost if wrong: a spurious soft "below typical" food warning for frugal grocery plans.
- A blank guess stays unanswered and only a typed 0 counts (the step says "Enter 0 if you spend nothing on it"), because guesses are saved once and locked. Cost if wrong: one more required keystroke per zero guess.
- In the month of `plan.createdOn` the budget accrues only from the setup day: `start = max(firstOfMonth, createdOn)`, through and before amounts prorated from `start`, spending counted from `start`, `monthStatus` planned prorated the same way; later months unchanged. Task 10's numbers become €42 and €36, and Task 12's `monthRecap` prorates the setup month too. Cost if wrong: the first-week number is too low instead of too high. Superseded on 2026-10-21: no day-based proration; see README Home.
- The controller folds the Day 2 plan-text lags (Tasks 9, 10, 12, 14, 14b) into the plan in a `docs(plan)` commit after the fix wave. Cost if wrong: none.
- PR #3 targets `main` directly (no stacking) and carries 9868f4a; the local and remote `feat/p1-day1-foundation` branches are left for Roshan to delete after PR #3 merges. Cost if wrong: one extra commit in PR #3's diff, explained in its body.
- Plan updated in 062ea8c with the Day 2 rulings (Tasks 9, 10, 12, 14, 14b). Cost if wrong: none.

### P1, Day 3 (Tasks 8–10)
- R8: the quick-add confirmation is an inline status line (`role="status"`) with an Undo button, not a toast library, so there is no new runtime dependency. Cost if wrong: add a pinned library later if a floating toast is wanted.
- `N <marker> M` with M a one- or two-digit number, or a number-word run under 100 (optionally followed by "cent(s)"), parses as N euros M cents; any other marker next to two candidates gives no amount. Cost if wrong: an unusual "5 euros 120" asks for the amount instead of guessing.
- Keep "otherwise the last candidate" (`2 coffees` is €2); Task 9's confirmation line shows the parsed amount and note with Undo, so a misread quantity is visible. Cost if wrong: a user who doesn't read the confirmation saves a wrong small amount.
- Refine the N-marker-M rule: M counts as cents only when the line ends after M (and an optional cent or cents); any following token gives no amount. Cost if wrong: "coffee 3 euros 50 with Tom" asks for the amount instead of parsing €3.50.
- R9: the confirmation reads `Saved €6.00 · döner · Eating out` (amount, note, category; note omitted when empty) with Undo, so a misread quantity is visible. Cost if wrong: a slightly longer status line.
- R10: editing an entry happens in-page (an edit panel on /entries opened from the list), with no dynamic `/entries/[id]` route in P1, because a dynamic segment would make BottomNav's `usePathname` need `<Suspense>` under cacheComponents. Cost if wrong: no deep link to a single entry.
- R11: delete confirmation is an inline two-step ("Delete", then "Delete this entry?" with Yes and Cancel), not `window.confirm`, which is unreliable in iOS home-screen apps. Cost if wrong: none.
- The entries list follows the saved entry: after a manual save it opens `/entries?month=<saved month>`, and the filter line gets previous and next month links; plain /entries stays on the current month. Cost if wrong: two small links.
- A same-currency transfer whose stored sent and received amounts already differ keeps its received amount on edit, and follows the amount only when they were equal. Cost if wrong: none; it stops a note edit from rewriting a fee.
- The whole-euro wording stays, but a non-zero amount whose whole-euro value rounds to €0 shows cents ("€0.40 over this week"); exactly 0 stays "€0". Cost if wrong: rare cents on the headline.
- Plan updated in 6a92250 with the Day 3 rulings (Tasks 9, 13, 14, 14b, 15): Task 13 does the `src/lib` move, the entries list's `useToday` and the TransferForm date fix, and the check-in links to /entries/new for earlier days. Cost if wrong: Task 13 grows by about 1 h.

### P1, Day 4 (Tasks 11–15)
- R12: Task 11 pins recharts (and any package `shadcn add chart` brings) exactly through `.npmrc` and lists it in CLAUDE.md; no other chart library. Cost if wrong: none.
- R13: the charts month switcher is local state starting at the current month (no `?month` on /charts); planned per flexible category comes from `monthStatus` (setup month prorated, so it matches Home), fixed categories use the plan's monthly amount, categories without a plan amount get `plannedMinor: null`; the implementer reads the `dataviz` skill before writing chart code. Cost if wrong: no shareable chart URL.
- R14: Task 14b's service worker precaches the eight route documents on install, and navigations are network-first with a cached fallback that ignores the query string. Amended later: RSC requests pass through untouched, because Next 16.4.2 hard-navigates when an RSC fetch rejects and the navigation fallback then answers; don't enable `experimental.useOffline`. Cost if wrong: if precaching unvisited pages misses their chunks, an offline tap to an unvisited page fails.
- R15: Task 15's implementer runs the desktop check as a Playwright script against `npm run build && npm run start`, writes README and CLAUDE.md, lists Roshan's iPhone checklist, and does not run finishing-a-development-branch (the controller does). Cost if wrong: Vercel-only problems surface on the preview.
- Accept `formatWeekAmount`'s cents rule for charts: cents only for 1–49 cents, same as Home. Cost if wrong: €0.50–0.99 shows as €1.
- Envelope spent in charts comes from `monthStatus` (like for like with planned, and with Home); the setup month shows "Budget starts 16 Oct."; months before setup have `plannedMinor` null. Cost if wrong: a setup-month bar can be smaller than the entries list it opens (the note explains it).
- The "Last 6 months" history chart keeps counting all spending in the setup month, since it has no planned side and its columns open the full entries list. Cost if wrong: none.
- Accept Task 12's extras, including the monthly recap showing while the reveal is still locked (it uses no guesses). Cost if wrong: none.
- R16: the calendar file keeps CRLF line endings (RFC 5545) through `*.ics text eol=crlf` in `.gitattributes`, carries VERSION, PRODID, UID, DTSTAMP, SUMMARY, a floating `DTSTART:20261018T180000`, `DURATION:PT10M` and `RRULE:FREQ=WEEKLY;BYDAY=SU`, and is served as text/calendar. Cost if wrong: none.
- R17: Task 13 moves `shiftMonth` into `src/lib/dates.ts` and exports one category `orderOf` used by charts and reveal; `weekLine` prints "on plan" when spent equals the week's share. Cost if wrong: Task 13 touches a few more files.
- On a Sunday whose calendar week starts in the previous month (Sun 1 Nov, say) the check-in also shows that month's tail of the week (Mon 26 – Sat 31 Oct) above the current part, so no days escape a Sunday review. Cost if wrong: one extra section on those Sundays.
- R18: after "Delete everything" the app does a full page load to /setup (`location.replace`), and import reloads the page, so live queries and hidden pages never see a closed database. Cost if wrong: a visible reload.
- R19: /setup offers "Restore from a backup" (the same import flow) at the top, so a new or wiped phone can restore without setting up first. Cost if wrong: one more element on /setup.
- R20: the service-worker cache version comes from the build: AppInit registers `/sw.js?v=<version>`, the version is the commit SHA (`VERCEL_GIT_COMMIT_SHA`, else `GITHUB_SHA`, else `git rev-parse HEAD`, else "local"). Cost if wrong: every deploy re-precaches the eight pages and their chunks once, and uncommitted local builds share a version.
- R21: a navigation waits 4 s for the network, then serves the cached document if one exists, and a late network answer still refreshes the cache; amended by R22, which removed that cache write. Cost if wrong: on a slow connection the person sees the copy from their last online visit of this build.
- R22: the service worker never writes navigation answers to the cache; each build's install-time precache is its only copy of the eight documents, and the slow path gets a committed `sw.js` unit test (`src/lib/sw.test.ts`). Cost if wrong: a page whose precache differs from the live one stays as precached until the next deploy.
- R23: the Sunday-tail section is skipped when the tail ends before `plan.createdOn`; a tail that starts before the setup day uses the setup-month accrual of `safeToSpend` and tags the pre-setup rows. Cost if wrong: none beyond the extra section.
- R24: `.superpowers/**` is excluded from ESLint and tsconfig instead of a CLAUDE.md prose rule. Cost if wrong: scratch specs there are no longer type-checked.
- Plan updated with the Day 4 rulings (Tasks 11–15); Task 15 Step 3 versus Step 4 stays an open question for Roshan. Cost if wrong: none.

### P1.1 (R1–R18)
- R1: Task 1 may edit `src/features/setup/steps/envelopes.tsx` if the six new flexible envelopes need a €0 default or validation change; the file is frozen afterwards. Cost if wrong: none.
- R2: Task 6 also rejects a schedule whose `accountId` isn't in the backup file, because a dangling one would never post. Cost if wrong: one more rule and test.
- R3: Task 7 (README, CLAUDE.md, emulated iPhone check) runs on the merged branch before the whole-branch review, so the final review also covers any fixes from the check. Cost if wrong: a fix-wave change after the check could alter iPhone behaviour; the final full-suite run covers that.
- R4: Tasks 2–6 run as parallel implementers, each in its own git worktree with disjoint file ownership and its own e2e port, as Roshan asked. Cost if wrong: merge conflicts if a track strays outside its files.
- R5: the four remote branches `origin/feat/p1-day1..4` stay on GitHub until Roshan says to delete them. Cost if wrong: none.
- R6: carried into the track dispatches: Task 2 refreshes `aggregate.ts`'s stale comment and plans a paused fixed line at 0 inline; Task 3 carries `schedule` through `draft.ts` and never posts an occurrence before `plan.createdOn`; Task 6 also validates schedules (monthly day 1–31, weekly 1–7, `amountMinor > 0`, `startOn ≥ plan.createdOn`, `postedThrough ≥ startOn − 1 day`), because a damaged file could otherwise back-post thousands of entries. Cost if wrong: one more rule each.
- R7: the tracks run e2e with `--workers=2`, and an iphone timeout under load is re-run alone before it counts as a failure. Cost if wrong: slower e2e per track.
- R8: agent worktrees live in `.claude/worktrees/` inside the repo, excluded locally through `.git/info/exclude`; controller lint runs use `--ignore-pattern '.claude/**'` until Task 7 adds the ESLint ignore. Cost if wrong: none.
- Task 6, unnumbered: a zero schedule amount keeps the brief's wording ("an amount is zero or negative" runs first, so R6's amount clause is dead); drop the dead clause in the final fix wave if touched. Cost if wrong: none, the file is refused either way.
- R9: the Task 4 over row reads "€42 over the €64 planned this month", parallel to "€22 left of €64 this month", and the `aria-valuetext` follows; the brief's "over of" was ungrammatical. Cost if wrong: none.
- R10: "Use this budget" is disabled while the amounts it would write total €0; SuggestedBudget is keyed by month so "Not now" resets on the 1st; city midpoints round to the nearest €5; a last month with any spending keeps basis "last-month" even if it rounds to €0. Cost if wrong: the brief's unrounded midpoints change, so the e2e values were updated.
- R11: "Use this budget" keeps writing over-available amounts with its calm "€X over what is available" note: warn, don't block (Concept rule 7), only setup blocks. Cost if wrong: a person can accept an over-budget plan from Home.
- R12: the poster treats a period as handled when an entry with `recurring` set, the same type and the same `categoryId` already exists in that period (date index, same transaction): it skips the period and still advances the watermark. Cost if wrong: a person who deliberately adds a second rent in a month must log it by hand.
- R13: a schedule whose account is missing gets resume semantics when repaired (`startOn` tomorrow, `postedThrough` the later of the old value and today) in the editor and the wizard; the wizard keeps an orphaned schedule untouched unless an account is picked and shows "Pick an account for this"; the edit save takes `paused` and `startOn` from the stored schedule. Cost if wrong: missed periods while orphaned must be logged by hand.
- R14: Task 3 may edit the frozen `src/db/repo.ts` (`deleteAccount`) and `accounts-panel.tsx`: deleting an account that a schedule uses is refused with "This account pays or receives a fixed cost or income. Change that first in Fixed costs and income." Cost if wrong: one more refusal path.
- R15: agent worktrees inside the repo (each with its own `node_modules`) make the main checkout's `next dev` hang on "Compiling /", so the merged track worktrees were removed (branches kept) and Task 7 records this in CLAUDE.md. Cost if wrong: the merged tracks' worktree folders are gone.
- R16: Task 7 also adds `.claude/worktrees/**` to ESLint's global ignores, shows RangeSource's checked date as DD-MM-YYYY, and records the worktree and `next dev` hang in CLAUDE.md. Cost if wrong: none.
- R17: "coffee 7 40 €" (a € sign) gets the same €7.40-or-€40 choice as "euros"; the old test that pinned €40 changed in the same fix wave. Cost if wrong: one more test change.
- R18: "coffee 7 40eur" and "40euros" also offer the choice, under the same "marker after the number" rule as R17. Cost if wrong: none.

### Roshan decided (P1.1)
- 2026-10-19: "coffee seven forty euros." makes quick add save nothing yet and ask "€7.40 or €40?" with two buttons, and one tap saves; this applies when two numbers sit side by side before the currency word.
- 2026-10-19: the over-time charts use the last 6 months when the period is "This month"; an unmarked "coffee 7 40" gets the same €7.40-or-€40 buttons; Pause keeps leaving the plan, labelled "Paused · not in your plan for now".

### Count check
Checked on 2026-10-20, before the ledgers were deleted.
- P1: `grep -c "Ruling"` gave 59. That is 55 rulings (listed above: 16 on Day 1, 9 on Day 2, 11 on Day 3, 19 on Day 4) plus 4 section headings ("### Rulings", "### Rulings (Day 2)", "(Day 3)", "(Day 4)") that carry no decision.
- P1.1: `grep -c "Ruling"` gave 19. That is R1–R18 plus the one unnumbered ruling inside a Task 6 deferred item, all listed above.
- Together 78 lines: 74 rulings and 4 headings. No ruling was dropped.

## 2. Open follow-ups

Every deferred or minor item in the two ledgers was checked against the code on this branch (`bb19e33` plus this note). 75 were open on 2026-10-20, listed by area; those fixed since end in "Done" with the date. "(worth doing next)" marks the five a user would notice first. One extra area, "Accounts, rates and data layer", holds items that fit none of the others.

### Quick add and entries
- `keywordOf` reads only the first word, so "2 coffees" gets the keyword "2" and matches "2 tickets", and "Coffee. 6" keeps "Coffee." as its keyword (`src/features/entries/quick-add.ts`). Category suggestions follow the wrong word. (worth doing next) Done 2026-10-21 (feat/fixes-upkeep).
- The manual entry form starts on the first account in sort order, and setup stamps one `createdAt` on every account, so the default is Cash by name (`src/features/setup/draft.ts`, `src/features/entries/entry-form.tsx`). Wrong for someone who mostly pays by bank. (worth doing next) Done 2026-10-21 (feat/fixes-upkeep).
- German number words ("Döner sechs Euro") give no amount (`quick-add.ts`). Matters for someone dictating in German.
- A space around the decimal comma ("Döner 6 ,50") saves €6 with ",50" in the note; "6€ 50" and "euro 6 50" save €6 with "50" left in the note; "6 euros 50 cents" leaves the note empty (`quick-add.ts`). The confirmation line shows the amount, so it is visible.
- Odd lines still save silently or are refused: "euro2024 tickets 30" is €2024, "tel 0176" is €176, "coffee 6 , 50" is €50, "coffee twenty, five" is €25, "coffee 7 40 3 euros" offers €40.03 or €3, and "lunch for two and cake 12 euros" gives no amount (`quick-add.ts`). Contrived; listed so they are not rediscovered.
- No parser test pins a no-break space or U+202F before "€" (`quick-add.test.ts`). It works today because the line splits on `\s+`.
- `/entries/new` keeps its tab and its account and category choice after a save, because the page stays mounted (`entry-form.tsx`).
- On the entries list, the previous and next month links derive from the loaded month, so a very fast double tap moves one month instead of two; `editingId` survives navigation (`entries-list.tsx`).
- Focus is lost on every panel swap in the entries list (edit panel, delete question), and the "Delete this entry?" question is not announced (`entries-list.tsx`).
- `minorToInput` is copied in four files (`entry-form.tsx`, `transfer-form.tsx`, `accounts-panel.tsx`, `recurring-editor.tsx`); it belongs in `src/lib/money.ts` with a test.
- Date field: the Today chip stores the picked date, so it no longer follows midnight (documented), and the native date segments are invisible when typing on a desktop (`src/components/date-field.tsx`).

### Recurring
- "First added on DD-MM-YYYY" can name the wrong day after auto-add is turned off and on again mid-month once this month has already posted (`src/features/recurring/schedule.ts` `firstAddedOn`, `recurring-editor.tsx`, `draft-schedule-fields.tsx`). (worth doing next) Done 2026-10-21 (feat/fixes-upkeep).
- A plain weekly-to-monthly edit skips that month's first monthly entry (the period scan finds the weekly ones), and monthly-to-weekly posts weekly entries in a month whose monthly one already posted (`post-due.ts` `postedIn`).
- A future-dated automatic entry that was moved to another day still suppresses its period (`post-due.ts`).
- A stale second-tab wizard can re-orphan an `accountId`, and a plan exported in that state can't be restored (`update-plan.ts`, `src/features/backup/backup.ts`).
- The Resume button shows no date although the Edit form does; the frequency-change note exists in the editor but not in the wizard; focus is lost after the Delete confirmation (`recurring-editor.tsx`, `draft-schedule-fields.tsx`).

### Home and suggested budget
- `percentUsed` rounds, so the bar is full at 99.5–99.9% and empty under 0.5%; the function is private and has no unit test (`src/features/home/envelope-list.tsx`).
- The headline and the envelope rows are rounded independently, so the headline can differ by €1 from the sum of the visible rows (`home.tsx`, `envelope-list.tsx`).
- The plural note "INR and USD rates missing" has no test; `home.spec.ts` checks only the singular (`home.tsx`).
- A suggested city midpoint could round below its own range minimum; theoretical, none of the six do (`suggest-budget.ts`).
- Buttons are 40 px high (`h-10`) here and in most forms, against a 44 px touch target (`suggested-budget.tsx`).

### Charts
- An empty selected month hides all the charts, including the 6-month ones that have history; the page only says "Nothing logged in October yet." (`src/features/charts/charts-view.tsx`). (worth doing next) Done 2026-10-21 (feat/fixes-upkeep).
- A period that reaches back before setup counts spending but no plan ("€300 of €160", with no "Earlier months had no plan." note), and Savings counts expenses before the setup day while Spending does not, with no caption saying so (`aggregate.ts`, `sections.tsx`). Superseded on 2026-10-21: no day-based proration; see README Home.
- Sub-euro overspend reads "€160 of €160" in the bars, because cents show only for 1–49 cents (`bars.tsx`, `src/lib/week-amount.ts`).
- Bars: the `memo` is defeated because `plain` is a new array on every render; the hit-rect maths assumes plot height equals rows times `ROW_HEIGHT`; tapping the category name or the number column does nothing (`bars.tsx`).
- The hidden data table reveals on focus and shifts the layout; table links have a small hit area; Line-style hover over the stroke was never verified (`chart-parts.tsx`, `series.tsx`).
- The default history category can differ from the top spender in the setup month; `budgetStartNote` for a plan created on the 1st and the `noneText` branches have no tests; the income-only branch is effectively dead (`charts-view.tsx`).

### Check-in and reveal
- The monthly recap and the charts measure past months against the current plan, because there is no plan history; a per-month snapshot needs a new `db.version(n)` (`src/features/reveal/reveal.ts` `monthRecap`, `aggregate.ts`).
- The reveal caption hard-codes "30" while `DAYS_PER_MONTH` is private in `reveal.ts`, and the unlock rule `today >= unlockDate` is written twice (`RevealCard` and `guessVsReality`), so it wants one `isUnlocked(startedOn, today)` (`reveal-view.tsx`).
- Untested: the "right on plan" branch of `recapLine`, the no-guesses fallback, `RevealCard`, and the `>=` edge of the Sunday-tail rule where the tail ends exactly on `plan.createdOn` (`reveal-view.tsx`, `src/features/check-in/check-in-view.tsx`).
- A section and its list share one `aria-labelledby` in the check-in and reveal views, so the name is announced twice (`check-in-view.tsx`, `reveal-view.tsx`).

### Backup and restore
- No size cap before `file.text()`: a very large file reads as "not a backup" after a long wait (`src/features/backup/restore-from-backup.tsx`).
- A failed "Delete everything" always says "Try again", even when `db.open()` or the reseed failed after the delete; focus is lost when the Delete toggle unmounts (`backup-panel.tsx`, `src/db/bulk.ts`).
- `ExportBackup` keeps its notice across a hidden-page remount; `exportAll` live-query errors go to the error boundary; the /setup restore section shifts the layout (`backup-panel.tsx`, `setup-restore-section.tsx`).
- Validation: `plan.createdOn` is unbounded, so a hand-edited file from 1900 could still back-post, and the `amountMinor > 0` clause in `isPossibleSchedule` is dead because the earlier zero-amount check refuses first (`backup.ts`).
- Backup e2e: delete and restore run on Chromium only; the AbortError test can pass before the rejection lands; the slow-read race uses a 600 ms timer instead of an explicit gate; the SUMMARY regex relies on the pinned noon clock (`e2e/backup.spec.ts`).

### Setup
- The opening balance can't be negative in the account form, though a restored backup accepts an overdrawn account (`src/features/accounts/opening-balance.ts`, `accounts-panel.tsx`). (worth doing next) Done 2026-10-21 (feat/fixes-upkeep).
- The save error says "Try again" for `GuessesLockedError`, which can never succeed; no test covers the transaction rolling back when `saveGuesses` throws (`src/features/setup/setup-wizard.tsx`).
- The install hint also shows in edit mode (`src/app/setup/page.tsx`).
- `draftToRecords` rebuilds the Plan from scratch, so a later Plan field would be dropped on edit (use `{ ...existing, … }`); `previewPlan` runs `newId` and `new Date` about three times per render on the last step (`draft.ts`).
- `parseOpeningBalance` now parses every optional amount; rename it to `parseOptionalAmount` (`opening-balance.ts`). Done 2026-10-21 (feat/fixes-upkeep).
- The envelopes footer rounds "Planned" to the nearest euro and floors "Available", so within a 50-cent band it can read "Planned €467 · Available €466" without "Over by"; the footer is also off-screen while typing at 375×812 (`draft.ts` `envelopesFooter`, `steps/envelopes.tsx`).
- Editing a kept one-off's amount or due month keeps `createdMonth`, so it under-reserves; `isDueMonthProblem` matches id-less one-offs without claim tracking (`draft.ts`).
- The range "Source" summary is about 16 px tall as a tap target (`steps/range-source.tsx`).
- The layout keeps the bottom-nav padding on /setup while the nav is hidden (`src/app/layout.tsx`).
- `draft.ts` keeps a third private category-order map (`ORDER_OF`, with `?? 0`); use `orderOf` from `src/features/entries/categories.ts`.
- City data: the rent minimum is the single cheapest dorm room (Studierendenwerk rooms go up to €612, above the €561 maximum), and the food minimum (€180) is total food spend, so a frugal grocery plan of about €120 gets a soft "below typical" warning, kept on purpose (`src/data/cities.ts`).
- City data: `CITIES.prices` is never shown in the app; the Deutschlandticket €63 goes stale on 2027-01-01 (€66.80) and the semester-ticket upgrade isn't offered as guidance; the grocery basket price is missing; the Destatis URLs live only in a code comment (`cities.ts`).

### Accounts, rates and data layer
- `toEurMinor` returns -0 for small negatives and has no exact .5 tie test (`src/lib/fx.ts`). Done 2026-10-21: the -0 is fixed (the .5 tie test is still open).
- Rates: the "failed" path for a response with none of the needed currencies doesn't log (an empty `[]` does since the v2 move, as does one with only currencies the app has no code for); a partially missing currency returns "updated" and refetches on every call; the error contract is uneven (bulkPut errors become "failed", reads reject); no test shows a rejected refresh doesn't poison the queue (`src/db/rates.ts`).
- `AbortSignal.timeout` throws on WebKit older than 16, so every rate refresh fails without a hint on an older iPhone (`fx.ts`).
- Frankfurter v1 is deprecated with no sunset date; a move to v2 with `providers=ecb` is tracked nowhere (`fx.ts`). Done 2026-10-21: moved to v2 (quotes, providers=ecb).
- The `refreshRates` try/catch is repeated in AppInit, the accounts panel, the rates panel and the setup wizard; a `safeRefreshRates` helper would hold it once (`rates.ts`).
- `accounts-panel.tsx` writes `db.accounts.put` directly instead of a repo `saveAccount` with a test; `parseRate` (in `rates-panel.tsx`) and the currency lock have no unit tests.
- Accounts: one-tap delete with no confirm; no uniqueness check on names; form errors aren't tied to their fields (`aria-invalid`, `aria-describedby`); focus drops to the body when a form opens or closes (`accounts-panel.tsx`, `transfer-form.tsx`, `entry-form.tsx`).
- Dates: invalid input behaves differently (`addDays` and `weekInMonth` throw RangeError, `daysBetween`, `monthsBetween` and `daysInMonth` return NaN); `toDate` is a bare `parseISO` alias; `formatDate('')` returns garbage; `formatDateTime` accepts any Date-parsable string (`src/lib/dates.ts`).
- Repo: `deleteAccount` always runs both counts (a `.first()` would skip the full scan); the two error classes carry no payload; `saveEntry` has no referential check and `saveGuesses([])` succeeds without locking; `entriesInRange` with `from > to` is untested (`src/db/repo.ts`).

### Offline and service worker
- The build version falls back to "local" when there is no commit SHA and no `.git`, which pins one cache for every such build; `git rev-parse HEAD` runs without a timeout; the offline e2e accepts `v=local` (`next.config.ts`, `e2e/offline.spec.ts`).
- An offline page from an older build could meet a newer Dexie schema (VersionError), and an open page whose old cache is deleted by `skipWaiting` plus `claim` may miss a lazy chunk (`public/sw.js`).
- `sw.test.ts` has no late-rejection case, and the offline e2e proves only the install-time precache, so the slow path rests on the vm test (`src/lib/sw.test.ts`, `e2e/offline.spec.ts`).
- Manifest and shell: the name, description and `#0f766e` are written in `manifest.ts`, `layout.tsx` and `globals.css`; the icons lack `purpose: 'maskable'`; `favicon.ico` is still the create-next-app default.

### HTTPS and phone testing
- `npm run start:https` runs the whole `next build` before the script checks for the certificate, so a missing certificate shows up after minutes (`package.json`, `scripts/start-https.mjs`).
- The ESLint rule bans `crypto.randomUUID` but not `globalThis.crypto.randomUUID` (`eslint.config.mjs`).
- The success path of `scripts/make-cert.mjs` is not exercised by any test (no mkcert in CI).

### Tests and CI
- Playwright has no CI retries; P1.1's final run had one unexplained failure that passed on re-run, and check-in, accounts and iphone specs time out under load but pass alone (`playwright.config.ts`, `.github/workflows/ci.yml`).
- CI builds twice: the build step, then `test:offline` builds again (`ci.yml`).
- `smoke.spec.ts` doesn't assert that the manifest icons are served (200, `image/png`).
- `AppInit` has no committed test (no component-test harness): the production gate, independent rates and persistence, and the `visibilitychange` listener (`src/components/app-init.tsx`).
- Stale e2e workarounds for the old dev-badge position: `dispatchEvent('click')` on the nav links in `home.spec.ts` and the matching comment in `entries.spec.ts` (`openEntries`); the badge now sits top-right.
- Fragile e2e bits: `g.cursor-pointer` in `charts.spec.ts` couples to a Tailwind class, and that file has a blanket 90 s timeout; a one-off seed with `eurMinor: 0` makes one assertion vacuous; a page-level `getByText('Recurring')` in `check-in.spec.ts`; a non-exact "Back" locator in `setup.spec.ts`; the "no nav" check in `accounts.spec.ts` can't tell hidden from not yet rendered.
- Unit-test nits: the "never warns about rent" test puts rent in `fixed`, so the `FLEXIBLE_IDS` guard isn't exercised (`src/lib/budget.test.ts`); `setAsideMonthly` has an unreachable `Math.max(1, …)`; the test helper `expense(…, 'income')` is misnamed.
- `shadcn` (the CLI) is still a runtime dependency; it belongs in `devDependencies` (`package.json`).
- `E2E_PORT=''` becomes port 0 (use `||`), and Next dev echoes the expected aborted-fetch `console.error` into Playwright output (`playwright.config.ts`, `rates.ts`).

### Docs
- Plan Task 1 Step 1 still says `npx shadcn@latest init`; a historic step, and shadcn is pinned at 4.21.5 (`docs/superpowers/plans/2026-10-16-p1-test-project.md`).
- Plan Task 15 Step 3 versus Step 4 (iPhone checklist after the deploy, or record the results before merging) is still an open question in the plan text.

### Dated re-checks
Reminders with a date, not counted in the 75 above.
- 2026-10-21: re-check the Regensburg €22 Deutschlandticket student surcharge for 2027 in December 2026 (`rvv.de/semesterticket`). The regular Deutschlandticket goes to €66.80 on 2027-01-01, but no 2027 figure for the student surcharge is published yet, so the €22 in `src/data/swaps.ts` and `src/data/tips.ts` stays.
- 2026-10-21: all 17 discounts read "May be outdated" from 15-12-2026 without votes (56 days after the source check on 2026-10-20). Re-check the sources and update `CHECKED` in `src/data/discounts.ts` before then.

### Not checkable from the code
Two ledger items could not be classified by reading the code:
- The iphone e2e once logged "could not refresh the exchange rates TypeError: Load failed" where a spec reached the real Frankfurter fetch without a route mock. The shared `mockFrankfurter` helper now exists; whether every spec uses it was not checked.
- One entries rate test whose first assertion can't tell the stored rate from the converted amount (noted in Task 9). The test was not identified.

### Fixed since it was noted
55 items from the two ledgers were fixed in later days or in P1.1, or became moot. A ledger line often lists several items, so the open count above and this one count items, not ledger lines.

## 3. Not checkable without a real iPhone

- The share sheet and Save to Files: backup export calls `navigator.share` inside the tap, with "Download instead" as the fallback. The test stub can't catch a deferral that happens only in a microtask.
- Add to Home Screen: install, the separate home-screen storage versus Safari, the install hint on /setup, and the mkcert root certificate arriving as a `.pem` through the Files app.
- What dictation actually produces: trailing punctuation, "7 40", "seven forty euros", number words, and whether `coffee seven forty euros.` reads the way the €7.40-or-€40 choice expects.
- The iOS date wheel: the transparent native date input over the field, the Today and Yesterday chips, and the 16 px input that stops the zoom.
- iOS Safari storage and service-worker behaviour over HTTPS: persistent-storage request, whether data survives, service-worker install and update, and opening offline in airplane mode.
- An installed app resumed after a scheduled day posts on return: `visibilitychange` runs the recurring poster, and `useToday` rolls Home, Entries and Charts to the new date.
