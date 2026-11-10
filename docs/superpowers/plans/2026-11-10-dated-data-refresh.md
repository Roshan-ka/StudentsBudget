# Dated data refresh, after fixing automatic sync's e2e (10-11-2026)

## Context

Roshan asked for a plan for the dated data refresh, the one leftover item with deadlines:
- **Discounts:** all 17 in `src/data/discounts.ts` share `CHECKED = '2026-10-20'`. With `STALE_AFTER_DAYS = 56` (`src/features/discounts/discounts.ts:18`), every discount without a vote reads "May be outdated" from **15-12-2026**.
- **Deutschlandticket:** €63 until 31-12-2026, then **€66.80** (`src/data/cities.ts:135-142`). It is shown nowhere: `HIDDEN_PRICE_LABELS` in `mcp/regensburg-costs.ts` and `LEFT_OUT_PRICES` in `city-pack-build.ts` keep it out.
- **The €22 student surcharge** (tip `upgrade-to-deutschlandticket`, swap `deutschlandticket-for-travel-months`): RVV hasn't published a figure for 2027 yet. `docs/Student Budget App - P1 follow-ups.md:216-219` asks for a re-check in December.

On the way, #185's CI run (42795845607) failed: all four tests of the new `e2e/auto-sync.spec.ts`, in shard 1/4. Automatic sync is the open work, so it is fixed first.

## Decided (Roshan, 10-11-2026)

- **A discount whose source no longer confirms it:** kept, with its old checked date, so it shows "May be outdated" from 15-12. A confirmed one gets the date of its re-check.
- **The Deutschlandticket €66.80:** an edit in January (chunk 3). No dated-price mechanism.

## Chunk 0: fix automatic sync's e2e (#185 first; the fix lands where the bug is)

What the traces show (read-only so far):

1. **A run that started before the link sticks at `not-linked`.** This explains tests 2 and 4.
   - On sign-in, the `auth` event starts a run at once. Its `sync()` reads `syncState` before `linkPhone` has written the link, so it ends `not-linked`.
   - By then the `link` event has already arrived, so nothing clears the stop. The phone never syncs by itself again until the next reload.
   - **Fix:** in `src/sync/auto-schedule.ts` (`finished`), a `not-linked` outcome stops only while `state.linkedTo !== state.userId`. Otherwise it is wanted again, at the minimum gap. Add a table test: an auth-started run, then the link event, then `not-linked`, and the next run is due.
2. **The offline test navigates while offline,** and with service workers blocked no page loads. This is a spec bug: make the change on the profile page offline, assert nothing reached the account, go back online, and expect it sent. Drop the "Offline: 1 change waits" line, which is already covered in `linking.spec`.
3. **Test 1 (a change on a freshly loaded page is never sent):** the trace shows the opening run's `sync_pull`, then no call for 15 s. Cause 1 doesn't explain it.
   - **Reproduce first:** `auto-sync.spec.ts` alone, Chromium, through the lane: `node C:/Users/JoKu_CRITEX/.claude/lanes/lane.mjs run --who coordinator --prio 1 --est 6m --what "auto-sync.spec repro" --wait 60m --max 30m -- 'npx playwright test e2e/auto-sync.spec.ts --project=desktop-chrome'`. If you'd rather not use the lane, run it in CI on the branch.
   - **Then:** find the cause and fix it at its root, with a unit test. Candidates are a timer cleared by a later event, or a stop or pause set by an event the unit tests don't play.

