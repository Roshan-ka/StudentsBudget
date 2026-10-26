import type { BackupData } from '@/db/bulk';
import { StoreError, type UserDataStore } from './store';
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

/**
 * Writes every row of the plan, then deletes the stale ones. Writing comes first: if a request fails halfway, the
 * account has rows to spare, never rows missing, and saving again finishes the job.
 */
export async function applyUpload(store: UserDataStore, plan: UploadPlan): Promise<void> {
  for (const table of SERVER_TABLES) {
    if (plan.rows[table].length > 0) await store.upsert(table, plan.rows[table]);
  }
  for (const table of SERVER_TABLES) {
    if (plan.stale[table].length > 0) await store.remove(table, plan.stale[table]);
  }
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 accounts and 1 entry", "a, b and c". */
function listed(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** What a finished save says: "Saved to your account: 3 accounts, 42 entries and your plan." */
export function uploadSummary(plan: UploadPlan): string {
  const parts = [
    count(plan.rows.accounts.length, 'account', 'accounts'),
    count(plan.rows.entries.length, 'entry', 'entries'),
  ];
  if (plan.rows.plans.length > 0) parts.push('your plan');
  return `Saved to your account: ${listed(parts)}.`;
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

/** Calm text for a save that did not work. */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof StoreError && error.status === 401) {
    return 'Your sign-in has run out. Sign out, sign in again, then save.';
  }
  return "Couldn't save to your account. Check your connection and try again.";
}
