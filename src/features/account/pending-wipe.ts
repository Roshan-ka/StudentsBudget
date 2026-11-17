import { useSyncExternalStore } from 'react';
import { deleteEverything } from '@/db/bulk';
import { db } from '@/db/db';
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

/** Forgets the owed wipe: done, or a new sign-in by the account the phone is linked to (or by anyone on an unlinked phone). */
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

/** What a sign-in's wipe check settled to (`settleWipeOnSignIn`). */
export type WipeOnSignIn = 'none' | 'kept' | 'done' | 'failed';

/** The check in flight, so the session listener and linking share one and never wipe twice. */
let settling: { userId: string; result: Promise<WipeOnSignIn> } | undefined;

/**
 * A sign-in while a sign-out still owes the phone its wipe (review B1, 17-11-2026). The account the phone is linked to
 * signing in again, or anyone on a phone with no link, takes the phone over: the mark goes, and linking asks what to
 * keep. Anyone else first gets the wipe finished: the data is another account's, and linking would only refuse
 * (`planLink`'s `other-account`) while it showed on Home. `failed` keeps the mark, for the account page to say.
 * Called by the session listener on `SIGNED_IN` and by linking before it plans; both share one check per user.
 */
export function settleWipeOnSignIn(userId: string): Promise<WipeOnSignIn> {
  if (settling?.userId === userId) return settling.result;
  const result = settleNow(userId);
  settling = { userId, result };
  void result.finally(() => {
    if (settling?.result === result) settling = undefined;
  });
  return result;
}

async function settleNow(userId: string): Promise<WipeOnSignIn> {
  if (!wipePending()) return 'none';
  let linkedTo: string | null | undefined;
  try {
    linkedTo = (await db.syncState.get('current'))?.userId;
  } catch (error) {
    // Unreadable: the data may be another account's, so the wipe is finished.
    console.error('StudentsBudget: could not read the link before a sign-in took the phone over', error);
    return finishPendingWipe();
  }
  if (!linkedTo || linkedTo === userId) {
    forgetPendingWipe();
    return 'kept';
  }
  return finishPendingWipe();
}
