import type { BackupData } from '@/db/bulk';
import type { UserDataStore } from './store';
import { count, listed } from './summary';
import { byTable, SERVER_TABLES, serverRowsOf, type ServerRow, type ServerTable } from './tables';

/**
 * A save worked out before anything is written: this phone's rows, and per table the ids the account has that this
 * phone does not. Saving makes the account match the phone, so those rows are deleted from it.
 */
export type UploadPlan = {
  rows: Record<ServerTable, ServerRow[]>;
  stale: Record<ServerTable, string[]>;
};

/** Reads which rows the account has, to compare them with the snapshot. Writes nothing. */
export async function planUpload(store: UserDataStore, d: BackupData): Promise<UploadPlan> {
  const rows = serverRowsOf(d);
  const stale = byTable<string[]>(() => []);
  for (const table of SERVER_TABLES) {
    const here = new Set(rows[table].map((row) => row.id));
    stale[table] = (await store.listIds(table)).filter((id) => !here.has(id));
  }
  return { rows, stale };
}

// The plan goes last: until it is there, a first save that stopped halfway reads as unfinished (see planDownload), not
// as a phone without a plan.
const WRITE_ORDER: ServerTable[] = [...SERVER_TABLES.filter((table) => table !== 'plans'), 'plans'];
// Rows that point at others go before what they point at: entries before the accounts they use. Deleting (writing
// tombstones) that stops halfway then leaves accounts with no entries, never entries on a missing account.
const DELETE_ORDER: ServerTable[] = [...SERVER_TABLES].reverse();

/**
 * Writes every row of the plan, then deletes the stale ones (as tombstones). Writing comes first: if a request fails halfway, the
 * account has rows to spare rather than rows missing, and saving again finishes the job. A later save that stops
 * halfway can leave the account with some new rows next to the old plan; saving again puts that right.
 */
export async function applyUpload(store: UserDataStore, plan: UploadPlan): Promise<void> {
  for (const table of WRITE_ORDER) {
    if (plan.rows[table].length > 0) await store.upsert(table, plan.rows[table]);
  }
  for (const table of DELETE_ORDER) {
    if (plan.stale[table].length > 0) await store.tombstone(table, plan.stale[table]);
  }
}

/**
 * What saving would delete from the account, in words ("12 entries and 3 other items"), or null when nothing. Only
 * entries are named; the rest (accounts, weeks, votes and the like) are counted together.
 */
export function staleSummary(plan: UploadPlan): string | null {
  const entries = plan.stale.entries.length;
  const others = SERVER_TABLES.filter((table) => table !== 'entries').reduce((n, t) => n + plan.stale[t].length, 0);
  const parts = [
    ...(entries > 0 ? [count(entries, 'entry', 'entries')] : []),
    ...(others > 0 ? [count(others, 'other item', 'other items')] : []),
  ];
  return parts.length === 0 ? null : listed(parts);
}
