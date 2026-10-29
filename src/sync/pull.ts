import { db } from '@/db/db';
import { BadRow, ROW_CHECKS } from './rows';
import type { PulledRow, UserDataStore } from './store';
import { dexieHome, SERVER_TABLES } from './tables';
import { untracked } from './untracked';

/** Rows per pull request. */
export const PULL_PAGE = 500;

/** Shown when the account holds a row this version of the app can't read: a newer phone wrote it. */
export const UPDATE_NEEDED = 'This app needs an update to sync.';

/**
 * How a pull ended: every new row taken (how many were applied, and the cursor now), or stopped at a row this app
 * can't read, with the cursor left before it, so nothing after it is skipped once the app is updated.
 */
export type PullResult = { kind: 'done'; applied: number; cursor: number } | { kind: 'invalid'; problem: string };

/** A pulled row, checked: the row to put on the phone, or null for a tombstone (the row was deleted). */
type Checked = { row: PulledRow; value: object | null };

/**
 * Brings the account's changes onto this phone (P2.2): every row written after the phone's cursor, a page at a time,
 * until an empty page. Each row is checked like a backup row (src/sync/rows.ts) before anything changes. A page goes
 * into one untracked transaction, so pulled rows are never sent back as this phone's changes: rows are put, tombstones
 * deleted, and a row still waiting in the outbox is left alone (this phone's change goes out with the next push, and the
 * last write to reach the account wins). The new cursor is saved in the same transaction.
 */
export async function pull(store: UserDataStore, limit = PULL_PAGE): Promise<PullResult> {
  let cursor = (await db.syncState.get('current'))?.cursor ?? 0;
  let applied = 0;
  for (;;) {
    const page = await store.pull(cursor, limit);
    if (page.length === 0) return { kind: 'done', applied, cursor };
    let checked: Checked[];
    try {
      checked = page.map((row) => ({ row, value: row.data === null ? null : ROW_CHECKS[row.table](row) }));
    } catch (error) {
      if (error instanceof BadRow) {
        console.error('StudentsBudget: a pulled row this app cannot read:', error.message);
        return { kind: 'invalid', problem: UPDATE_NEEDED };
      }
      throw error;
    }
    // Only forward: a page never takes the cursor back.
    cursor = Math.max(cursor, ...page.map((row) => row.rev));
    applied += await apply(checked, cursor);
  }
}

/** Every table a pull writes: the synced Dexie tables, the outbox it reads, and the sync state that keeps the cursor. */
function pulledTables() {
  return [...SERVER_TABLES.map((table) => db.table(dexieHome(table).dexie)), db.outbox, db.syncState];
}

/** Applies one checked page and saves the cursor, in one untracked transaction; returns how many rows changed. */
async function apply(rows: Checked[], cursor: number): Promise<number> {
  return untracked(pulledTables(), async () => {
    let applied = 0;
    for (const { row, value } of rows) {
      if ((await db.outbox.get([row.table, row.id])) !== undefined) continue;
      const home = dexieHome(row.table);
      if (value === null) await db.table(home.dexie).delete(home.keyOf(row.id));
      else await db.table(home.dexie).put(value);
      applied += 1;
    }
    await db.syncState.update('current', { cursor });
    return applied;
  });
}
