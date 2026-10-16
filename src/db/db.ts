import Dexie, { type Table } from 'dexie';
import type { Account, Category, Entry, Guess, Plan, Rate } from './types';

export type StudentsBudgetDb = Dexie & {
  accounts: Table<Account, string>;
  categories: Table<Category, string>;
  entries: Table<Entry, string>;
  plan: Table<Plan, Plan['id']>;
  guesses: Table<Guess, string>;
  /** At most one ECB and one manual rate per currency, side by side. */
  fxRates: Table<Rate, [Rate['currency'], Rate['source']]>;
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

// A primary key cannot change in place, so the version-1 `rates` table (key: currency) is dropped and
// `fxRates` takes over with a compound key. Keeping both sources lets "Use ECB rate again" work offline.
// Dexie carries the unchanged tables over from version 1.
db.version(2).stores({
  rates: null,
  fxRates: '[currency+source], currency',
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
