---
tags: [project-idea, repo-setup]
created: 2026-10-16
---

# Student Budget App: Repo Setup

See also: [[Student Budget App - Concept]] · [[2026-10-16-p1-test-project|P1 plan]]

## The repo
- **Since 2026-10-27:** `Roshan-ka/StudentsBudget` (Roshan's personal account), **public**, is the main repo. It holds the full history (`main` and both `chore/` branches, copied over in one push), and pull requests are opened and merged there. Vercel and Supabase run on the personal accounts too.
- `SupportRW/StudentsBudget` is a backup copy for the internship mentor to see. It receives every push (in the local checkout, `origin` pushes to both), and nothing is worked on there: no PRs, CI or deploys. It was the repo from 2026-10-16 to 2026-10-26 (PRs #1–#15).
- The settings checklist below was done on `SupportRW/StudentsBudget`; go through it again on `Roshan-ka/StudentsBudget`.
- `SupportRW/StudentsBudget`, **public**, created 2026-10-16 with GitHub's README.
- Public, because on a free personal account branch rules, unlimited Actions minutes and free secret scanning only apply to public repos. P1 has no secrets, and real spending data never enters the repo; it stays on the phone.
- Description:

> Budget app for students new to a city: see where your money goes across all your accounts and cash, check whether your budget is realistic for your city, and log spending in seconds. Installable web app; data stays on your phone.

## Settings checklist

### General
- [ ] Features: Issues on; Wiki, Projects and Discussions off
- [ ] Pull requests: **Allow merge commits** on; squash and rebase off. Each task's commit stays visible.
- [ ] **Automatically delete head branches** on. Day branches are stacked, and GitHub retargets the next PR to `main` when the merged branch is deleted.
- [ ] **Always suggest updating pull request branches** on

### Ruleset for `main` (Rules → Rulesets)
- [ ] Require a pull request before merging, with **0 required approvals**: GitHub doesn't let you approve your own PR
- [ ] Require status checks to pass: add the CI job after the first workflow run, because GitHub only lists checks it has seen
- [ ] Block force pushes
- [ ] Restrict deletions
- [ ] Leave "require linear history" off; it conflicts with merge commits

### Actions → General
- [ ] Allow GitHub-made and verified actions
- [ ] Workflow permissions: read repository contents (read-only)

### Advanced Security
- [ ] Dependabot alerts on
- [ ] Dependabot security updates on
- [ ] Dependabot version updates off for now (versions are pinned; weekly bump PRs would be noise during the P1 build)
- [ ] Secret scanning with push protection on
- [ ] CodeQL default setup: optional (free on public repos, adds a few minutes per PR)

### About box
- [ ] Topics: `nextjs`, `typescript`, `pwa`, `budgeting`, `students`, `indexeddb`
- [ ] Website: the Vercel production URL, once it exists

### Tools
- [ ] GitHub CLI installed (`winget install --id GitHub.cli -e`) and `gh auth login` done
- [ ] Vercel: signed in with GitHub; the Vercel GitHub app has access to **only this repository**
- [ ] Vercel and Supabase on the personal accounts (since 2026-10-27): the Vercel project imported from `Roshan-ka/StudentsBudget`, with the two `NEXT_PUBLIC_SUPABASE_*` variables (type Config, Production) from the personal Supabase project
