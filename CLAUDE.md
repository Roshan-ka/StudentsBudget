# StudentsBudget

@AGENTS.md

Installable Next.js web app for students new to a city (P1: no AI, no login, all data in the browser's IndexedDB). The plan is in `docs/superpowers/plans/2026-10-16-p1-test-project.md`; `docs/` is an Obsidian vault and stays notes-only.

## Stack

All versions are pinned exactly (`.npmrc` has `save-exact=true`). Node 24, npm.

| Package | Version |
|---|---|
| next | 16.4.2 |
| react, react-dom | 19.3.0 |
| typescript | 5.9.3 |
| tailwindcss, @tailwindcss/turbopack | 4.3.3 |
| shadcn (style `base-nova`) | 4.21.5 |
| @base-ui/react | 1.9.0 |
| class-variance-authority | 0.7.1 |
| cn | 0.4.0 |
| lucide-react | 1.58.0 |
| tw-animate-css | 1.4.0 |
| date-fns | 4.4.0 |
| dexie | 4.4.6 |
| dexie-react-hooks | 4.4.0 |
| recharts | 3.8.0 |
| zod | 4.6.7 |
| eslint, eslint-config-next | 9.39.5, 16.4.2 |
| vitest | 5.0.5 |
| fake-indexeddb | 6.2.5 |
| @playwright/test | 1.64.1 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen`, then `tsc --noEmit` |
| `npm run build` | Production build (`next build`); catches Cache Components errors that dev mode hides |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run test:e2e` | Playwright on `desktop-chrome` and `iphone` (WebKit); starts the dev server if none is running |
| `npm run test:offline` | Production build, `next start` on :3100 (the port must be free: it never reuses a server), then the Playwright offline check (`desktop-chrome`) |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, unit tests, e2e and the offline check on every pull request.

## Framework rules

- **Cache Components:** with `cacheComponents: true`, any client component that reads search params (`useSearchParams`) or the pathname on a dynamic-param route must render inside `<Suspense>`.
- **Dexie:** never query it during render, only in effects or `useLiveQuery`. The db module is safe during server rendering only as long as nothing opens it there.
- **Hidden pages stay mounted:** Next 16 keeps a page you navigate away from mounted but hidden (Activity): its effects clean up and re-run on return, and its state survives. Re-read data in effects before redirecting, and don't rely on unmount to reset state.
- **Hidden pages in e2e:** a hidden-but-mounted page keeps its labels and text in the DOM, so `getByLabel` and `getByText` can match hidden elements and trip strict mode. Prefer `getByRole` (with `exact` names) for anything on a page that may be hidden.
- **Dexie schema:** a schema change adds a new `db.version(n)`; never edit a version that has shipped.
- **Service worker** (`public/sw.js`, registered by `AppInit`):
  - Production only: `next dev` never registers it.
  - Never run `next start` on port 3000, or a production worker sits in front of `next dev` there; `npm run test:offline` uses 3100.
  - Its cache name follows the commit SHA (`NEXT_PUBLIC_BUILD_VERSION`), so commit before building for the phone, or an installed app keeps its old offline copy.
  - Don't enable `experimental.useOffline`: offline taps rely on Next's hard-navigation fallback when an RSC fetch fails.

## Global Constraints

**Code**
- TypeScript `strict`; no `any`.
- **Money:** integer minor units (`Minor`), never floats. Plan, envelope and city amounts are in EUR. Each entry keeps its account's currency in `amountMinor`, plus `eurMinor` converted at save time.
- **Dates:** local `IsoDate` strings (`YYYY-MM-DD`) and `IsoMonth` strings (`YYYY-MM`). Weeks run Monday–Sunday. The check-in is on Sunday.
- **Data:** everything lives in the IndexedDB database `studentsbudget`.

**What P1 leaves out**
- No AI calls, server routes, login, analytics or third-party scripts.
- The only outgoing request: `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=…`. Confirm the endpoint in Frankfurter's docs before coding.

**Text and layout**
- UI language is English. Money is formatted with `Intl.NumberFormat('en-IE', …)`: `€6.50`, and `€63` for headlines.
- Calm wording: overspending reads "€12 over", never "failed" or "warning!".
- Phone first: works at 375 px width, 16 px side gutters, no horizontal page scroll, bottom navigation.
- User-facing text states no platform storage-eviction rules (the Concept's iOS 7-day line has no source): say only that clearing site data or removing the app deletes the data.
- README's Privacy section lists the only outgoing request; change it in the same commit as any new request.

**Data rules**
- City: Regensburg only. Every city number has a source, a URL and a checked date. A number without a source is labelled "Estimate".
- Guesses are saved once in setup and never edited afterwards.

**Repo**
- A project `.npmrc` with `save-exact=true` (never the global npm config); versions listed in this file.
- `.gitattributes` with `* text=auto eol=lf`.
- Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- One branch and one Draft PR per day, from `main`. Nothing is pushed to `main` after the initial commit, and Roshan merges.
- Scratch specs under the git-ignored `.superpowers/` are still linted and type-checked by `npm run lint` and `npm run typecheck`: keep them clean or delete them.

## Keeping this file honest

Update this file when Claude gets something wrong twice. Add the rule here, in one line, instead of correcting it again in chat.
