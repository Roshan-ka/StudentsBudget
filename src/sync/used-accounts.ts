import { db } from '@/db/db';
import { accountUse } from '@/db/repo';
import { applyFromAccount, checkRow, type Checked } from './pull';
import { BadRow } from './rows';
import type { UserDataStore } from './store';
import type { ServerTable } from './tables';

/**
 * Accounts this phone deleted whose delete still waits in the outbox, held back until after the pull (`push`'s
 * `holdAccountDeletes`). One that an entry pulled just now uses was booked on by another phone before this phone's
 * delete reached the account. Sending the delete would leave this phone and the account with an entry on a deleted
 * account, which a backup and a link refuse as damaged until the other phone syncs again (review, 09-11-2026). The
 * account still holds the row, so it comes back to this phone and the delete is dropped. The other deletes go out with
 * the next push. Returns how many came back.
 */
export async function bringBackUsedAccounts(store: UserDataStore): Promise<number> {
  const waiting = (await db.outbox.toArray()).filter((entry) => entry.table === 'accounts');
  const used = new Set<string>();
  for (const { id } of waiting) {
    // Still on the phone: an edit waiting to go, not a delete.
    if ((await db.accounts.get(id)) !== undefined) continue;
    if ((await accountUse(id)) !== null) used.add(id);
  }
  if (used.size === 0) return 0;

  const back: Checked[] = [];
  for (const row of await store.listRows('accounts')) {
    if (!used.has(row.id)) continue;
    try {
      back.push(checkRow({ table: 'accounts', id: row.id, data: row.data, rev: 0 }));
    } catch (error) {
      if (!(error instanceof BadRow)) throw error;
      // A row this app can't read stays deleted here; the next pull reports it if it comes again.
      console.error('StudentsBudget: the account holds an account row this app cannot read:', error.message);
    }
  }
  if (back.length === 0) return 0;
  // The delete goes first: the pull's writer leaves alone a row still waiting in the outbox.
  await db.outbox.bulkDelete(back.map(({ row }): [ServerTable, string] => ['accounts', row.id]));
  await applyFromAccount(back);
  return back.length;
}
