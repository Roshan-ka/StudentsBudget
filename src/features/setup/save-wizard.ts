import { db } from '@/db/db';
import { keepScheduleState, updatePlan } from '@/features/recurring/update-plan';
import type { draftToRecords } from './draft';

/** Saves what the setup wizard made: a new setup's accounts and plan, or in edit mode the changed plan. */
export async function saveWizard(records: ReturnType<typeof draftToRecords>, edit: boolean): Promise<void> {
  if (edit) {
    // Accounts are not part of editing; only the plan changes. `updatePlan` keeps each schedule's
    // watermark where the poster left it, even if it moved while the wizard was open, and `keepScheduleState` keeps
    // a pause, a resume or a move to another account made meanwhile in another tab. The accounts are read in the same
    // transaction, so one deleted there is not named again.
    await db.transaction('rw', db.plan, db.accounts, async () => {
      const accountIds = new Set((await db.accounts.toArray()).map((a) => a.id));
      await updatePlan((current) => keepScheduleState(current, records.plan, accountIds));
    });
    return;
  }
  await db.transaction('rw', db.accounts, db.plan, async () => {
    await db.accounts.bulkAdd(records.accounts);
    await db.plan.put(records.plan);
  });
}
