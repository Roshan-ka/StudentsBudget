import { useSyncExternalStore } from 'react';
import { deleteEverything } from '@/db/bulk';
import { readPref, writePref } from '@/lib/phone-pref';
import { withSyncLock } from '@/sync/lock';

/**
 * Set while a sign-out still owes the phone its wipe: from the moment the session is gone until the data is. Kept in
 * localStorage, apart from the database the wipe deletes, so a wipe that fails, or a tab closed before it finished, is
 * done on the next start (`finishPendingWipe`). Not synced, not backed up.
 */
export const WIPE_PENDING_KEY = 'studentsbudget-wipe-pending';

/** How long the wipe waits for a sync or link still running before it clears the phone anyway. */
const WIPE_WAIT_MS = 10_000;

/** Whether a sign-out still owes this phone its wipe. */
export function wipePending(): boolean {
  return readPref(WIPE_PENDING_KEY) === 'pending';
}

/** The mark as this page load found it: read once, so the wipe of a sign-out in this tab never flashes it up. */
let owedAtLoad: boolean | undefined;

function readOwedAtLoad(): boolean {
  owedAtLoad ??= wipePending();
  return owedAtLoad;
}

function noChanges(): () => void {
  return () => {};
}

/**
 * Whether this page load found a wipe still owed (false in the server render): a sign-out whose wipe failed on an
 * earlier visit, which the start of the app couldn't finish either. A failure in this tab reaches the page through
 * its own state (`SignedInPanel`'s `onWipeFailed`).
 */
export function useWipeOwedAtLoad(): boolean {
  return useSyncExternalStore(noChanges, readOwedAtLoad, () => false);
}

/** Forgets the owed wipe: done, or a new sign-in has taken the phone over (its link asks what to keep). */
export function forgetPendingWipe(): void {
  writePref(WIPE_PENDING_KEY, '');
}

/**
 * Clears this phone after its session has gone (review, 09-11-2026). Under the sync lock, so a sync or link still
 * running in this tab or another finishes first: one that landed after the wipe would write the account's rows into
 * the fresh database. A session that has gone makes those calls fail fast; a hung one is waited for at most 10 s.
 * Marked as owed first, so a failure is not forgotten. Throws when the wipe fails.
 */
export async function wipeAfterSignOut(): Promise<void> {
  writePref(WIPE_PENDING_KEY, 'pending');
  await withSyncLock(deleteEverything, { waitMs: WIPE_WAIT_MS });
  forgetPendingWipe();
}

/**
 * Finishes a wipe a sign-out still owes, at the app's start: `none` when nothing is owed, `done` when the phone is
 * cleared now, `failed` when it still can't be (the account page says so). The caller makes sure nobody is signed in.
 */
export async function finishPendingWipe(): Promise<'none' | 'done' | 'failed'> {
  if (!wipePending()) return 'none';
  try {
    await wipeAfterSignOut();
    return 'done';
  } catch (error) {
    console.error('StudentsBudget: could not clear this phone after signing out', error);
    return 'failed';
  }
}
