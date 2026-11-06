# Count the whole setup month (drop the setup-day cut)

## Context

**Symptom (live site, 06-11-2026):** Roshan set up on 5 Nov and logged spending dated 4 Nov. The entry shows on Entries, but Home, Charts and the check-in don't count it.

**Root cause:** nothing is lost and the save is fine. The month figures count spending only from the setup day in the setup month: `spendingStart` in `src/lib/budget.ts`, used by `monthStatus` and `weekToSpend`. Several places copy that rule:
- the charts' "counted from" note;
- the check-in's "Before your plan started, not counted";
- the badge rules;
- the reveal's "(counted from 16 Oct)";
- the MCP server's `beforeSetup`.

The Entries page lists by date, so it shows the entry.

**Decision (Roshan, 06-11-2026):** drop the rule. CSV import is coming, backups exist, and new users will type in earlier days of the month by hand.

**Review: agreed.** The plan is already counted in full in the setup month ("plans the whole monthly amount, in the setup month too"), so counting that whole month's spending is the like-for-like comparison. The cut only ever hid entries someone typed in on purpose. It never protected against unlogged spending, which isn't counted either way.

**Not part of this bug:** Home never counts income, fixed costs or transfers; they reach "Left this month" through the plan. If an income or fixed cost dated 4 Nov is still missing from Charts after this change, that's a second bug, checked during the real try.

## The rule after the change

- A month's spending is the whole calendar month, the setup month included, everywhere the budget is measured. That covers Home ("Left this month", "This week", the envelopes), Charts, the check-in's shares, the suggested budget, the reveal's monthly recap, badge week records from now on, and the MCP server.
- **Unchanged on purpose:**
  - **Months before the setup month have no plan.** Charts show their spending with nothing planned. The check-in leaves out a week's part that falls in such a month. No week result is recorded before the setup week.
  - **The reveal's guess vs reality stays a rate since the setup day:** spending since setup ÷ days × 30. Earlier entries would inflate it, and the guess was made at setup about the time after it.
  - **Recorded week results are never rewritten**, and Ramen Royalty still skips the setup week, because records already saved counted it only partly.
  - **The poster never posts before the plan existed.**

## Chunk 1 (~1 h): the rule, its texts and the MCP server

