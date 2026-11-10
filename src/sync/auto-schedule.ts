// When a linked phone syncs by itself (automatic sync, chunk 2, docs/superpowers/plans/2026-11-10-automatic-sync.md):
// a pure state machine, `step(state, event, now)`, which says whether to sync now and when to look again. No timers
// and no browser here: the runner (chunk 3) feeds it the page's, the outbox's, the session's and the link's events and
// each sync's outcome, and keeps one timer for `wakeAt`.
//
// It syncs only while signed in (the code given, where the account wants one), linked to that account, online, not
// paused (sign-out's question) and not stopped by a problem the person must solve. Then:
// - a trigger (opening the app, a return to it, reconnecting) syncs as soon as the minimum gap allows;
// - a change (the outbox grew past what the last sync left) syncs CHANGE_DELAY after the latest one, and at most
//   CHANGE_MAX after the first, so typing doesn't put it off for ever; while hidden, at once;
// - while visible, it syncs every INTERVAL after the last sync ended, to bring in the other phones' changes;
// - after a failure it waits BACKOFF before trying again, whatever asks; reconnecting skips that wait once.
// A run in flight absorbs every trigger; what changed meanwhile is judged when it ends.

export const CHANGE_DELAY = 3_000;
export const CHANGE_MAX = 5_000;
export const INTERVAL = 60_000;
export const MIN_GAP = 5_000;
/** The waits after the 1st, 2nd, 3rd, 4th and every later failure in a row: 1, 2, 4, 8, then 15 minutes. */
export const BACKOFF = [60_000, 120_000, 240_000, 480_000, 900_000] as const;

/** How a sync ended, as the schedule needs it (the runner maps a `SyncResult` and `busy` to it). */
export type SyncOutcome =
  | 'synced'
  | 'held'
  | 'failed'
  | 'offline'
  | 'busy'
  | 'signed-out'
  | 'update-needed'
  | 'second-step'
  | 'not-linked';

/** The outbox as the runner reads it: how many rows wait, and the newest `seq`. */
export type OutboxShape = { count: number; newest: number };

