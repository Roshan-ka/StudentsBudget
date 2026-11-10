# Automatic sync for a linked phone (10-11-2026)

## Context

Roshan asked what is left to build, with the AI set aside, and picked **automatic sync** from the list (the full list is in the appendix).

Today a linked phone syncs only in four cases:
- on Sync now;
- once after linking;
- after setup's Save;
- before signing out.

So two phones drift until someone taps. The P2.2 plan (`docs/superpowers/plans/2026-10-26-p2-2-live-sync.md`) had designed automatic sync, then was cut down to Sync now to keep the chunks small. This plan builds it now, on the engine as it is.

The engine is ready for it:
- `syncNow` is safe to repeat, and a sync with nothing queued costs one `sync_pull`.
- One sync runs at a time in a tab, and the Web Lock covers tabs.
- `liveQuery` on `db.outbox` already notices every change.

## Decided (Roshan, 10-11-2026)

- **Triggers:** on opening and on each return to the app (visible), on reconnecting (`online`), about 3 s after a change (at most 5 s after the first unsent one), and every 60 s while the app is visible. Sync now stays.
- **No switch:** sync is always automatic on a linked, signed-in phone.
- **Start order:** on a linked phone, sync first (capped at 8 s), then rates, recurring entries and weeks. A week is recorded only after a successful sync in this visit, or on an unlinked phone, so two phones never record a week differently.

**My calls (open to objection):**
- **Backoff after `failed`:** 1, 2, 4, 8, then every 15 minutes. `online` skips the wait once per failure.
- **`offline` never backs off:** the next `online` runs it.
- **Automatic runs stop** on `signed-out`, `update-needed`, a second step owed or no link, until an auth or link change.
- **Automatic runs skip, never queue, when another tab holds the lock.** That tab is syncing anyway.

## Design

### Engine and lock (`src/sync/lock.ts`, `src/sync/engine.ts`)
- **`withSyncLockIfFree(task)`:** `navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, …)` returns `BUSY` when another tab holds the lock. It is taken at the outermost call only, like the waiting lock.
- **`syncIfFree(store, userId)`:** returns a `SyncResult`, or `{ kind: 'busy' }`.
  - It joins the tab's `running` sync if there is one.
  - Inside the lock callback it never calls `syncNow` and never awaits `running`, which would deadlock with a Sync now tapped while the lock is being asked for.
  - Both entry points clear `running` only if it still holds their own promise.
- **`onSyncDone(listener)`:** an in-tab listener for every finished sync, whoever started it. A Sync now or setup's sync resets the backoff and counts for the visit.

### The schedule, pure (`src/sync/auto-schedule.ts`)
`step(state, event, now) → { state, run, wakeAt }`, tested as a table with no timers.

**Events:**
- the page: `visible`, `hidden`, `online`, `offline`, `tick`;
- the data: `outbox{count, newest}`, `auth{status, userId}`, `link{userId}`;
- the runs: `started{outbox}`, `finished{outcome, outboxAfter}`;
- sign-out: `pause`, `resume`.

**Outcomes:**
- `synced`, and `held:N`: next run in 60 s.
- `failed`: backoff.
- `offline`: wait for `online`.
- `busy`: next run in 60 s, no backoff.
- `signed-out`, `update-needed`, `second-step`, `not-linked`: stop until auth or the link changes.

**Hidden:** a pending change still runs at once, then the interval stops.

