import { db } from '@/db/db';

/**
 * Makes one account the default and clears the mark on every other, in one transaction, so there is never a moment
 * with two. An id that is gone (deleted in another tab) changes nothing.
 */
export async function setDefaultAccount(id: string): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    if ((await db.accounts.get(id)) === undefined) return;
    await db.accounts.toCollection().modify((account) => {
      if (account.id === id) account.isDefault = true;
      else delete account.isDefault;
    });
  });
}
