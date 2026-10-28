# StudentsBudget MCP server: plan

> **For agentic workers:** chunks of about 1 hour, done one at a time. Each ends with lint, typecheck, unit tests (and `npm run build` when config changes), a commit and a report to Roshan, who says when the next one starts.

**Goal:** a local MCP server, so Claude Code and Claude Desktop on Roshan's PC can answer from StudentsBudget's own data: first the sourced Regensburg catalogs, then his budget from the account. Building an MCP server end to end is one of Roshan's main internship tasks.

**Status (2026-10-28):** M1.1 and M1.2 built on `feat/mcp-server`: the server and five read-only tools (`regensburg_costs`, `find_discounts`, `find_tips`, `suggest_swaps`, `semester_info`), with in-memory client tests and tests that hold the server's copies of app helpers to the app's answers. M1.3's real try in Claude Code found two gaps, both fixed:
- Claude Code passes only the structured content to the model, so a miss reached it as an empty list. Every result now carries a `note`, and a miss returns the whole list.
- "room" and "swimming" found nothing. The search now matches words at their start in every field, sources included, and its note points to the full list when a German name may hide a match.

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
| M2.1 | Spike: run `src/lib/budget.ts` and `src/sync/download.ts`, which import through `@/` at runtime, from the server. Either a small Node resolve hook or `tsx` | A smoke test computes a month from the demo backup |
| M2.2 | Sign-in from `.env.local` (`STUDENTSBUDGET_MCP_EMAIL`, `STUDENTSBUDGET_MCP_PASSWORD`, git-ignored and entered by Roshan), `supabaseStore` and `planDownload`, then a `budget_overview` tool: left this month, this week, envelopes and balances, "as of your last Save" | Tests with the fake store: figures, an empty account, a refused row |
| M2.3 | `recent_entries`; tried for real with a test account and the demo backup; docs, reviewers, PR | Claude's "this week" figure matches Home |

In M2 the budget figures and entry notes go into the Claude conversation, so the first real try uses a test account.

## Later, each a plan of its own

- **Write tools** (adding an expense from Claude): these need P2.2's pull first. Without it, the next Save from the phone would remove them.
- **A remote MCP server** on Vercel with OAuth, for claude.ai and the phone.
- **AI inside the app**, through the `QuickAddProvider` seam.