**No loops:**
- The outbox changes a sync makes itself (settle, a pull's re-queue) are ignored while it runs, and judged once when it finishes: a change is pending only if more is left than the held rows.
- While idle, a change means the count or the newest `seq` rose above that baseline. Held rows never trigger a run.
- The recurring poster writes only when a period is due, so it adds at most one run.

**Coalescing:** a run in flight absorbs every trigger, and automatic starts are at least 5 s apart.

### The runner (`src/sync/auto-runner.ts`, wired in `src/features/account/auto-sync.ts`)
- **`createAutoRunner({ now, setTimer, clearTimer, run })`:** one timer slot. It returns `{ dispatch, visit(reason), stop }`.
  - `visit('open' | 'return')` starts a sync and resolves `'synced' | 'unlinked' | 'not-synced'`.
  - `'focus'` syncs only if this visit has no success and nothing is in flight.
  - `'midnight'` only reads the visit's state.
  - Tested with Vitest fake timers.
- **`startAutoSync()`:** subscribes to:
  - `visibilitychange` (hidden), `online` and `offline`;
  - a `liveQuery` on the outbox (count and newest `seq`, with no schema change);
  - a `liveQuery` on `syncState` (the link, and another tab's `lastSyncedAt`, which pushes this tab's interval back);
  - `onAuthStateChange` (dispatch only, nothing inside the callback);
  - `onSyncDone`.
- **`run()`:** reads `getSession()`, applies `authStateOf`, checks `syncState.userId`, then calls `syncIfFree(supabaseStore(…))`.
  - On the first `failed` of a streak it calls `askForCodeIfRefused`. That is extracted from `SyncSection`'s `accountWantsCode` use and shared with it, so a second step turned on elsewhere shows the code step.
  - `liveQuery` errors after the sign-out wipe deletes the database are caught.
- **`pauseAutoSync()` and `resumeAutoSync()`:** `syncThenSignOut` pauses before its "N changes aren't in your account" question and resumes on Stay signed in.

### AppInit: start order and week gate (`src/components/app-init.tsx`)
- `startAutoSync()` starts after `finishSignOut`, `ensureSeeded` and `data-app-ready`, so nothing new delays the attribute. Cleanup calls `stop()`.
- **`refreshThenPost(reason)`:** `visit(reason)`, raced against 8 s, then rates, then `postDueRecurring`. `recordCompletedWeeks` runs only when the visit's sync resolved `'synced'` or `'unlinked'`, and it waits for a slow sync past the cap.
- **The reasons:** start `'open'`, visible `'return'`, focus `'focus'`, midnight `'midnight'`.
- An unlinked phone resolves at once, so its timing is unchanged.

### Edge cases (handled as above)
- **Multi-tab:** skip when the lock is busy. Every tab's `liveQuery` sees the writes, and hidden tabs never poll.
- **Hidden pages:** the runner lives in AppInit only.
- **Second step turned on elsewhere:** a refused write leads to `askForCodeIfRefused`. A pull returns nothing at aal1, as with Sync now today.
- **Account deleted elsewhere:** writes fail (backoff), then the token refresh fails and `SIGNED_OUT` stops the runner.
- **Linking holds the lock:** automatic runs skip. Once `syncState.userId` appears, the next run is 60 s out.
- **A backgrounded PWA:** its timers freeze, and the return fires `visibilitychange`. There is no background sync.
- **Requests while visible:** at most one `sync_pull` a minute, plus one per return and one per edit burst.
- **Requests while failing:** about 5 tries in the first 30 minutes, then 4 an hour.

## Chunks (about 1 h each, a draft PR each, CI on Roshan's OK)

| # | Work | Tests | CI |
|---|---|---|---|
| 1 | This plan into `docs/superpowers/plans/2026-11-10-automatic-sync.md`; `withSyncLockIfFree`, `syncIfFree`, `onSyncDone`, and the identity-checked clears | `lock.test` (free, held); `engine.test` (busy when held, joins an in-tab run, no deadlock with a Sync now during the lock request) | changed: every spec, since `lock.ts` already reaches the root layout; none should change |
| 2 | `auto-schedule.ts` | table tests: every event and outcome, the backoff, the no-loop rules | quick + db |
| 3 | `auto-runner.ts` and `auto-sync.ts`, not mounted, with `askForCodeIfRefused` extracted but `sync-status.tsx` untouched | fake timers and fake-indexeddb; the coalescing, the visit results, the pause | quick + db |
| 4 | Mount it in AppInit (the triggers); the sign-out pause; `SyncSection` uses `askForCodeIfRefused`; `e2e/helpers/sync-lock.ts` (`holdSyncLock`: a second page holds the real lock); the three spec fixes (below); the sync section's line in four languages ("This phone syncs by itself while it's open"); CLAUDE.md's sync rules | the fixed specs; unit tests for the new wiring | changed: every spec, in four shards |
| 5 | Start order and week gate: visit reasons, the 8 s cap, weeks only after a successful sync | unit tests of the gate; AppInit's order | changed: every spec |
| 6 | `e2e/auto-sync.spec.ts`, `mockSupabaseData`'s `pulls` log, and writes refused after `delete_my_account`; the affected-map entry | the new spec (below) | changed: every spec importing the helper |

### Specs that need fixing in chunk 4
- **`linking.spec.ts:300–323`** ("1 change waiting" after a rename): hold the lock with `holdSyncLock` before the rename, and release it before tapping Sync now.
- **`start.spec.ts:167–202`** (rename, then offline sign-out): install the aborting `SUPABASE_REST` route before the rename.
- **`two-step.spec.ts:314–348`** (a profile change queued before the 403 route): `holdSyncLock` before the change, then the route, release, and tap Sync now.

### The new spec, `e2e/auto-sync.spec.ts` (`page.clock` for every wait)
- A change reaches the account after 5 s with no tap. The other page gets it on return and within 60 s.
- Opening the app pulls.
- A change made offline is sent on `online`.
- With the lock held there is no pull; after release, the next trigger sends the change.
- Backoff on a 500: tries at 1, 2, 4 and 8 minutes and none between; a success resets it.
- A 401 stops the runs; signing in again resumes them.
- A 403 with a second step turned on elsewhere shows the code step, with no tap.
- **Week gate:** the account's `week_results` row for a due week wins, and with REST hanging no week is recorded while recurring entries still post.

## CLAUDE.md, rewritten in chunk 4 and finished in chunk 5
- **Linking and sync:** "Nothing runs on a timer" becomes the triggers, the backoff, skip-when-busy, the stops, and the start order with its week gate.
- **What P2.1 and P2.2 leave out:** drop "No automatic sync"; realtime and background sync stay out.
- **Outgoing requests:** "each sync" now names the automatic triggers.
- **Code comments that say tap-only:**
  - `sync-status.tsx:15-16`;
  - `engine.ts:29-30`;
  - `account-link.tsx:93`;
  - `linking.spec.ts:17-18`.

## Verification
- **Each chunk:** lint, typecheck and the touched unit tests locally, with no heavy lane.
- **CI on Roshan's OK:** chunks 1, 4, 5 and 6 run every spec.
- **The real try on two phones on the live site:**
  - an entry on phone A shows on phone B within a minute, without a tap;
  - airplane mode, then back online, and the change is sent;
  - a sign-out with a change waiting;
  - Sunday's week recorded the same on both phones;
  - the Supabase request count stays at about one a minute per open phone.

## As built

- **Chunk 1** (`src/sync/lock.ts`, `src/sync/engine.ts`):
  - **`withSyncLockIfFree(task)`** asks for the lock with `ifAvailable` and gives `BUSY` (a unique symbol) when another tab holds it. It never waits, and without Web Locks it just runs.
  - **`syncIfFree(store, userId)`** returns an `AutoSyncResult`: a `SyncResult` or `{ kind: 'busy' }`.
    - It joins this tab's `running` sync first.
    - Inside the lock callback it never calls `syncNow` or awaits `running`. If a Sync now set `running` meanwhile, the automatic sync still runs and announces itself, and the Sync now runs after it.
  - **`onSyncDone(listener)`** hears every finished sync of the tab, whoever started it, and returns the way to stop listening.
  - **`track(run)`** sets `running` and clears it only if it still holds its own promise.
  - **Two test facts:**
    - Node grants a free Web Lock at once, where a browser grants it on a later task. So `engine.test.ts` plays a browser's lock (`browserLocks`) for the Sync-now-during-the-request case.
    - Releasing a real lock takes a tick, so the test's `release` waits for the holder's request to end.

- **Chunk 2** (`src/sync/auto-schedule.ts`, pure, 18 table tests):
  - **`step(state, event, now)`** returns `{ state, run, wakeAt }`. When `run` is true the state counts the sync as running until its `finished`, so the plan's `started` event isn't needed.
  - **The events:**
    - the triggers and the page: `trigger` (opening or a return), `visible`, `hidden`, `online`, `offline`, `tick`;
    - the data: `outbox{count, newest}`, `auth{status, userId}`, `link{userId}`;
    - the runs and sign-out: `finished{outcome, outbox, held}`, `pause`, `resume`.
  - **`SyncOutcome`:** `synced`, `held`, `failed`, `offline`, `busy`, `signed-out`, `update-needed`, `second-step`, `not-linked`. The runner maps a sync's result onto it.
  - **What a run waits for:**
    - It may run only signed in, linked to that account, online, not paused and not stopped.
    - It is due at the earliest of: a trigger (now), a change (3 s after the latest, at most 5 s after the first, or at once while hidden), and the interval while visible (60 s after the last end).
    - It is never sooner than 5 s after the last start, nor before the backoff ends.
  - **No loops:**
    - The outbox is judged at a sync's end. The held rows are the baseline, and only more than them is a change.
    - An outbox back at the baseline clears a waiting change; one that shrank below it (another tab sent them) becomes the new baseline.
    - A failure or `busy` keeps an unsent change waiting.
  - **Reconnecting** skips each failure's wait once.
  - **Stops:** a stop clears on a change of session or link; `update-needed` only on a reload.
  - **A new link** clears a trigger left from the sign-in, since linking syncs itself, and counts the interval from the link.

- **Chunk 3** (`src/sync/auto-runner.ts`; `src/features/account/auto-sync.ts`, not mounted yet):
  - **`createAutoRunner({ now, setTimer, clearTimer, run })`** feeds events to the schedule, keeps one timer, and starts the runs it asks for.
    - **`visit(reason)`** answers `'synced' | 'unlinked' | 'not-synced'`.
      - It waits until the session and the link are both known, so a visit at start never reads as unlinked before the link has been read.
      - It waits for a run in flight, or one held back only by the minimum gap. It doesn't wait for one held back by a failure's wait, or one that may not run.
      - `'focus'` syncs only if the visit has no success and nothing is in flight. `'midnight'` only reads how the visit stands.
    - **`heard(done)`** takes a sync the runner didn't start (Sync now, setup's Save): it counts for the visit and resets the backoff.
    - **`stop()`** lets every waiting visit go as `'not-synced'`.
    - A run that throws counts as `failed`.
  - **`outcomeOf` and `heldOf`** map a sync's result to the schedule's outcome.
  - **`runOnce`** (testable, its session and store passed in):
    - Signed out or owing the code, it runs nothing.
    - Otherwise it calls `syncIfFree`.
    - On the first failure in a row only, it calls `accountWantsCode` (one refresh, not one a minute). A refusal that turns out to be the code owed is `second-step`.
    - The plan's `askForCodeIfRefused` turned out to be `accountWantsCode` as it is, so nothing was extracted.
  - **`startAutoSync()`** wires the runner, one per tab, to:
    - `visibilitychange`, `online` and `offline`;
    - `liveQuery` on the outbox (`outboxShape`) and on `syncState` (the link);
    - `onAuthStateChange` (state only);
    - `onSyncDone` (other syncs).

    Query errors after the sign-out wipe are ignored. `visitAutoSync`, `pauseAutoSync` and `resumeAutoSync` are for AppInit and sign-out.
  - **Left out:** another tab's `lastSyncedAt` doesn't push this tab's interval back. Two visible tabs each poll once a minute, and `busy` keeps them apart.