export type ScheduleEvent =
  | { type: 'trigger' }
  | { type: 'visible' }
  | { type: 'hidden' }
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'outbox'; outbox: OutboxShape }
  | { type: 'auth'; status: 'signed-in' | 'second-step' | 'signed-out' | 'loading' | 'off'; userId: string | null }
  | { type: 'link'; userId: string | null }
  | { type: 'finished'; outcome: SyncOutcome; outbox: OutboxShape; held: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick' };

/** The problems that stop automatic runs until the session or the link changes (`update-needed`: until a reload). */
type Stop = Extract<SyncOutcome, 'signed-out' | 'update-needed' | 'second-step' | 'not-linked'>;

export type ScheduleState = {
  visible: boolean;
  online: boolean;
  auth: Extract<ScheduleEvent, { type: 'auth' }>['status'];
  userId: string | null;
  linkedTo: string | null;
  paused: boolean;
  running: boolean;
  stop: Stop | null;
  /** A trigger is waiting to run. */
  wanted: boolean;
  failures: number;
  /** No run before this, after a failure. */
  retryAt: number | null;
  /** Reconnecting has skipped this failure's wait already. */
  skipped: boolean;
  lastStartAt: number | null;
  lastEndAt: number | null;
  /** What the outbox held when the last sync ended: the held-back rows, which never count as a change. */
  baseline: OutboxShape;
  outbox: OutboxShape;
  /** When the first and the latest unsent change were seen, while one waits. */
  changeSince: number | null;
  changeAt: number | null;
};

export type Step = { state: ScheduleState; run: boolean; wakeAt: number | null };

export function initialSchedule(visible = true, online = true): ScheduleState {
  return {
    visible,
    online,
    auth: 'loading',
    userId: null,
    linkedTo: null,
    paused: false,
    running: false,
    stop: null,
    wanted: false,
    failures: 0,
    retryAt: null,
    skipped: false,
    lastStartAt: null,
    lastEndAt: null,
    baseline: { count: 0, newest: 0 },
    outbox: { count: 0, newest: 0 },
    changeSince: null,
    changeAt: null,
  };
}

const grew = (outbox: OutboxShape, baseline: OutboxShape) =>
  outbox.count > baseline.count || outbox.newest > baseline.newest;

function withChange(state: ScheduleState, now: number): ScheduleState {
  return { ...state, changeSince: state.changeSince ?? now, changeAt: now };
}

function apply(state: ScheduleState, event: ScheduleEvent, now: number): ScheduleState {
  switch (event.type) {
    case 'trigger':
      return { ...state, wanted: true };
    case 'visible':
      return { ...state, visible: true };
    case 'hidden':
      return { ...state, visible: false };
    case 'online': {
      // Back online: try now, and skip a failure's wait once (the network was likely why it failed).
      const skip = state.failures > 0 && !state.skipped;
      return { ...state, online: true, wanted: true, ...(skip && { retryAt: now, skipped: true }) };
    }
    case 'offline':
      return { ...state, online: false };
    case 'outbox': {
      const next = { ...state, outbox: event.outbox };
      // During a run the sync changes the outbox itself: judged when it ends.
      if (state.running) return next;
      // Fewer than the last sync left (another tab sent them): that is the new baseline.
      const baseline = event.outbox.count < state.baseline.count ? event.outbox : state.baseline;
      // Back to what the last sync left: nothing waits any more.
      if (!grew(event.outbox, baseline)) return { ...next, baseline, changeSince: null, changeAt: null };
      return withChange({ ...next, baseline }, now);
    }
    case 'auth': {
      const changed = event.status !== state.auth || event.userId !== state.userId;
      const stop = changed && state.stop !== 'update-needed' ? null : state.stop;
      // Signed in again, or the code given: sync now.
      const wanted = state.wanted || (changed && event.status === 'signed-in');
      return { ...state, auth: event.status, userId: event.userId, stop, wanted };
    }
    case 'link': {
      if (event.userId === state.linkedTo) return state;
      // Newly linked: linking syncs once itself, so a trigger waiting from the sign-in is done, and the next
      // automatic run is an interval away.
      const stop = state.stop === 'not-linked' ? null : state.stop;
      return { ...state, linkedTo: event.userId, stop, wanted: false, failures: 0, retryAt: null, lastEndAt: now };
    }
    case 'finished': {
      const ended = { ...state, running: false, lastEndAt: now, outbox: event.outbox };
      switch (event.outcome) {
        case 'synced':
        case 'held': {
          // The held rows stay in the outbox for good: they are the baseline. Anything more arrived meanwhile.
          const settled: ScheduleState = {
            ...ended,
            failures: 0,
            retryAt: null,
            skipped: false,
            baseline: { count: event.held, newest: event.outbox.newest },
            changeSince: null,
            changeAt: null,
          };
          return event.outbox.count > event.held ? withChange(settled, now) : settled;
        }
        case 'failed': {
          const failures = state.failures + 1;
          const wait = BACKOFF[Math.min(failures, BACKOFF.length) - 1];
          const failed = { ...ended, failures, retryAt: now + wait, skipped: false };
          // Unsent changes still wait, behind the backoff.
          return grew(event.outbox, state.baseline) ? withChange(failed, now) : failed;
        }
        case 'offline':
          return { ...ended, online: false };
        case 'busy':
          // Another tab syncs, and sends this phone's changes too; its end shows in the outbox. Until then they wait.
          return grew(event.outbox, state.baseline) ? withChange(ended, now) : ended;
        default:
          return { ...ended, stop: event.outcome };
      }
    }
    case 'pause':
      return { ...state, paused: true };
    case 'resume':
      return { ...state, paused: false };
    case 'tick':
      return state;
  }
}

/** When the next run is due, or null when nothing asks for one or it may not run. */
function dueAt(state: ScheduleState, now: number): number | null {
  const may =
    state.auth === 'signed-in' &&
    state.userId !== null &&
    state.linkedTo === state.userId &&
    state.online &&
    !state.paused &&
    !state.running &&
    state.stop === null;
  if (!may) return null;

  const reasons: number[] = [];
  if (state.wanted) reasons.push(now);
  if (state.changeSince !== null && state.changeAt !== null) {
    // Hidden: send it now, as the phone may be put away.
    reasons.push(state.visible ? Math.min(state.changeAt + CHANGE_DELAY, state.changeSince + CHANGE_MAX) : now);
  }
  if (state.visible) reasons.push(state.lastEndAt === null ? now : state.lastEndAt + INTERVAL);
  if (reasons.length === 0) return null;

  return Math.max(Math.min(...reasons), (state.lastStartAt ?? -Infinity) + MIN_GAP, state.retryAt ?? -Infinity);
}

/**
 * Takes one event: the new state, whether to start a sync now (the state then counts it as running, until its
 * `finished`), and when to call again with `tick` (null: nothing to wait for).
 */
export function step(state: ScheduleState, event: ScheduleEvent, now: number): Step {
  const next = apply(state, event, now);
  const due = dueAt(next, now);
  if (due === null) return { state: next, run: false, wakeAt: null };
  if (due > now) return { state: next, run: false, wakeAt: due };
  const started: ScheduleState = { ...next, running: true, wanted: false, lastStartAt: now, changeSince: null, changeAt: null };
  return { state: started, run: true, wakeAt: null };
}
