import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKOFF, CHANGE_DELAY, INTERVAL } from './auto-schedule';
import { createAutoRunner, heldOf, outcomeOf, type RunDone } from './auto-runner';

// The automatic sync's runner (automatic sync, chunk 3), on fake timers with a played sync.

const USER = 'user-1';
const EMPTY = { count: 0, newest: 0 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

/** A runner whose syncs end as `outcomes` says, in turn (then `synced`), each after `ms`. */
function played(outcomes: RunDone['outcome'][] = [], ms = 100) {
  const runs: number[] = [];
  const queue = [...outcomes];
  const runner = createAutoRunner({
    now: () => Date.now(),
    setTimer: (callback, wait) => setTimeout(callback, wait),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    run: async () => {
      runs.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { outcome: queue.shift() ?? 'synced', outbox: EMPTY, held: 0 };
    },
  });
  return { runner, runs };
}

function linked(runner: ReturnType<typeof played>['runner']) {
  runner.dispatch({ type: 'auth', status: 'signed-in', userId: USER });
  runner.dispatch({ type: 'link', userId: USER });
}

describe('a clock that stands still', () => {
  it('still runs a due sync once its timer fires: a fixed Date, as in the e2e specs, or a clock set back', async () => {
    const runs: number[] = [];
    let ticks = 0;
    const runner = createAutoRunner({
      // Date.now never moves; the timers do.
      now: () => 0,
      setTimer: (callback, wait) => setTimeout(callback, wait),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      run: async () => {
        runs.push(ticks);
        return { outcome: 'synced', outbox: EMPTY, held: 0 };
      },
    });
    runner.dispatch({ type: 'outbox', outbox: EMPTY });
    linked(runner);
    // A change: sent after the change delay, though the clock still says 0.
    runner.dispatch({ type: 'outbox', outbox: { count: 1, newest: 1 } });
    ticks = 1;
    await vi.advanceTimersByTimeAsync(CHANGE_DELAY);
    expect(runs).toEqual([1]);
    // And the interval after it.
    ticks = 2;
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(runs).toEqual([1, 2]);
    runner.stop();
  });
});

describe('outcomeOf and heldOf', () => {
  it('maps a sync’s result to the schedule’s outcome', () => {
    expect(outcomeOf({ kind: 'synced', sent: 1, received: 0 })).toBe('synced');
    expect(outcomeOf({ kind: 'busy' })).toBe('busy');
    expect(outcomeOf({ kind: 'problem', problem: 'held:2' })).toBe('held');
    expect(outcomeOf({ kind: 'problem', problem: 'signed-out' })).toBe('signed-out');
    expect(heldOf({ kind: 'problem', problem: 'held:2' })).toBe(2);
    expect(heldOf({ kind: 'synced', sent: 0, received: 0 })).toBe(0);
  });
});

describe('visits', () => {
  it('syncs on opening and says so once the sync has ended', async () => {
    const { runner, runs } = played();
    linked(runner);
    const visit = runner.visit('open');
    await vi.advanceTimersByTimeAsync(100);
    expect(await visit).toBe('synced');
    expect(runs).toHaveLength(1);
  });

  it('waits to know the session and the link before it answers, so an early visit never reads as unlinked', async () => {
    const { runner, runs } = played();
    let answer: string | null = null;
    void runner.visit('open').then((result) => (answer = result));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(answer).toBeNull();
    linked(runner);
    await vi.advanceTimersByTimeAsync(100);
    expect(answer).toBe('synced');
    expect(runs).toHaveLength(1);
  });

  it('answers unlinked at once on a phone with no link, and syncs nothing', async () => {
    const { runner, runs } = played();
    runner.dispatch({ type: 'auth', status: 'signed-out', userId: null });
    runner.dispatch({ type: 'link', userId: null });
    expect(await runner.visit('open')).toBe('unlinked');
    expect(runs).toEqual([]);
  });

  it('answers not-synced when the sync failed, and when it may not run (offline)', async () => {
    const failing = played(['failed']);
    linked(failing.runner);
    const visit = failing.runner.visit('open');
    await vi.advanceTimersByTimeAsync(100);
    expect(await visit).toBe('not-synced');

    const offline = played();
    linked(offline.runner);
    offline.runner.dispatch({ type: 'offline' });
    expect(await offline.runner.visit('return')).toBe('not-synced');
    expect(offline.runs).toEqual([]);
  });

  it('runs one sync for a return and a focus that arrive together, and focus after a synced visit runs none', async () => {
    const { runner, runs } = played();
    linked(runner);
    const back = runner.visit('return');
    const focus = runner.visit('focus');
    await vi.advanceTimersByTimeAsync(100);
    expect(await back).toBe('synced');
    expect(await focus).toBe('synced');
    expect(await runner.visit('focus')).toBe('synced');
    expect(runs).toHaveLength(1);
  });

  it('reads the visit at midnight without syncing', async () => {
    const { runner, runs } = played();
    linked(runner);
    const opened = runner.visit('open');
    await vi.advanceTimersByTimeAsync(100);
    await opened;
    expect(await runner.visit('midnight')).toBe('synced');
    expect(runs).toHaveLength(1);
  });

  it('counts a sync it didn’t start (Sync now) for the visit, and its success resets the backoff', async () => {
    const { runner, runs } = played(['failed', 'failed']);
    linked(runner);
    const visit = runner.visit('open');
    await vi.advanceTimersByTimeAsync(100);
    expect(await visit).toBe('not-synced');
    // The retry a minute later fails too: the next would wait 2 minutes.
    await vi.advanceTimersByTimeAsync(BACKOFF[0] + 100);
    expect(runs).toHaveLength(2);
    runner.heard({ outcome: 'synced', outbox: EMPTY, held: 0 });
    expect(await runner.visit('midnight')).toBe('synced');
    // The Sync now reset it: the next run is the interval's, a minute on, not the 2 minutes' retry.
    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(runs).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toHaveLength(3);
    expect(BACKOFF[1]).toBeGreaterThan(INTERVAL);
  });
});

describe('the timer', () => {
  it('syncs a change after CHANGE_DELAY, and every INTERVAL while visible', async () => {
    const { runner, runs } = played();
    linked(runner);
    runner.dispatch({ type: 'outbox', outbox: { count: 1, newest: 1 } });
    await vi.advanceTimersByTimeAsync(CHANGE_DELAY - 1);
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100 + INTERVAL);
    expect(runs).toHaveLength(2);
  });

  it('retries a failed sync after the backoff', async () => {
    const { runner, runs } = played(['failed']);
    linked(runner);
    void runner.visit('open');
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(BACKOFF[0] - 1);
    expect(runs).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toHaveLength(2);
  });

  it('treats a sync that throws as failed', async () => {
    const runner = createAutoRunner({
      now: () => Date.now(),
      setTimer: (callback, wait) => setTimeout(callback, wait),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      run: async () => {
        throw new Error('network');
      },
    });
    linked(runner);
    expect(await runner.visit('open')).toBe('not-synced');
  });

  it('runs nothing after stop, and lets a waiting visit go', async () => {
    const { runner, runs } = played();
    const visit = runner.visit('open');
    runner.stop();
    expect(await visit).toBe('not-synced');
    linked(runner);
    await vi.advanceTimersByTimeAsync(10 * INTERVAL);
    expect(runs).toEqual([]);
  });

  it('runs nothing while paused, and goes on after resume', async () => {
    const { runner, runs } = played();
    linked(runner);
    runner.dispatch({ type: 'pause' });
    runner.dispatch({ type: 'outbox', outbox: { count: 1, newest: 1 } });
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(runs).toEqual([]);
    runner.dispatch({ type: 'resume' });
    await vi.advanceTimersByTimeAsync(CHANGE_DELAY);
    expect(runs).toHaveLength(1);
  });
});
