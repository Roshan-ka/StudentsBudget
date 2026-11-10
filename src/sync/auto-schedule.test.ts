import { describe, expect, it } from 'vitest';
import {
  BACKOFF,
  CHANGE_DELAY,
  CHANGE_MAX,
  INTERVAL,
  MIN_GAP,
  initialSchedule,
  step,
  type ScheduleEvent,
  type ScheduleState,
  type Step,
} from './auto-schedule';

// When a linked phone syncs by itself (automatic sync, chunk 2): the schedule, event by event, with no timers.

const USER = 'user-1';
const EMPTY = { count: 0, newest: 0 };

/** Plays events at given times from a state; returns the last step and every time a run started. */
function play(from: ScheduleState, events: [number, ScheduleEvent][]): { last: Step; runs: number[] } {
  let state = from;
  let last: Step = { state, run: false, wakeAt: null };
  const runs: number[] = [];
  for (const [now, event] of events) {
    last = step(state, event, now);
    state = last.state;
    if (last.run) runs.push(now);
  }
  return { last, runs };
}

/** Signed in and linked, with the first run done and ended at `at`. */
function ready(at = 0): ScheduleState {
  const { last } = play(initialSchedule(), [
    [at, { type: 'auth', status: 'signed-in', userId: USER }],
    [at, { type: 'link', userId: USER }],
  ]);
  return last.state;
}

const finished = (outcome: Extract<ScheduleEvent, { type: 'finished' }>['outcome'], outbox = EMPTY, held = 0) =>
  ({ type: 'finished', outcome, outbox, held }) as const;

describe('when it may sync at all', () => {
  it('never runs signed out, owing the code, unlinked, linked to another account, offline or paused', () => {
    const cases: ScheduleEvent[][] = [
      [{ type: 'auth', status: 'signed-out', userId: null }, { type: 'link', userId: USER }],
      [{ type: 'auth', status: 'second-step', userId: USER }, { type: 'link', userId: USER }],
      [{ type: 'auth', status: 'signed-in', userId: USER }],
      [{ type: 'auth', status: 'signed-in', userId: USER }, { type: 'link', userId: 'someone-else' }],
    ];
    for (const events of cases) {
      const all: ScheduleEvent[] = [...events, { type: 'trigger' }];
      const { runs, last } = play(initialSchedule(), all.map((e): [number, ScheduleEvent] => [0, e]));
      expect(runs).toEqual([]);
      expect(last.wakeAt).toBeNull();
    }
    expect(play(ready(), [[1, { type: 'offline' }], [2, { type: 'trigger' }]]).runs).toEqual([]);
    expect(play(ready(), [[1, { type: 'pause' }], [2, { type: 'trigger' }]]).runs).toEqual([]);
    expect(play(ready(), [[1, { type: 'pause' }], [MIN_GAP, { type: 'resume' }]]).runs).toEqual([]);
  });
});

