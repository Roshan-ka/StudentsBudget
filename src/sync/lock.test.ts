import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSY, withSyncLock, withSyncLockIfFree } from './lock';

type Request = (name: string, ...args: unknown[]) => Promise<unknown>;

/** Web Locks where another tab holds the lock and never lets go: a request waits until its signal gives up. */
function lockHeldForever(): Request {
  return (_name, ...args) => {
    const options = args.length === 2 ? (args[0] as { signal?: AbortSignal }) : {};
    return new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason));
    });
  };
}

/** Web Locks that are free: the task runs at once. */
function lockFree(): Request {
  return (_name, ...args) => (args.at(-1) as () => Promise<unknown>)();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('withSyncLock', () => {
  it('runs the task under the lock', async () => {
    vi.stubGlobal('navigator', { locks: { request: lockFree() } });
    expect(await withSyncLock(async () => 'done')).toBe('done');
    expect(await withSyncLock(async () => 'done', { waitMs: 50 })).toBe('done');
  });

  it('runs the task anyway once it has waited `waitMs` for a lock another tab never lets go', async () => {
    vi.stubGlobal('navigator', { locks: { request: lockHeldForever() } });
    const task = vi.fn(async () => 'wiped');
    expect(await withSyncLock(task, { waitMs: 20 })).toBe('wiped');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('passes on what the task throws, rather than running it twice', async () => {
    vi.stubGlobal('navigator', { locks: { request: lockFree() } });
    const task = vi.fn(async () => {
      throw new Error('blocked');
    });
    await expect(withSyncLock(task, { waitMs: 50 })).rejects.toThrow('blocked');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('just runs the task where the browser has no Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    expect(await withSyncLock(async () => 'done', { waitMs: 50 })).toBe('done');
  });
});

/** Web Locks asked with `ifAvailable`: the callback gets the lock, or null while another tab holds it. */
function lockIfAvailable(held: boolean): Request {
  return (name, options, callback) => {
    expect(options).toEqual({ ifAvailable: true });
    return Promise.resolve((callback as (lock: { name: string } | null) => unknown)(held ? null : { name }));
  };
}

describe('withSyncLockIfFree', () => {
  it('runs the task when no tab holds the lock', async () => {
    vi.stubGlobal('navigator', { locks: { request: lockIfAvailable(false) } });
    expect(await withSyncLockIfFree(async () => 'synced')).toBe('synced');
  });

  it('gives BUSY at once, and never runs the task, while another tab holds it', async () => {
    vi.stubGlobal('navigator', { locks: { request: lockIfAvailable(true) } });
    const task = vi.fn(async () => 'synced');
    expect(await withSyncLockIfFree(task)).toBe(BUSY);
    expect(task).not.toHaveBeenCalled();
  });

  it('just runs the task where the browser has no Web Locks', async () => {
    vi.stubGlobal('navigator', {});
    expect(await withSyncLockIfFree(async () => 'synced')).toBe('synced');
  });
});
