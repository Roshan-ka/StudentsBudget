/** The Web Lock every sync and link of this phone takes, whichever tab runs it. */
const SYNC_LOCK = 'studentsbudget-sync';

/**
 * Runs `task` while this browser holds the sync lock, so the phone's tabs (one database, but each with its own module
 * state and one-at-a-time guard) never sync or link at the same time. Without Web Locks it just runs. A lock is not
 * re-entrant: take it only at the outermost call (`syncNow`, `linkPhone`, `linkWithChoice`, the sign-out wipe), never
 * inside one. With `waitMs`, the task runs anyway once it has waited that long for the lock: the sign-out wipe must not
 * hang on a sync whose request never answers.
 */
export async function withSyncLock<T>(task: () => Promise<T>, { waitMs }: { waitMs?: number } = {}): Promise<T> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return task();
  if (waitMs === undefined) {
    // Awaited here: the DOM types give a callback's promise back wrapped once more.
    return await navigator.locks.request(SYNC_LOCK, task);
  }
  const signal = AbortSignal.timeout(waitMs);
  try {
    return await navigator.locks.request(SYNC_LOCK, { signal }, task);
  } catch (error) {
    // Only the wait timed out: the task never ran, so it runs now, without the lock.
    if (signal.aborted) return task();
    throw error;
  }
}

/** What `withSyncLockIfFree` gives instead of running its task: another tab holds the lock. */
export const BUSY: unique symbol = Symbol('sync lock busy');

/**
 * Runs `task` under the sync lock only if no tab holds it now, else gives `BUSY` at once and never runs it: an
 * automatic sync skips while another tab syncs or links, which is doing the work anyway (automatic sync, chunk 1,
 * docs/superpowers/plans/2026-11-10-automatic-sync.md). It never waits, so it can't deadlock, but it is still taken
 * only at the outermost call: inside the lock it would always find it busy. Without Web Locks it just runs.
 */
export async function withSyncLockIfFree<T>(task: () => Promise<T>): Promise<T | typeof BUSY> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return task();
  return await navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, (lock) => (lock === null ? BUSY : task()));
}