describe('the triggers', () => {
  it('syncs on opening and returning, but leaves at least MIN_GAP between starts', () => {
    const { runs, last } = play(ready(), [
      [10_000, { type: 'trigger' }],
      [10_500, finished('synced')],
      [11_000, { type: 'trigger' }],
    ]);
    expect(runs).toEqual([10_000]);
    expect(last.wakeAt).toBe(10_000 + MIN_GAP);
  });

  it('syncs every INTERVAL while visible, and stops while hidden', () => {
    const start = ready(0);
    const { runs, last } = play(start, [
      [INTERVAL, { type: 'tick' }],
      [INTERVAL + 400, finished('synced')],
    ]);
    expect(runs).toEqual([INTERVAL]);
    expect(last.wakeAt).toBe(2 * INTERVAL + 400);
    expect(play(last.state, [[INTERVAL + 500, { type: 'hidden' }]]).last.wakeAt).toBeNull();
  });

  it('syncs CHANGE_DELAY after the latest change, but at most CHANGE_MAX after the first', () => {
    let s = ready(0);
    const at = (now: number, count: number) => [now, { type: 'outbox', outbox: { count, newest: now } }] as [number, ScheduleEvent];
    const first = play(s, [at(20_000, 1)]);
    expect(first.last.wakeAt).toBe(20_000 + CHANGE_DELAY);
    s = first.last.state;
    // Typing on: each change puts it off, never past CHANGE_MAX.
    const typing = play(s, [at(22_000, 2), at(24_000, 3)]);
    expect(typing.last.wakeAt).toBe(20_000 + CHANGE_MAX);
    expect(play(typing.last.state, [[20_000 + CHANGE_MAX, { type: 'tick' }]]).runs).toEqual([20_000 + CHANGE_MAX]);
  });

  it('sends a waiting change at once when the app is hidden', () => {
    const { runs } = play(ready(0), [
      [20_000, { type: 'outbox', outbox: { count: 1, newest: 1 } }],
      [21_000, { type: 'hidden' }],
    ]);
    expect(runs).toEqual([21_000]);
  });

  it('syncs on reconnecting', () => {
    expect(play(ready(), [[1, { type: 'offline' }], [30_000, { type: 'online' }]]).runs).toEqual([30_000]);
  });
});

describe('no loops', () => {
  it('ignores what a sync does to the outbox while it runs, and judges it when the sync ends', () => {
    const running = play(ready(0), [[10_000, { type: 'trigger' }]]).last.state;
    const { runs, last } = play(running, [
      [10_100, { type: 'outbox', outbox: { count: 2, newest: 5 } }],
      [10_200, { type: 'outbox', outbox: { count: 0, newest: 5 } }],
      [10_300, finished('synced', { count: 0, newest: 5 })],
    ]);
    expect(runs).toEqual([]);
    expect(last.wakeAt).toBe(10_300 + INTERVAL);
  });

  it('never counts held-back rows as a change, but a change beside them still goes', () => {
    const afterHeld = play(ready(0), [
      [10_000, { type: 'trigger' }],
      [10_300, finished('held', { count: 2, newest: 5 }, 2)],
      [10_400, { type: 'outbox', outbox: { count: 2, newest: 5 } }],
    ]).last;
    expect(afterHeld.wakeAt).toBe(10_300 + INTERVAL);
    expect(play(afterHeld.state, [[20_000, { type: 'outbox', outbox: { count: 3, newest: 9 } }]]).last.wakeAt).toBe(
      20_000 + CHANGE_DELAY,
    );
  });

  it('runs again soon when a change came in while a sync ran', () => {
    const { last } = play(ready(0), [
      [10_000, { type: 'trigger' }],
      [10_300, finished('synced', { count: 1, newest: 7 })],
    ]);
    expect(last.wakeAt).toBe(10_000 + MIN_GAP);
  });

  it('takes another tab’s sync as its own: fewer rows waiting is the new baseline', () => {
    const waiting = play(ready(0), [[20_000, { type: 'outbox', outbox: { count: 1, newest: 1 } }]]).last.state;
    const { last } = play(waiting, [[21_000, { type: 'outbox', outbox: EMPTY }]]);
    expect(last.wakeAt).toBe(INTERVAL);
  });
});

