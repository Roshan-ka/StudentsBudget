import Dexie, { type Table } from 'dexie';
import { db } from '@/db/db';
import { markAutomatic } from './track-changes';

/**
 * Runs `task` in one read-write transaction over `tables` whose writes are recorded as the poster's (`auto` in the
 * outbox): recurring entries and the plan's watermarks, made from what this phone knew. A push adds such a row where
 * the account has none, and otherwise takes the account's copy (src/sync/push.ts). Like `untracked`, it must start
 * its own transaction, so the mark never reaches a write of the person's.
 */
export async function automatic<T>(tables: Table[], task: () => Promise<T>): Promise<T> {
  if (Dexie.currentTransaction) {
    throw new Error('automatic() must not run inside another transaction');
  }
  return db.transaction('rw', tables, async (transaction) => {
    markAutomatic(transaction.idbtrans);
    return task();
  });
}
