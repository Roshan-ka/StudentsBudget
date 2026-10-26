import type { z } from 'zod';
import { CATEGORIES } from '@/data/categories';
import type { BackupData } from '@/db/bulk';
import {
  accountRow,
  discountVoteRow,
  entryRow,
  guessRow,
  planRow,
  profileRow,
  rateRow,
  weekResultRow,
} from '@/db/schemas';
import { checkBackupData } from '@/features/backup/backup';
import { StoreError, type StoredRow, type UserDataStore } from './store';
import { contentsOf } from './summary';
import { byTable, SERVER_TABLES, type ServerTable } from './tables';

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

/** A row from the account that is not one the app could have saved. */
class BadRow extends Error {}

/** Checks every row of a table, and that its id is the key the phone files it under. */
function rowsOf<T>(table: ServerTable, rows: StoredRow[], schema: z.ZodType<T>, keyOf: (row: T) => string): T[] {
  return rows.map((row) => {
    const parsed = schema.safeParse(row.data);
    if (!parsed.success) throw new BadRow(`a row of ${table} isn't the app's data`);
    if (keyOf(parsed.data) !== row.id) throw new BadRow(`a row of ${table} is filed under the wrong id`);
    return parsed.data;
  });
}

const manualRate = rateRow.refine((rate) => rate.source === 'manual');

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
    const plans = rowsOf('plans', rows.plans, planRow, (p) => p.id);
    const profiles = rowsOf('profiles', rows.profiles, profileRow, (p) => p.id);
    data = {
      accounts: rowsOf('accounts', rows.accounts, accountRow, (a) => a.id),
      // Built into the app, never saved to the account.
      categories: CATEGORIES.map((c) => ({ ...c })),
      entries: rowsOf('entries', rows.entries, entryRow, (e) => e.id),
      plan: plans[0] ?? null,
      guesses: rowsOf('guesses', rows.guesses, guessRow, (g) => g.categoryId),
      fxRates: [
        ...phone.fxRates.filter((rate) => rate.source === 'ecb'),
        ...rowsOf('manual_rates', rows.manual_rates, manualRate, (r) => r.currency),
      ],
      weekResults: rowsOf('week_results', rows.week_results, weekResultRow, (w) => w.weekStart),
      discountVotes: rowsOf('discount_votes', rows.discount_votes, discountVoteRow, (v) => v.discountId),
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

/** Calm text for a load that did not work. */
export function loadErrorMessage(error: unknown): string {
  if (error instanceof StoreError && error.status === 401) {
    return 'Your sign-in has run out. Sign out, sign in again, then load.';
  }
  return "Couldn't load from your account. Check your connection and try again.";
}