The fix commits go on `feat/auto-sync-4` (#183) when the bug is in chunk 3 or 4's code, or on `feat/auto-sync-6` when it is in the spec only. Then CI, on your OK.

## Chunk 1: re-check the 17 discounts (before 15-12-2026)

- **Each discount:** WebFetch its `url` and compare the offer, the conditions and the address with the source.
  - **Confirmed:** `checked` becomes the re-check date.
  - **Changed:** the text is updated in `src/data/discounts.ts` and in `src/i18n/city/{de,es,fr}/discounts.ts`, and the item takes the new date.
  - **Not confirmed:** the item stays as it is.
- **Per-item dates:** the shared `CHECKED` constant splits into per-item dates; `freshness()` already reads each item's `checked`.
- **The findings** go into the plan doc as a table: discount, what the source says, and the outcome.
- **Then:** `node scripts/write-city-pack.mjs`, and `src/data`, `src/i18n/city` and `src/features/ai/server` unit tests.
- **A page that can't be fetched** (blocked, needs a sign-in) counts as not confirmed, and the table says why. A site's own terms are never typed into a form.

### As built (chunk 1, 10-11-2026)

- **Outcome:** 16 sources still state their offer, and none changed. They now carry `RECHECKED` (`2026-11-10`), so they read "May be outdated" only from 05-01-2027.
- **The one kept:** the library card keeps `CHECKED` (`2026-10-20`), as decided.
- **No text changed,** so the translations stay. The city pack was rewritten for the new dates.
- **The two regensburg.de pages** answered 503 to automated fetches, so they were read in the in-app browser.
  - **document Kepler:** confirmed there.
  - **Library card:** the fee page confirms €17 and €10 reduced, but it leaves who gets the reduction to the Benutzungsordnung (a 2015 PDF). That PDF only downloads, so it wasn't read.

| Discount | What the source says (10-11-2026) | Outcome |
|---|---|---|
| Asia Restaurant Sunrise | 10% for students, Mon–Sun, on the student ID; not combined; now adds "Angebot bis auf Widerruf" (until withdrawn) | confirmed |
| Mensa children's plate | free Kinderteller up to the sixth year, with the parent's lunch; Kinderteller-Mensakarte with birth certificate and Studienbescheinigung | confirmed |
| Kinos im Andreasstadel | €9, reduced €8 with proof (students listed) | confirmed |
| Staatstheater | 50% off in open sale until the 30th birthday; U30 shows €10 any seat | confirmed |
| Turmtheater | €32, students, pupils and trainees 50% (€16) | confirmed |
| Kunstforum Ostdeutsche Galerie | €6, reduced €4 (students, pupils, trainees) | confirmed |
| document Kepler | adults €5; free for "Studierende unter 30 Jahre" on an ID; tours €8, reduced €5 | confirmed (in the browser) |
| Schloss Thurn und Taxis | reduced prices for students on their ID | confirmed |
| Westbad | 3 h €7.20 / €4.60; day €10 / €6.50; 15 to 25th birthday, proof at the entrance | confirmed |
| Sportpark Ost pool | €5 / €2.90, same rule | confirmed |
| Donau-Arena | €6 / €5; Discolauf €7 / €6, same rule | confirmed |
| Boulderwelt | €9.90 day entry on Mondays, students and trainees, not on holidays | confirmed |
| Super Bowl | Tuesdays €1 a game for pupils and students | confirmed |
| Alnatura | 8% on Tuesdays for students, apprentices and pupils with ID, in every German store | confirmed |
| Bella's Kunst | men's cut €36, student €30 | confirmed |
| Stadtbücherei library card | €17, reduced €10 "siehe Benutzungsordnung"; the rule (a PDF) not read | kept at 20.10.2026 |
| VHS course fees | 10% for regularly enrolled students on application, a week ahead; not combined | confirmed |

**Left for later:**
- The library card's rule, from the PDF read by hand.
- Whether Asia Restaurant Sunrise's "until withdrawn" should join its conditions.
- The street addresses of the pages that show none (Thurn und Taxis, the Stadtwerk venues, Super Bowl).

## Chunk 2: the other dates that pass in the coming months (December)

- **The 2027 student surcharge:** re-check `rvv.de/semesterticket`. If published, update the tip, the swap and their translations; if not, leave the €22, which is true for winter 2026/27.
- **The semester-ticket tip** (`ride-on-your-semester-ticket`) says €126, the winter 2026/27 figure. From summer 2027 it is €128 (`semesters.ts`). Reword it to the semester in its source, or name both, in all four languages.
- **UR summer 2027 re-registration dates:** if UR has published them, add the month to `SEMESTER_FEES`.
- Then the city pack and the same tests.

## Chunk 3: January (on or after 1-1-2027)

- `cities.ts`: the Deutschlandticket price becomes `6680`, and its source and comment get a new `checked` date.
- The surcharge, if RVV published it after chunk 2.
- City pack and tests. `create-server.test.ts` still finds no price.

## Files

- `src/sync/auto-schedule.ts` and its test; `e2e/auto-sync.spec.ts`; whatever test 1's cause needs.
- `src/data/discounts.ts`, `tips.ts`, `swaps.ts`, `semesters.ts` and `cities.ts`.
- `src/i18n/city/{de,es,fr}/*.ts`.
- `supabase/functions/_shared/ai/city-pack.ts` (written by the script, never by hand).
- `docs/superpowers/plans/2026-11-10-dated-data-refresh.md` (this plan, with the findings table).

## Verification

- **Chunk 0:** schedule unit tests; the lane run of `auto-sync.spec.ts`; then a CI changed run on #185 (every spec), on your OK.
- **Chunks 1–3:**
  - `npm test` for `src/data`, `src/i18n/city`, `src/features/discounts`, `src/features/ai/server` and `mcp`; lint and typecheck.
  - CI quick checks on the ready PR. The data reaches Tips and Discounts, so a changed run covers their specs.
- **By hand after merging:** Discounts shows no "May be outdated" on confirmed items on the live site.
