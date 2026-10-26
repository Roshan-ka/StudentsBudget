import type { Table } from 'dexie';
import { db } from '@/db/db';
import { markUntracked } from './track-changes';

/**
 * Runs `task` in one read-write transaction over `tables` whose writes are not recorded in the outbox: for rows that
 * came from the account, which must not be sent back to it as if they were this phone's changes.
 */
export async function untracked<T>(tables: Table[], task: () => Promise<T>): Promise<T> {
  return db.transaction('rw', tables, async (transaction) => {
    markUntracked(transaction.idbtrans);
    return task();
  });
}
