import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitResult } from '@/sync/auto-runner';
import { inStartOrder, SYNC_FIRST_CAP, weeksMayRecord, type StartClock } from './start-order';

const clock: StartClock = {
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function steps(log: string[]) {
  return {
    rates: async () => void log.push('rates'),
    recurring: async () => void log.push('recurring'),
    weeks: async () => void log.push('weeks'),
  };
}

function deferred() {
  let resolve: (result: VisitResult) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<VisitResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('weeksMayRecord', () => {
  it('lets a synced visit or a phone with no link record the weeks', () => {
    expect(weeksMayRecord('synced')).toBe(true);
    expect(weeksMayRecord('unlinked')).toBe(true);
    expect(weeksMayRecord('not-synced')).toBe(false);
  });
});

describe('inStartOrder', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('syncs first, then the rates, the posting and the weeks', async () => {
    const log: string[] = [];
    const visit = deferred();
    const done = inStartOrder(
      visit.promise.then((result) => (log.push('sync'), result)),
      steps(log),
      clock,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(log).toEqual([]);
    visit.resolve('synced');
    await done;
    expect(log).toEqual(['sync', 'rates', 'recurring', 'weeks']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs at once on a phone with no link, weeks included', async () => {
    const log: string[] = [];
    await inStartOrder(Promise.resolve('unlinked'), steps(log), clock);
    expect(log).toEqual(['rates', 'recurring', 'weeks']);
  });

  it('records no week when the sync failed, but still posts', async () => {
    const log: string[] = [];
    await inStartOrder(Promise.resolve('not-synced'), steps(log), clock);
    expect(log).toEqual(['rates', 'recurring']);
  });

  it('holds the posting back for the cap only; the weeks wait for the slow sync', async () => {
    const log: string[] = [];
    const visit = deferred();
    const done = inStartOrder(visit.promise, steps(log), clock);
    await vi.advanceTimersByTimeAsync(SYNC_FIRST_CAP - 1);
    expect(log).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(log).toEqual(['rates', 'recurring']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(log).toEqual(['rates', 'recurring']);
    visit.resolve('synced');
    await done;
    expect(log).toEqual(['rates', 'recurring', 'weeks']);
  });

  it('treats a visit that throws as not synced', async () => {
    const log: string[] = [];
    const visit = deferred();
    const done = inStartOrder(visit.promise, steps(log), clock);
    visit.reject(new Error('gone'));
    await done;
    expect(log).toEqual(['rates', 'recurring']);
  });
});
