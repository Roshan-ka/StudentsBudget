# StudentsBudget MCP server: plan

> **For agentic workers:** chunks of about 1 hour, done one at a time. Each ends with lint, typecheck, unit tests (and `npm run build` when config changes), a commit and a report to Roshan, who says when the next one starts.

**Goal:** a local MCP server, so Claude Code and Claude Desktop on Roshan's PC can answer from StudentsBudget's own data: first the sourced Regensburg catalogs, then his budget from the account. Building an MCP server end to end is one of Roshan's main internship tasks.

**Status (2026-10-28):** M1 is done and merged (PR #4): the server and five read-only tools (`regensburg_costs`, `find_discounts`, `find_tips`, `suggest_swaps`, `semester_info`), with in-memory client tests and tests that hold the server's copies of app helpers to the app's answers. M1.3's real try in Claude Code found two gaps, both fixed:
- Claude Code passes only the structured content to the model, so a miss reached it as an empty list. Every result now carries a `note`, and a miss returns the whole list.
- "room" and "swimming" found nothing. The search now matches words at their start in every field, sources included, and its note points to the full list when a German name may hide a match.

M2.1–M2.3 are built on `feat/mcp-budget`.
- `budget_overview` reads the account and runs the app's own maths. `recent_entries` lists a month's entries.
- Both are tested with the fake store, and were tried for real over stdio signed in as test account A (saved 28-10-2026). Home showed the same €138 left for the month and the week, and Shopping's entries add up to its €95 spent.
- That real data caught a currency mix-up: one Shopping entry was paid in rupees. Entries now carry `eurMinor`, and the note says to add up euros.
- **Two parallel reviews** (code, and data with docs) found no high-severity defects. Fixed after them:
  - no EUR total when nothing converts, as Home does;
  - the plan weighed against what is available (`planSummary`);
  - `beforeSetup` on entries the budget leaves out;
  - the store wrapped so it refuses writes;
  - tests for the session (one sign-in, no kept failure, exactly one retry on a 401);
    - errors split into unreachable, refused and error, each logged to stderr.
- M2 merged as PR #5 on 28-10-2026, after green CI (e2e and the offline check included).

M3 (prompts and the clean-up) is under way on `feat/mcp-prompts`: M3.1 done (the server uses the app's own helpers; the copies and their parity tests are gone). M3.2 done: the `weekly_check_in` and `new_in_regensburg` prompts (`mcp/prompts.ts`).

**M3.3 reviews (two in parallel)** found that the check-in prompt measured the month, while the app's Sunday check-in measures each envelope against its share of the **week** and offers swaps only for those over it. Fixed:
- a `week_check_in` tool builds the week with the app's own check-in functions (`weekToSpend`, `weekRows`, `weekLine`, `weekSwaps`), including the earlier days on the Sunday after a month began mid-week;
- the prompt reads it, so it no longer calls `suggest_swaps` for categories that tool rejects;
- `new_in_regensburg` asks for what the costs don't cover instead of guesses, and for each discount's conditions;
- the university argument is read in any case, and an unknown one covers both;
- `mcp/server.test.ts` starts the real server in plain Node, which is the only test that catches a type imported without `type`;
- the prompts' field names are tested against the tools' output schemas.

**M2.1 result: a resolve hook, not `tsx`.**
- `mcp/app-imports.ts` registers a synchronous Node resolve hook (`module.registerHooks`). For files in `src/` only, it maps `@/…` to `src/…` and tries an extensionless path with `.ts`, then as a folder.
- A file that imports the app through `@/` must be loaded with a dynamic `import()` after the hook is registered: static imports are resolved before any code runs.
- The runtime graph of `src/lib/budget.ts`, `src/sync/download.ts` and `src/sync/store.ts` is 14 app files plus `date-fns` and `zod`, with no Dexie.
- One file used syntax Node can't strip: `StoreError`'s constructor parameter properties. Its fields are now written out, and tsconfig's `erasableSyntaxOnly` makes typecheck refuse such syntax anywhere.
- `mcp/budget.ts` runs Home's maths (`monthStatus`, `weekToSpend`). `mcp/budget.test.ts` runs it in plain Node through `mcp/budget-smoke.ts`: the demo backup's October 2026 leaves €138.10, as the demo pack documents, and every figure matches the same code loaded by Vitest.
- No new dependency. `tsx` would have added esbuild, whose install script npm 12 blocks by default.
- The catalog helpers copied into `mcp/catalog.ts` and `mcp/semesters.ts` in M1 could now come from the app through the hook. That is worth doing once M2's tools exist, so the parity tests can go.

**Builds on:** the catalogs in `src/data/` (every number with a source, a URL and a checked date) and P2.1's account ([[2026-10-23-p2-1-accounts-and-database|P2.1 plan]]). **Spec:** [[Student Budget App - Concept]]: the AI never states prices or advice it can't back up, and always says where they came from. Live sync ([[2026-10-26-p2-2-live-sync|P2.2 plan]]) is paused: reading needs no sync.

## How it is built

- **Where:** `mcp/` at the repo root, next to `scripts/`. It isn't part of the web app: nothing in `src/app` imports it, and the deployed site doesn't change.
- **Runs:** locally over stdio. Claude Code finds it through the committed `.mcp.json`, and Claude Desktop can use the same command. No hosting and no OAuth.
- **Language:** TypeScript, run directly by Node 24, which strips the types, the same way `scripts/generate-demo-fixtures.mjs` loads the catalogs. `tsconfig.json` allows `.ts` import paths (`allowImportingTsExtensions`; the project never emits), so `mcp/` is type-checked with everything else.
- **SDK:** `@modelcontextprotocol/sdk`, pinned exactly; it accepts zod 4.
- **Tests:** a real SDK `Client` talks to the server over the SDK's in-memory transport, in Vitest.
- **Logging:** stdout carries the protocol, so the server writes only to stderr.

## Stage M1: Regensburg knowledge (no account, no secrets)

| Chunk | What | Done when |
|---|---|---|
| M1.1 | The SDK, `mcp/server.ts`, `npm run mcp`, `.mcp.json`, Vitest and tsconfig settings, and the first tool `regensburg_costs`: the cost ranges and prices from `CITIES`, each with its source, URL and checked date | The in-memory client lists the tool and calls it; lint, typecheck, unit tests and build pass |
| M1.2 | `find_discounts`, `find_tips`, `suggest_swaps`, `semester_info`: zod inputs, read-only, and descriptions that tell the model to cite the source and the checked date | Tests per tool: filters, an empty result, every item sourced, a date between two semesters |
| M1.3 | Tried for real in Claude Code ("What does a room cost in Regensburg?"); README section and CLAUDE.md rules; two parallel reviewers; Draft PR | Claude answers from the tools with their sources; CI green |

## Stage M2: the budget from the account (read-only)

| Chunk | What | Done when |
|---|---|---|
| M2.1 ✓ | Spike: run `src/lib/budget.ts` and `src/sync/download.ts`, which import through `@/` at runtime, from the server. Either a small Node resolve hook or `tsx`. Chosen: the hook (see the status above) | A smoke test computes a month from the demo backup |
| M2.2 ✓ | Sign-in from `.env.local` (`STUDENTSBUDGET_MCP_EMAIL`, `STUDENTSBUDGET_MCP_PASSWORD`, git-ignored and entered by Roshan), `supabaseStore` and `planDownload`, then a `budget_overview` tool: left this month, this week, envelopes and balances, "as of your last Save" | Tests with the fake store: figures, an empty account, a refused row |
| M2.3 ✓ | `recent_entries`; tried for real with a test account and the demo backup; docs, reviewers, PR | Claude's "this week" figure matches Home |

In M2 the budget figures and entry notes go into the Claude conversation, so the first real try uses a test account.

## Stage M3: prompts, and one source of truth (chosen on 28-10-2026)

After tools, MCP's other main building block is the **prompt**: a named template the user picks, which Claude Code shows as a slash command (`/mcp__studentsbudget__<name>`). Resources were left out: the catalogs serve better as searchable tools than as static documents.

| Chunk | What | Done when |
|---|---|---|
| M3.1 ✓ | **Clean-up.** The M1 copies of app helpers become imports of the app's own code, through the import hook that M2 brought:<br>• `categoryName` and `orderOf` (`src/features/entries/categories.ts`);<br>• `amountText`, and the saving wording (`src/features/swaps/suggest.ts`, which exports its `savingText` for this);<br>• `STALE_AFTER_DAYS` (`src/features/discounts/discounts.ts`);<br>• `semesterOn` and `UNIVERSITIES` (`src/features/profile/profile.ts`).<br>The parity tests in `mcp/catalogs.test.ts` go; the behaviour tests stay. | One copy of each rule. The plain-Node smoke test loads the new graph. Lint, typecheck and unit tests pass, and the server answers over stdio as before |
| M3.2 ✓ | **Two prompts:**<br>• `weekly_check_in`: the app's Sunday check-in, in a chat. Claude calls `budget_overview` and `recent_entries`, then `suggest_swaps` for envelopes that are over, and writes it the calm way, as of the last Save;<br>• `new_in_regensburg`, with an optional university: the first month for a new student, through `regensburg_costs`, `semester_info`, `find_tips` and `find_discounts`, all cited. | The in-memory client lists both and gets their messages; the steps name only tools that exist |
| M3.3 | **Try it for real** in Claude Code: reconnect the server and run both slash commands. Then README and CLAUDE.md, two parallel reviewers, push after Roshan's go, and the Draft PR | The check-in matches Home's figures; CI green |

## Later, each a plan of its own

- **Write tools** (adding an expense from Claude): these need P2.2's pull first. Without it, the next Save from the phone would remove them.
- **A remote MCP server** on Vercel with OAuth, for claude.ai and the phone.
- **AI inside the app**, through the `QuickAddProvider` seam.
