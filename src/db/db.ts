import Dexie, { type Table } from 'dexie';
import type { Account, Category, Entry, Guess, Plan, Rate } from './types';

export type StudentsBudgetDb = Dexie & {
  accounts: Table<Account, string>;
  categories: Table<Category, string>;
  entries: Table<Entry, string>;
  plan: Table<Plan, Plan['id']>;
  guesses: Table<Guess, string>;
  rates: Table<Rate, Rate['currency']>;
};

// Constructing Dexie opens nothing, so importing this module is safe during SSR and `next build`.
// IndexedDB is only touched on the first query, which only runs in the browser.
export const db = new Dexie('studentsbudget') as StudentsBudgetDb;

db.version(1).stores({
  accounts: 'id',
  categories: 'id, kind',
  entries: 'id, date, accountId, categoryId, type',
  plan: 'id',
  guesses: 'categoryId',
  rates: 'currency',
});

/** Asks the browser not to evict the data. Resolves false when unsupported, denied or failing; never throws. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
