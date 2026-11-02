/** The Web Lock every sync and link of this phone takes, whichever tab runs it. */
const SYNC_LOCK = 'studentsbudget-sync';

/**
 * Runs `task` while this browser holds the sync lock, so the phone's tabs (one database, but each with its own module
 * state and one-at-a-time guard) never sync or link at the same time. Without Web Locks it just runs. A lock is not
 * re-entrant: take it only at the outermost call (`syncNow`, `linkPhone`, `linkWithChoice`), never inside one.
 */
export async function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return task();
  // Awaited here: the DOM types give a callback's promise back wrapped once more.
  return await navigator.locks.request(SYNC_LOCK, task);
}