describe('outcomes', () => {
  it('backs off 1, 2, 4, 8, then 15 minutes after failures, and a success resets it', () => {
    let s = ready(0);
    let now = 10_000;
    const waits: number[] = [];
    s = play(s, [[now, { type: 'trigger' }]]).last.state;
    for (let failure = 0; failure < 6; failure += 1) {
      const after = step(s, finished('failed'), now);
      waits.push((after.wakeAt ?? 0) - now);
      now = after.wakeAt ?? now;
      const retried = step(after.state, { type: 'tick' }, now);
      expect(retried.run).toBe(true);
      s = retried.state;
    }
    expect(waits).toEqual([...BACKOFF, BACKOFF[4]]);
    const recovered = step(s, finished('synced'), now);
    expect(recovered.wakeAt).toBe(now + INTERVAL);
    expect(recovered.state.failures).toBe(0);
  });

  it('lets no trigger past the backoff, except reconnecting, which skips each failure’s wait once', () => {
    const failed = play(ready(0), [[10_000, { type: 'trigger' }], [10_100, finished('failed')]]).last.state;
    expect(play(failed, [[20_000, { type: 'trigger' }]]).runs).toEqual([]);
    const reconnected = play(failed, [[10_200, { type: 'offline' }], [20_000, { type: 'online' }]]);
    expect(reconnected.runs).toEqual([20_000]);
    // That retry failed too: the second failure waits 2 minutes, and a trigger still doesn't pass.
    const again = play(reconnected.last.state, [[20_100, finished('failed')], [30_000, { type: 'trigger' }]]);
    expect(again.runs).toEqual([]);
    expect(again.last.wakeAt).toBe(20_100 + BACKOFF[1]);
    // The skip was this failure's own: reconnecting skips its wait once again.
    expect(play(again.last.state, [[30_100, { type: 'offline' }], [40_000, { type: 'online' }]]).runs).toEqual([40_000]);
  });

  it('keeps an unsent change waiting through a failure, behind the backoff, even while hidden', () => {
    const { last } = play(ready(0), [
      [10_000, { type: 'trigger' }],
      [10_100, finished('failed', { count: 1, newest: 3 })],
      [10_200, { type: 'hidden' }],
    ]);
    expect(last.wakeAt).toBe(10_100 + BACKOFF[0]);
  });

  it('waits for reconnecting after an offline outcome, without backing off', () => {
    const { last } = play(ready(0), [[10_000, { type: 'trigger' }], [10_100, finished('offline')]]);
    expect(last.wakeAt).toBeNull();
    expect(last.state.failures).toBe(0);
    expect(play(last.state, [[30_000, { type: 'online' }]]).runs).toEqual([30_000]);
  });

  it('skips while another tab syncs, without backing off', () => {
    const { last } = play(ready(0), [[10_000, { type: 'trigger' }], [10_050, finished('busy')]]);
    expect(last.state.failures).toBe(0);
    expect(last.wakeAt).toBe(10_050 + INTERVAL);
  });

  it('stops on a problem the person must solve, until the session or the link changes', () => {
    for (const outcome of ['signed-out', 'second-step', 'not-linked'] as const) {
      const stopped = play(ready(0), [[10_000, { type: 'trigger' }], [10_100, finished(outcome)]]).last;
      expect(stopped.wakeAt).toBeNull();
      expect(play(stopped.state, [[200_000, { type: 'trigger' }]]).runs).toEqual([]);
    }
    const signedOut = play(ready(0), [[10_000, { type: 'trigger' }], [10_100, finished('signed-out')]]).last.state;
    const back = play(signedOut, [
      [20_000, { type: 'auth', status: 'signed-out', userId: null }],
      [30_000, { type: 'auth', status: 'signed-in', userId: USER }],
    ]);
    expect(back.runs).toEqual([30_000]);
  });

  it('keeps an update-needed stop until the app reloads', () => {
    const stopped = play(ready(0), [[10_000, { type: 'trigger' }], [10_100, finished('update-needed')]]).last.state;
    const { runs } = play(stopped, [
      [20_000, { type: 'auth', status: 'signed-out', userId: null }],
      [30_000, { type: 'auth', status: 'signed-in', userId: USER }],
    ]);
    expect(runs).toEqual([]);
  });

  it('leaves the first run after linking to linking itself, an interval away', () => {
    const { last } = play(initialSchedule(), [
      [0, { type: 'auth', status: 'signed-in', userId: USER }],
      [5_000, { type: 'link', userId: USER }],
    ]);
    // Signed in before the link: the interval counted from the link, as linking syncs once itself.
    expect(last.wakeAt).toBe(5_000 + INTERVAL);
  });
});
