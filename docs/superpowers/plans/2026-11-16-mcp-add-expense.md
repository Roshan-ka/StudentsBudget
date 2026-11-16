# MCP server: add an expense (16-11-2026)

## Context

The local MCP server (`docs/superpowers/plans/2026-10-28-mcp-server.md`) only reads. Its plan left write tools out until P2.2's pull existed. Now a linked phone pulls what its account gained at its next sync, automatically while open, so an entry added from Claude reaches the phone.

**Decided (Roshan, 16-11-2026):** one write only, adding an expense ("add €6.50 döner yesterday"). No edits, deletes, plan or other tables.

## Design

- **`add_expense`** (`mcp/add-expense.ts`) takes:
  - `amount` as typed ("6.50", "6,50"), through `parseAmount`;
  - an optional `note`;
  - an optional `date` (today when left out; none in the future);
  - an optional `category` (an expense category id);
  - an optional `account` (an account's name).
- **What it does:**
  1. It reads the account as the budget tools do (`readSaved`).
  2. It picks the account by name, or `defaultAccount`.
  3. It picks the category given, or `suggestCategory` from the account's own expenses.
  4. It builds the entry with `buildEntry`. The rates are the account's manual ones, as the budget tools read them.
  5. It checks the row with `ROW_CHECKS.entries`, then adds it through `insertNew`, which never overwrites.
- **The mark:** the entry's id is `mcp-<uuid>`. The account strips unknown fields from an entry row, so a field would be lost at the phone's next sync, while the id is kept. A later undo tool may tombstone only `mcp-` ids.
- **Refusals** are states with a note, never a guess:
  - an amount that isn't one, a future date, or an unknown account (the note lists the names);
  - no category given and none to guess (the note lists the categories);
  - an account in another currency without a manual rate in the account;
  - every state the budget tools already have (not set up, two-step sign-in, empty account…).
- **The account's writer:** `entryWriter(store)` in `account.ts` can only `insertNew` into `entries`. The reader's `store` stays `readOnly`. `AccountReader.entries` is optional: absent, as in the read-only test fakes, the tool says the account can't be written.
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`. Claude Code asks before each call.

## Chunks

1. **The tool, the writer and the tests** (`mcp/add-expense.test.ts` on the fake store; the tool lists in `create-server.test.ts` and `server.test.ts`), plus CLAUDE.md's MCP section.
2. **Later, if wanted:** `undo_added_expense`, tombstoning only `mcp-` ids, plus a real try from Claude Code against Roshan's account (without two-step sign-in).

## As built

- **Chunk 1** (16-11-2026), on `feat/mcp-add-expense`: see the PR.
