# Plan history (10-11-2026)

## Context

Every past month is measured against today's plan:
- the charts (`spendingRowsOf`, `src/features/charts/aggregate.ts:46-56`);
- the month recaps on /reveal (`monthRecap`);
- the check-in's tail of last month;
- Ask's snapshot (`pastMonths`);
- the MCP server's check-in.

The weekly badges' rows are recorded once, but a week recorded late, or backfilled on the first run, also gets today's plan (`week-results.ts:120-123`). So raising an envelope in December rewrites how October looks. The P1 follow-ups (line 151) and the data-bugs plan (line 139) put this off until there was a plan history.

## Decided (Roshan, 10-11-2026)

- **One plan per month:** each month keeps the plan as it stood at its end. An edit changes the current month only, as the budget maths already plan whole months (no proration).
- **Months with no history** (everything before this ships) use the current plan, as today.
- **Synced like the plan:** a new account table, the backup and the sync tables, so two linked phones show the same past months.

## Design

- **The row:** `PlanMonth = { month: IsoMonth, incomes, fixed, oneOffs, envelopes, spendingBudgetMinor? }`.
  - It holds only the money parts.
  - Lines drop their `schedule`: watermarks and accounts are today's business, and the poster keeps using the current plan.
  - `createdOn` and `cityId` stay on the plan.
- **The rule** (`src/lib/plan-history.ts`, pure, tested). `planForMonth(plan, history, month, today)` gives:
  - the current plan for the current month and later;
  - for an earlier month, the plan with the money parts of that month's row, or else of the latest row before it;
  - the current plan when no row is at or before it.
  - Months before `createdOn` still have no plan; callers keep their checks.
- **Writing:** `recordPlanMonth(plan)` puts the current month's row from the plan as saved. It is called after each person's plan write, in the same transaction:
  - setup's Save and Edit plan (`save-wizard.ts`);
  - `updatePlan` (the fixed costs and income editor);
  - the suggested budget's envelopes (`suggested-budget.tsx`).
  - It is never called by the recurring poster, which only moves watermarks, or by a pull or a restore, which bring their rows.
- **One row per month** (id = the month), so a month's last edit wins. Two phones editing the same month: the last sync wins, as for the plan.

## Chunks (about 1 h each, a draft PR each, CI on Roshan's OK)

1. **The rule:** `PlanMonth`, `planMonthOf(plan)` and `planForMonth` in `src/lib/plan-history.ts`, with unit tests: current and future months, a month with its own row, a gap that falls back to an earlier row, no row, a row before `createdOn`.
2. **The phone's table and writes:**
   - Dexie `db.version(6).stores({ planMonths: 'month' })`, a row schema (`planMonthRow`), and `recordPlanMonth` at the writers above;
   - the backup v5 (`READABLE_VERSIONS` 1–5, `.default([])`) and `bulk.ts`;
   - unit tests that each writer leaves the month's row, and that the poster and a pull leave none.
3. **The account's table:** the migration `plan_months`, on the `checklist_ticks` pattern:
   - RLS, the second-step policy, `stamp_sync` and `stamp_updated_at`;
   - `sync_pull` redefined;
   - pgTAP, including account deletion.
4. **Sync:**
   - `SERVER_TABLES`, `byTable`, `serverRowsOf`, `DEXIE_SYNC` and `DEXIE_HOME` in `src/sync/tables.ts`;
   - `ROW_CHECKS` and `planDownload`;
   - the write and delete orders;
   - sync and download unit tests.
5. **Reads:** every past-month view takes `planForMonth`:
   - charts (`spendingRowsOf`);
   - the recaps (`monthRecap`);
   - the check-in's tail (`check-in-view.tsx`);
   - week results (`record()`, with the week's month);
   - Ask's snapshot;
   - the MCP server's check-in (the account's `plan_months` through `planDownload`).
   - Each gets the history beside the plan, from one `useLiveQuery` or read, and has unit tests with an edited plan.
6. **e2e and docs:**
   - **`e2e/plan-history.spec.ts`:** on a fixed clock, set an envelope in October and raise it in November. October's recap and chart keep October's amount, and November's shows the new one. Then a linked phone sends the month's row to the mocked account.
   - **Map entries and CLAUDE.md:** a Plan history rule, the Budget maths and Week results rules, and the new table in the sync and backup lists.

## As built

- **Chunk 1** (10-11-2026), `src/lib/plan-history.ts`:
  - `PlanMonth`;
  - `planMonthOf(plan, month)`: copies, with lines that drop their schedule, and no budget when the plan has none;
  - `planMonthFor(history, month)`: the month's own row, else the latest one before it;
  - `planForMonth(plan, history, month, today)`: the current plan for the current month and later, or with no row. A past month gets its row's money parts and its own budget or none, never today's.
  - 9 unit tests. Nothing reads it yet.
- **Chunk 2** (10-11-2026), the phone's table and its writes:
  - **The table:** `PlanMonth` sits in `src/db/types.ts`, with `planMonthRow` beside `planRow` (the one-off schema is shared), and Dexie `db.version(6)` adds `planMonths` keyed by `month`.
  - **`recordPlanMonth(plan, today)`** (`src/db/plan-months.ts`) runs inside the plan write's transaction, which now also holds `planMonths`:
    - `updatePlan` records the plan as saved, so Edit plan and the fixed costs and income editor record too;
    - a new setup records its month;
    - the suggested budget now saves through `updatePlan`, not `db.plan.update`.
    - The poster, a pull and a restore record nothing.
  - **Backup v5:** reads v1–v5, `planMonths` defaults to `[]`, and two rows of one month are refused. `fixtures/manual-demo/invalid/newer-version.json` is now version 6.
  - **Bulk:** export, replace and clear include `planMonths`.
  - **Placeholders:** `planDownload` and the MCP server give `planMonths: []` until chunk 4. Until then, a link that loads the account's data clears the phone's history along with the rest, as replacing does.
  - **Tests:** `src/db/plan-months.test.ts` (the writers, and the poster that leaves none), the v6 store in `db.test.ts`, and the backup's version 4 and 5 cases.
- **Chunk 3** (#194, built in the checklist session): the account's `plan_months` table (migration `20261110134042_plan_months.sql`) with its pgTAP.
- **Chunk 4** (11-11-2026), sync:
  - **Where the table is named:**
    - `plan_months` joins `SERVER_TABLES`, `byTable`, `serverRowsOf` (id: the month), `DEXIE_SYNC` (`planMonths`) and `DEXIE_HOME`;
    - `ROW_CHECKS` (`planMonthRow`);
    - `planDownload`, which now brings the account's months in place of chunk 2's `[]`.
  - **What follows from that list:** the write and delete orders, the pull's transaction and the fake store, so a linked phone records each month's row in the outbox beside the plan (`updatePlan` queues `plan_months:<month>` and `plans:current`), pushes it, and pulls another phone's.
  - **Fixtures:** `scripts/generate-demo-fixtures.mjs` now writes `newer-version.json` as version 6, matching chunk 2's hand edit.
  - **Tests:** upload, download, pull (a month and its tombstone), change tracking (a month by its id, and `updatePlan`'s two rows), and the snapshot with a month row.

## Verification

- **Each chunk:** lint, typecheck and the touched unit tests locally (no heavy lane).
- **Chunks 2–6:** changed CI runs on Roshan's OK. The backup, Settings and Home reach every spec; chunk 3's `db` job runs the pgTAP.
- **Real try:**
  - edit the plan, change the phone's month, edit again: the old month's recap stays;
  - a second linked phone shows the same.
