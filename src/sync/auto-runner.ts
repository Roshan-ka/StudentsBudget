import type { AutoSyncResult } from './engine';
import { initialSchedule, MIN_GAP, step, type OutboxShape, type ScheduleEvent, type ScheduleState, type SyncOutcome } from './auto-schedule';

// The automatic sync's runner (automatic sync, chunk 3, docs/superpowers/plans/2026-11-10-automatic-sync.md): it feeds
// events to the pure schedule (auto-schedule.ts), keeps its one timer, starts the syncs it asks for, and answers the
// app's visits ("did this visit sync?", which the start order and the week gate wait on). Timers and the sync itself
// are passed in, so the tests run it on fake timers; auto-sync.ts wires it to the browser.

/** What a sync left: how it ended for the schedule, the outbox after it, and the rows held back. */
export type RunDone = { outcome: SyncOutcome; outbox: OutboxShape; held: number };

/** Why the app asks: the app opened, came back, got focus, or a new day began. */
export type VisitReason = 'open' | 'return' | 'focus' | 'midnight';

/** How this visit stands: a sync succeeded, the phone isn't linked (nothing to wait for), or no sync succeeded. */
export type VisitResult = 'synced' | 'unlinked' | 'not-synced';

export type RunnerDeps = {
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  run: () => Promise<RunDone>;
  initial?: ScheduleState;
};

export type AutoRunner = {
  dispatch: (event: ScheduleEvent) => void;
  visit: (reason: VisitReason) => Promise<VisitResult>;
  /** A sync the runner didn't start (Sync now, setup's Save), which counts for the visit and the backoff. */
  heard: (done: RunDone) => void;
  stop: () => void;
};

/** A sync's result as the schedule needs it. */
export function outcomeOf(result: AutoSyncResult): SyncOutcome {
  switch (result.kind) {
    case 'synced':
    case 'offline':
    case 'busy':
    case 'not-linked':
      return result.kind;
    case 'problem': {
      const { problem } = result;
      if (problem === 'failed' || problem === 'signed-out' || problem === 'update-needed') return problem;
      // Synced, with rows held back (`held:N`).
      return 'held';
    }
  }
}

/** The rows a sync held back (`held:N`), else 0. */
export function heldOf(result: AutoSyncResult): number {
  if (result.kind !== 'problem' || !result.problem.startsWith('held:')) return 0;
  return Number(result.problem.slice('held:'.length)) || 0;
}

const succeeded = (outcome: SyncOutcome) => outcome === 'synced' || outcome === 'held';

export function createAutoRunner(deps: RunnerDeps): AutoRunner {
  let state = deps.initial ?? initialSchedule();
  // The time the schedule sees: never earlier than before, and at least a timer's due time once that timer fires. A
  // clock that stands still (a page whose Date is fixed, as the e2e specs' is) or goes back (the phone's clock set
  // back) would otherwise find the due run still ahead each time its timer fires, and wait for ever.
  let clock = -Infinity;
  const now = () => (clock = Math.max(clock, deps.now()));
  let timer: unknown = null;
  let running = false;
  let stopped = false;
  // Whether the session and the link are known yet: a visit can't say "unlinked" before the link has been read.
  let authKnown = false;
  let linkKnown = false;
  // This visit (since the app opened or came back) had a sync that succeeded.
  let visitSynced = false;
  // Visits waiting for the run in flight, or the next one, to end; and those waiting to know the session and link.
  let afterRun: ((result: VisitResult) => void)[] = [];
  let untilKnown: (() => void)[] = [];

  const unlinked = () => state.linkedTo === null;
  const visitResult = (): VisitResult => (visitSynced ? 'synced' : unlinked() ? 'unlinked' : 'not-synced');

  function settle(done: RunDone) {
    if (succeeded(done.outcome)) visitSynced = true;
    const waiting = afterRun;
    afterRun = [];
    for (const resolve of waiting) resolve(visitResult());
  }

  function arm(wakeAt: number | null) {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
    if (wakeAt === null || stopped) return;
    timer = deps.setTimer(
      () => {
        timer = null;
        clock = Math.max(clock, wakeAt);
        dispatch({ type: 'tick' });
      },
      Math.max(0, wakeAt - now()),
    );
  }

  function start() {
    running = true;
    void (async () => {
      let done: RunDone;
      try {
        done = await deps.run();
      } catch {
        done = { outcome: 'failed', outbox: state.outbox, held: state.baseline.count };
      }
      running = false;
      if (stopped) return;
      settle(done);
      dispatch({ type: 'finished', ...done });
    })();
  }

  function dispatch(event: ScheduleEvent) {
    if (stopped) return;
    if (event.type === 'auth' && event.status !== 'loading') authKnown = true;
    if (event.type === 'link') linkKnown = true;
    const next = step(state, event, now());
    state = next.state;
    arm(next.wakeAt);
    if (next.run) start();
    if (authKnown && linkKnown && untilKnown.length > 0) {
      const waiting = untilKnown;
      untilKnown = [];
      for (const resolve of waiting) resolve();
    }
  }

  /** Resolves once the run in flight, or one due within the minimum gap, has ended; else at once. */
  function nextRunResult(): Promise<VisitResult> {
    if (running) return new Promise((resolve) => afterRun.push(resolve));
    // A trigger held back by the minimum gap is worth waiting for (at most MIN_GAP); one held back by a failure's wait,
    // or one that may not run at all (offline, signed out, paused), is not.
    const backingOff = state.retryAt !== null && state.retryAt > now() + MIN_GAP;
    if (state.wanted && timer !== null && !backingOff) return new Promise((resolve) => afterRun.push(resolve));
    return Promise.resolve(visitResult());
  }

  async function visit(reason: VisitReason): Promise<VisitResult> {
    if (stopped) return 'not-synced';
    if (!(authKnown && linkKnown)) await new Promise<void>((resolve) => untilKnown.push(resolve));
    if (stopped) return 'not-synced';
    if (reason === 'open' || reason === 'return') {
      visitSynced = false;
      if (unlinked()) return 'unlinked';
      dispatch({ type: 'trigger' });
      return nextRunResult();
    }
    if (reason === 'focus' && !visitSynced && !running && !unlinked()) {
      dispatch({ type: 'trigger' });
      return nextRunResult();
    }
    // A new day, or focus after this visit already synced: only how the visit stands.
    return running ? nextRunResult() : visitResult();
  }

  function heard(done: RunDone) {
    if (stopped || running) return;
    settle(done);
    dispatch({ type: 'finished', ...done });
  }

  function stop() {
    stopped = true;
    arm(null);
    const waiting = afterRun;
    afterRun = [];
    for (const resolve of waiting) resolve('not-synced');
    const known = untilKnown;
    untilKnown = [];
    for (const resolve of known) resolve();
  }

  return { dispatch, visit, heard, stop };
}
