import { CATEGORIES } from '@/data/categories';
import type { BackupData } from '@/db/bulk';
import { checkBackupData } from '@/features/backup/backup';
import { BadRow, ROW_CHECKS } from './rows';
import type { StoredRow, UserDataStore } from './store';
import { contentsOf } from './summary';
import { byTable, SERVER_TABLES } from './tables';

/**
 * What the account holds, read and checked before anything on the phone changes: nothing at all, rows without a plan
 * (a first save that stopped halfway: a save always has one and writes it last), rows that cannot be the app's data
 * (with what is wrong), or a complete set of data ready to replace the phone's.
 */
export type DownloadPlan =
  | { kind: 'empty' }
  | { kind: 'unfinished' }
  | { kind: 'invalid'; problem: string }
  | { kind: 'ready'; data: BackupData };

/**
 * Reads every table of the account and turns it into the phone's data, checked like a backup file: every row's fields
 * (src/db/schemas.ts), then what the rows say about each other (`checkBackupData`). Writes nothing. `phone` is this
 * phone's data, whose ECB rates stay: they are only its copy of the day's published rates, and the account has none.
 */
export async function planDownload(store: UserDataStore, phone: BackupData): Promise<DownloadPlan> {
  const rows = byTable<StoredRow[]>(() => []);
  for (const table of SERVER_TABLES) rows[table] = await store.listRows(table);
  if (SERVER_TABLES.every((table) => rows[table].length === 0)) return { kind: 'empty' };
  if (rows.plans.length === 0) return { kind: 'unfinished' };

  let data: BackupData;
  try {
    const plans = rows.plans.map(ROW_CHECKS.plans);
    const profiles = rows.profiles.map(ROW_CHECKS.profiles);
    data = {
      accounts: rows.accounts.map(ROW_CHECKS.accounts),
      // Built into the app, never saved to the account.
      categories: CATEGORIES.map((c) => ({ ...c })),
      entries: rows.entries.map(ROW_CHECKS.entries),
      plan: plans[0] ?? null,
      guesses: rows.guesses.map(ROW_CHECKS.guesses),
      fxRates: [...phone.fxRates.filter((rate) => rate.source === 'ecb'), ...rows.manual_rates.map(ROW_CHECKS.manual_rates)],
      weekResults: rows.week_results.map(ROW_CHECKS.week_results),
      discountVotes: rows.discount_votes.map(ROW_CHECKS.discount_votes),
      profile: profiles[0] ?? null,
    };
  } catch (error) {
    if (error instanceof BadRow) return { kind: 'invalid', problem: error.message };
    throw error;
  }

  const problem = checkBackupData(data);
  return problem === null ? { kind: 'ready', data } : { kind: 'invalid', problem };
}

/** "3 accounts, 128 entries and your plan": what loading brings onto the phone. */
export function downloadContents(data: BackupData): string {
  return contentsOf(data.accounts.length, data.entries.length, data.plan !== null);
}
