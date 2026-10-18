---
tags: [project-idea, kickoff]
created: 2026-10-16
---

# Student Budget App: Kickoff

See also: [[Student Budget App - Concept]] · [[2026-10-16-p1-test-project|P1 plan]] · [[Student Budget App - Repo Setup]]

How building starts, and how a build day runs. Task-level detail lives in the [[2026-10-16-p1-test-project|P1 plan]].

## Where to start
- Repo folder, branch `main`, after the previous PR is merged.
- Open this folder (`docs/`) in Obsidian, not the repo root. Once the app is scaffolded, the root holds `node_modules` with thousands of README files.
- Shared Claude Code permissions are in `.claude/settings.json` (routine test, run and git commands). Your own overrides go in `.claude/settings.local.json`, which stays ignored.

## Repo layout
✱ marks what exists after Day 1; the rest arrives task by task.

```
StudentsBudget/
├─ .claude/settings.json ✱        shared allowlist
├─ .github/workflows/ci.yml ✱     lint · typecheck · unit · e2e on every PR
├─ .gitattributes ✱ .gitignore ✱ .npmrc ✱
├─ CLAUDE.md ✱                    stack + pinned versions, commands, constraints
├─ README.md ✱
├─ docs/ ✱                        this vault
├─ e2e/ ✱                         Playwright flows; helpers/setup.ts from Task 7
├─ public/ ✱                      icons; weekly-check-in.ics from Task 13
├─ src/
│  ├─ app/ ✱                      routes: /, setup, entries, entries/new, charts, check-in, reveal, settings
│  ├─ components/ ✱               bottom-nav, app-init, ui/ (shadcn)
│  ├─ data/ ✱                     categories ✱, cities (Task 6)
│  ├─ db/ ✱                       types, db, repo ✱ · rates (4) · bulk (14)
│  ├─ features/                   accounts · setup · entries · home · charts · reveal · check-in · backup
│  └─ lib/ ✱                      money, dates ✱ · fx (4) · budget (6)
├─ package.json ✱ tsconfig.json ✱ next.config.ts ✱ vitest.config.ts ✱ playwright.config.ts ✱
└─ .superpowers/                  build ledger, local only
```

Rules:
- Pure logic lives in `src/lib` and `src/features/*/*.ts`, with `*.test.ts` next to it.
- Routes in `src/app` stay thin.
- This vault stays notes-only.

## How a build day runs

| When | Me | Claude |
|---|---|---|
| Start | Open the session in the repo folder. Days 2–4: send the first prompt below | Switches or creates the day branch, reads the ledger, extracts task briefs |
| During | Day 1: 4 h of basics, then the Day 0 leftovers (GitHub CLI, Vercel, the [[Student Budget App - Repo Setup\|Repo Setup]] checklist). Days 2–4: read each finished task's report and ask "Explain this change to someone who knows Java and SQL" | Per task: implementer (test-first, commit) → reviewer → fix rounds → ledger line. One implementer at a time |
| End | Connect Vercel (Day 1) or check the preview. Open the Draft PR, run the review flow, merge. Log the day | Whole-day review → one fix wave → push the day branch after my go |

Claude stops and waits for me at:
- every push and merge
- the Vercel connect
- the iPhone checks (Task 15)
- anything that needs an account

**First prompt on Days 2–4:**

> Continue the P1 plan (`docs/superpowers/plans/2026-10-16-p1-test-project.md`) with subagent-driven development: Day N, Tasks X–Y. Use the ledger in `.superpowers/sdd/`.

| Day | Tasks | Done when |
|---|---|---|
| 1 | 1–3 | Empty app installs from a Vercel preview; helpers and database tested |
| 2 | 4–7 | Setup saves a plan with Regensburg ranges; INR rate works, also offline |
| 3 | 8–10 | "döner 6" updates "Safe to spend this week" in desktop Chrome |
| 4 | 11–14, 14b, 15 | Charts, reveal, check-in, backup; opens offline; installed and used on the iPhone |
