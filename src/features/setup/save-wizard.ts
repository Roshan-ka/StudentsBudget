import { db } from '@/db/db';
import { keepScheduleState, updatePlan } from '@/features/recurring/update-plan';
import type { draftToRecords } from './draft';

/** What a save did: `already-set-up` when a new setup found a plan already there, and wrote nothing. */
export type SaveResult = 'saved' | 'already-set-up';

/**
 * Saves what the setup wizard made: a new setup's accounts and plan, or in edit mode the changed plan.
 *
 * A new setup checks for a plan in the same transaction as its writes. The wizard reads the plan only when it opens, and
 * one can arrive while it is open: the account's data after a sign-in that finished on a page left behind, setup saved
 * in another tab, or a restore. Writing then would add a second set of accounts and replace that plan, and a linked
 * phone would push it to the account (review, 09-11-2026).
 */
export async function saveWizard(records: ReturnType<typeof draftToRecords>, edit: boolean): Promise<SaveResult> {
  if (edit) {
    // Accounts are not part of editing; only the plan changes. `updatePlan` keeps each schedule's
    // watermark where the poster left it, even if it moved while the wizard was open, and `keepScheduleState` keeps
    // a pause, a resume or a move to another account made meanwhile in another tab. The accounts are read in the same
    // transaction, so one deleted there is not named again.
    await db.transaction('rw', db.plan, db.accounts, async () => {
      const accountIds = new Set((await db.accounts.toArray()).map((a) => a.id));
      await updatePlan((current) => keepScheduleState(current, records.plan, accountIds));
    });
    return 'saved';
  }
  return db.transaction('rw', db.accounts, db.plan, async () => {
    if ((await db.plan.get('current')) !== undefined) return 'already-set-up';
    await db.accounts.bulkAdd(records.accounts);
    await db.plan.put(records.plan);
    return 'saved';
  });
}