- **Chunk 4** (mounted):
  - **AppInit:**
    - `startAutoSync()` starts after `data-app-ready` and stops on cleanup.
    - `visitAutoSync('open')` runs at start, `'return'` on `visibilitychange` (visible), and `'focus'` on focus.
    - The visits don't hold `refreshThenPost` back yet; that is chunk 5.
  - **Sign-out** (`account-view.tsx`): an effect on its step pauses automatic runs at `unsynced` (the question) and `leaving`, and resumes on any other step: Stay signed in, a failure, or leaving the page.
  - **The sync section** says "This phone syncs by itself while the app is open. Sync now syncs straight away.", in the four languages.
  - **`holdSyncLock(context)`** (`e2e/helpers/sync-lock.ts`) holds the real lock from a second page on `/manifest.webmanifest`. The three specs:
    - `linking.spec` (the offline Sync now): holds from before the rename, and releases before the tap.
    - `start.spec` (sign-out with an unsent change): installs its aborting route before the rename, so the automatic runs fail too.
    - `two-step.spec` (the code asked on Sync now): holds from before the change, and taps Sync now while held, so the tap queues in the lock and runs first once released.
  - **CLAUDE.md:** the sync rules, the outgoing requests and "What P2.1 and P2.2 leave out" now describe automatic sync.

