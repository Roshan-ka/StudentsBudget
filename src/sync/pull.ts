import { db } from '@/db/db';
import { accountUse } from '@/db/repo';
import type { Plan } from '@/db/types';
import { keepWatermarks } from '@/features/recurring/update-plan';
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
export type Checked = { row: PulledRow; value: object | null };

/** Checks a row from the account like a backup row (src/sync/rows.ts); throws a BadRow when this app can't read it. */
export function checkRow(row: PulledRow): Checked {
  return { row, value: row.data === null ? null : ROW_CHECKS[row.table](row) };
}

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
    const checked: Checked[] = [];
    for (const row of page) {
      try {
        checked.push(checkRow(row));
      } catch (error) {
        if (!(error instanceof BadRow)) throw error;
        // Named by table and id, so the row can be found in the account.
        console.error(`StudentsBudget: a pulled row this app cannot read (${row.table} ${row.id}):`, error.message);
        return { kind: 'invalid', problem: UPDATE_NEEDED };
      }
    }
    // Only forward: a page never takes the cursor back.
    cursor = Math.max(cursor, ...page.map((row) => row.rev));
    applied += await applyFromAccount(checked, cursor);
  }
}

/** The account's plan, with each watermark the phone's own plan has further kept. */
function withPhoneWatermarks(phone: Plan | undefined, account: Plan): Plan {
  return phone ? keepWatermarks(phone, account) : account;
}

/** Every table a pull writes: the synced Dexie tables, the outbox it reads, and the sync state that keeps the cursor. */
function pulledTables() {
  return [...SERVER_TABLES.map((table) => db.table(dexieHome(table).dexie)), db.outbox, db.syncState];
}

/**
 * Puts checked rows from the account on this phone, in one untracked transaction, and saves `cursor` with them when
 * given; returns how many rows changed. A row still waiting in the outbox is left alone. A plan keeps each watermark
 * this phone has moved further, as the account's keep_watermarks trigger does: going back would post periods again.
 */
export async function applyFromAccount(rows: Checked[], cursor?: number): Promise<number> {
  return untracked(pulledTables(), async () => {
    let applied = 0;
    for (const { row, value } of rows) {
      if ((await db.outbox.get([row.table, row.id])) !== undefined) continue;
      // Deleted on another phone while this one still uses it (an entry booked here meanwhile): kept, and queued to
      // go back to the account, so no phone is left with entries on a missing account.
      if (value === null && row.table === 'accounts' && (await accountUse(row.id)) !== null) {
        await db.outbox.put({ table: 'accounts', id: row.id, seq: Date.now() });
        continue;
      }
      const home = dexieHome(row.table);
      if (value === null) await db.table(home.dexie).delete(home.keyOf(row.id));
      else if (row.table === 'plans') await db.plan.put(withPhoneWatermarks(await db.plan.get('current'), value as Plan));
      else await db.table(home.dexie).put(value);
      applied += 1;
    }
    if (cursor !== undefined) await db.syncState.update('current', { cursor });
    return applied;
  });
}