**Branch:** `fix/count-whole-setup-month`, from `origin/main`, in a sibling worktree `../StudentsBudget-month` (the shared checkout is on another session's branch). Link the main checkout's `node_modules`, and remove that link before ever deleting the worktree. Copy this plan to `docs/superpowers/plans/2026-11-06-count-whole-setup-month.md`.

Test-first. Each line below is an existing test that now asserts the opposite, or a new one; watch it fail before changing the code.

- **As built (2026-11-06):**
  - **Budget:** `spendingStart` is gone. So is `monthAround`'s `budgeted` flag, since it is always true once a month counts from the 1st; a week of the setup month that ended before the setup day now has its share like any other (two tests pin it). The five `budget.test.ts` cases failed first.
  - **Charts:** the "counted from" note is gone, and with it the `note` prop of `SpendingSection` and the `note` parameter of the spending chart's caption and summaries in all four languages, which only that note filled. The two `aggregate.test.ts` cases and the period case now count the backdated spending.
  - **Check-in:** `not-counted.ts`, its test and `checkIn.notCounted` (four languages) are gone; `EntryItem` lost `planStart`.
  - **Badges:**
    - `loggedExpenseTest` no longer looks at the date.
    - `weekResultOf` counts logged entries only in the measured part of a week, so a split week's part in a month before setup still logs nothing: the pinned assertion failed once the date check went, and passes again.
    - `planStart`'s comment says why Ramen Royalty still skips the setup week. Latte Survivor's "first full month after setup" stays: it is about months of using the app.
  - **Reveal:** `recapLine(month, leftoverMinor, lang)` lost `createdOn`. `recap.partial` and `recap.leftOver` are gone in all four languages (`leftOver` was only the partial line's wording); the setup month's leftover now reads "→ savings".
  - **MCP:** `beforeSetup` is gone from `recent_entries`, its schema and its note.
  - **Fixtures:** manual demo case 15 (`15-setup-date-boundary`) now expects €470 left, not €480. Its description, checks and entry note follow, in the generator, `manifest.json`, `CASES.md`, the JSON and the guide's row B07. Scenario 03's entry note, `generate-demo-backups.mjs`, README's scenario row and `demo-scenarios.test.ts` (food €24.50, not €6.50) follow as well. Nothing was regenerated, so no dates moved.
  - **Docs:** CLAUDE.md's "Budget maths" rule and its MCP line, README's Home paragraph, and the follow-ups doc's old ruling.

1. **`src/lib/budget.ts`:** delete `spendingStart`; `monthStatus` and `weekToSpend` measure from `firstOfMonth(month)`. Fix the doc comments that say "from the setup day".
   - Test: `budget.test.ts`, "does not count spending before the setup day" becomes "counts spending in the setup month from the 1st". Also add a `weekToSpend` case with a backdated expense in the setup week.
2. **Charts:**
   - `charts-view.tsx`: drop `countedFromNote` and the `note` it feeds.
   - `aggregate.ts`: the comment only.
   - Tests: the two setup-day cases in `aggregate.test.ts` (lines 122 and 146) now count the backdated spending.
3. **Check-in:**
   - Delete `src/features/check-in/not-counted.ts` and its test.
   - `check-in-view.tsx`: `EntryItem` loses `planStart`. Reword the tail comment: "a month before the setup month has no budget". The logic (`tail.end >= plan.createdOn`) already means exactly that.
4. **Badges:**
   - `records.ts` `loggedExpenseTest`: drop `entry.date >= plan.createdOn`.
   - `week-results.ts`: the doc comments only; it follows `weekToSpend`.
   - Tests:
     - `records.test.ts` 74 and 79: a backdated expense now counts.
     - `week-results.test.ts` 217: the setup week counts in full.
     - `week-results.test.ts` 293: a backdated expense makes the setup week logged.
     - `week-results.test.ts` 228 and 304: a part in the month before setup is still left out. Keep these.
5. **Reveal:**
   - `reveal-text.ts` `recapLine` loses `createdOn` and the partial label; `reveal-view.tsx` drops the argument.
   - The `monthRecap` doc comment.
   - Tests: `reveal-text.test.ts` 23–29 expect no "(counted from …)", and `reveal.test.ts` 192 counts the whole setup month. The `guessVsReality` tests stay.
6. **Texts:** remove `charts.countedFrom`, `checkIn.notCounted` and `reveal.partial` from `src/i18n/messages/{en,de,fr,es}/`. `messages.test.ts` and typecheck catch any left behind.
7. **MCP:**
   - `mcp/budget.ts`: drop `beforeSetup` from the entry schema, the note sentence and `setupDay`.
   - `mcp/check-in.ts`: reword the tail comment only.
   - Check `mcp/prompts.ts` for the word, since the prompt test reads its camelCase fields.
   - Test: `budget-overview.test.ts` 384 becomes "counts every expense of the setup month".
8. **Demo fixtures:** run `src/features/backup/demo-*.test.ts`. If a scenario's documented Home figure moves because it holds pre-setup spending, update the manifest and CASES.md figures by hand; regenerating would rewrite every date.
9. **Docs:**
   - CLAUDE.md "Budget maths": "counts spending from the setup day" becomes "counts the whole month's spending, the setup month included (Roshan, 06-11-2026)".
   - CLAUDE.md, MCP section: drop the "setup-day cut of `beforeSetup`" restated rule.
   - README's Home section, if it states the cut.
10. **Checks:** lint, typecheck, and the touched areas' unit tests (`src/lib`, `src/features/{charts,check-in,badges,reveal,backup}`, `src/i18n`, `mcp`). The full suite runs in CI. Commit `fix(budget): count the whole setup month, entries before the setup day included`.

## Chunk 2 (~45 min): the e2e specs

These three specs assert the old rule, and the fast-setup session's branch `test/e2e-seed-setup` rewrites the same three files (`seedSetup`). **Base this chunk on `main` after that branch has merged.** If it's still open when chunk 1 is done, ask Roshan whether to wait or stack on it; never let a stacked PR merge into a stale base.

- **`charts.spec.ts`:** the test at 587 becomes "the setup month counts every expense of the month, one dated before setup included, with no counted-from note".
- **`check-in.spec.ts`:**
  - 239: keep the previous month's tail rule; drop the "not counted" check.
  - 285: the backdated expense is listed with no note and counts in the week's total.
- **`reveal.spec.ts`:** 99, 118 and 130 lose "(counted from 16 Oct)". If the October fixture holds spending before 16 Oct, the amounts change; take the new figures from a run, after checking them by hand.
- Run those three specs through the lane, after Roshan's approval (the coordinator asks him):
  `node C:/Users/JoKu_CRITEX/.claude/lanes/lane.mjs run --who count-month --prio 2 --est 15m --what "charts, check-in, reveal specs" --wait 60m --max 30m -- 'npx playwright test e2e/charts.spec.ts e2e/check-in.spec.ts e2e/reveal.spec.ts --project=desktop-chrome'`
  The alternative is a CI run with `scope=changed`, which Roshan starts.

**One PR for both chunks (two commits)**, so `main` never holds the new rule with specs that assert the old one. It's a draft on `Roshan-ka/StudentsBudget`, its body ending with the Claude Code line, and every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Verification

- **Unit:** the flipped tests fail first, then pass. `budget.test.ts` shows a 4 Nov expense in a plan set up on 5 Nov counted in `monthStatus` and `weekToSpend`.
- **e2e:** charts, check-in and reveal specs green on desktop-chrome (lane or CI).
- **Real try on the live site after merge and deploy:** Home's "Left this month", "This week" and food's envelope include the 4 Nov expense. Charts show it with no counted-from note. The check-in lists it with no "not counted" note. Also look at whether Charts count a fixed cost or an income dated 4 Nov; if not, that's a separate bug.

## Risks

- **Badges' setup week.** Records already saved stay as they are; only weeks recorded after the merge use the whole-week rule. That's fine, since recorded rows are never rewritten.
- **Conflicts with the fast-setup session** in the three specs. Handled by building chunk 2 on its merged branch.