- **Chunk 5** (start order and week gate):
  - **`inStartOrder(visit, steps, clock)`** (`src/features/account/start-order.ts`) races the visit's sync against `SYNC_FIRST_CAP` (8 s), then refreshes the rates and posts what is due, then awaits the sync with no cap and records the weeks only for `synced` or `unlinked` (`weeksMayRecord`). A visit that throws counts as not synced. 6 tests on fake timers.
  - **AppInit:** `refreshThenPost(reason)` runs it for every visit: `'open'` at start (after `startAutoSync`), `'return'` on becoming visible, `'focus'` on focus and `'midnight'` at midnight. The separate `visitAutoSync` calls of chunk 4 are gone.
  - **Not changed:** without the Supabase settings, or on an unlinked phone, `visitAutoSync` resolves `unlinked` at once, so the order and timing are as before.
  - **Chunk 4's CI fix** (on #183): `linkPhone` answers a phone already linked to the account without the sync lock (`linkedAlready`), since it has nothing to write. Before, the account page stayed on "Checking…" while another tab held the lock, and the linking and two-step specs failed on it.
  - **Known limit:** a linked phone that is signed out (an ended session keeps the link) records no week until it signs in and syncs; the weeks are caught up then, since recording takes every week that is over.

- **Chunk 6** (`e2e/auto-sync.spec.ts`, in the map under `/settings/account` and `/settings/profile`), four tests with no tap on Sync now:
  - a change reaches the account within 15 s (the schedule's own delays: 3 s, at most 5 s, starts 5 s apart);
  - opening the app on a second phone pulls it;
  - a change made offline waits ("Offline: 1 change waits on this phone.") and is sent on reconnecting;
  - on `page.clock` (installed, so time runs as usual until `fastForward`), one sync a minute; after a failure no try at 30 s and one by 70 s, and the next success says "Synced just now."
  - **Left out of the planned spec** (covered by the unit tests of the schedule, the runner, `runOnce` and `inStartOrder`; worth an e2e if one breaks in the real try):
    - the full backoff (2, 4, 8, 15 minutes);
    - a 401 stopping the runs;
    - a second step turned on elsewhere showing the code step;
    - the week gate.
  - **Mock changes:** none were needed (the planned `pulls` log and refusal after `delete_my_account`). The backoff test counts calls with its own route.

## Appendix: other work left (for later)
- **Features:**
  - legal pages (privacy notice, Impressum) with security headers;
  - the dated data refresh: Deutschlandticket €66.80 from 1 Jan 2027, the 17 discounts before 15 Dec 2026, the 2027 semester-ticket surcharge;
  - small wins: the Second-Hand Saver badge, number words in German, French and Spanish, maskable icons, a backup size cap;
  - plan history;
  - a benefits checklist;
  - CSV bulk re-categorise and trip grouping;
  - community features: discounts added from the app, community badges, hack comments;
  - the verified-student badge, which needs the email sender;
  - a discount map;
  - invite-only sign-up;
  - setup extras;
  - MCP write tools or a remote server;
  - more cities.
- **Roshan's steps:**
  - the AI go-live (paused, #179);
  - the weekly reminder go-live;
  - the email sender and a domain;
  - the CSV real try and a `languages=all` CI run;
  - the live two-device sync check;
  - the postponed phone tries;
  - native-speaker reads.
