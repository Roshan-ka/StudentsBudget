# The shorter setup, and a seeded e2e setup

## Context

A new setup was seven steps: City and rent, Accounts, Income, Fixed costs, One-off costs, Guesses, Envelopes. Almost every e2e spec clicked through all seven before testing anything, so the iPhone (WebKit) runs timed out. Roshan asked for two things (05-11-2026), planned with him first:
- the wizard itself shorter;
- e2e helpers that seed the finished setup straight into IndexedDB, with waits on a real app-ready signal.

**Roshan's decisions (05-11-2026):**
- Guess vs. reality goes. /reveal keeps only the month-by-month recaps.
- Rent goes to the top of Fixed costs, with its Regensburg range and source. The City and rent step and its disabled city picker go: Regensburg is the only city.
- One-off costs leave the new setup. They stay a step of Edit plan (Settings → Plan).
- Extras: "Use the suggested amounts" without a budget, and a way to the recaps that does not need guesses.
- "Just one euro account" and "Finish later": not now.
- The look was approved from the round-1 mockups (German, phone width, light and dark).

## Part B: seeded e2e setup (PR #135)

- `AppInit` sets `data-app-ready` on `<html>` once React has hydrated and the database is open and seeded; `e2e/helpers/app.ts` waits on it.
- `seedSetup` (`e2e/helpers/seed-setup.ts`) builds the rows with the wizard's own `draftToRecords` and writes them from /tips. `setup.spec.ts` compares them with what the wizard saves.
- A global setup compiles every route first; every test gets 60 s and every expect 10 s, because the dev build on a busy laptop is slow.
- Gate (10 repeats, 2 workers, check-in, badges and accounts): iPhone alone 270/270, desktop Chrome alone 270/270. The run with both together waits for a machine with memory to spare.

## Part A: the shorter wizard

### A1. Four steps, rent in Fixed costs
- A new setup: Accounts, Income, Fixed costs (rent first), Envelopes; three steps when accounts exist. Edit plan: Income, Fixed costs, One-off costs, Envelopes.
- No data change: rent stays the plan's `rent` line, and the draft keeps `rentMinor` and `rentSchedule`. Rent's amount check moves into the `fixed` step.
- `fillSetup` walks four steps. `seedSetup` adds the fixture's one-off as Edit plan would on the setup day, so the specs' numbers stay.

### A2. Guess vs. reality goes
- /reveal is "Month by month": each finished month against the envelopes, "Change my envelopes", and a line until the setup month is over.
- Home shows "See how October went" once a month has ended.
- Nothing reads or writes guesses. The table, the type, backup's field and the synced table stay, so older data restores and syncs; dropping them would need a Dexie version, backup v4 and a migration.
- `GUESS_CATEGORY_IDS` is `CORE_FLEXIBLE_IDS`.

### A3. A suggested split without a budget
- Without an everyday budget, the envelope suggestions share out what is available (`suggestionTarget`), and the step's first line says how much.

### A4. Docs and checks
- CLAUDE.md: the Setup rule, the guesses data rule, and the seeded-setup rule.
- e2e: setup, reveal, home, profile, demo-scenarios, overdrawn, recurring and the other specs that walk the wizard, once on both projects.

## Follow-ups
- Run e2e against a production build (`next build` + `next start`) instead of `next dev`: the dev build's slowness is why the timeouts had to grow.
- Native reads of the new German, French and Spanish texts.
