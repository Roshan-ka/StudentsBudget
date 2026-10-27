import Dexie, { type Table } from 'dexie';
import { trackChanges } from '@/sync/track-changes';
import type {
  Account,
  Category,
  DiscountVote,
  Entry,
  Guess,
  OutboxEntry,
  Plan,
  Profile,
  Rate,
  SyncState,
  WeekResult,
} from './types';

export type StudentsBudgetDb = Dexie & {
  accounts: Table<Account, string>;
  categories: Table<Category, string>;
  entries: Table<Entry, string>;
  plan: Table<Plan, Plan['id']>;
  guesses: Table<Guess, string>;
  /** At most one ECB and one manual rate per currency, side by side. */
  fxRates: Table<Rate, [Rate['currency'], Rate['source']]>;
  /** One row per finished week, keyed by the Monday it started on. */
  weekResults: Table<WeekResult, WeekResult['weekStart']>;
  /** One vote per discount. */
  discountVotes: Table<DiscountVote, DiscountVote['discountId']>;
  /** At most one row, like the plan. */
  profile: Table<Profile, Profile['id']>;
  /** The rows that changed since the last push, while the phone is linked to an account. One entry per row. */
  outbox: Table<OutboxEntry, [OutboxEntry['table'], string]>;
  /** At most one row: the account this phone syncs with, and how far it has pulled. */
  syncState: Table<SyncState, SyncState['id']>;
};

// Constructing Dexie opens nothing, so importing this module is safe during SSR and `next build`.
// IndexedDB is only touched on the first query, which only runs in the browser.
export const db = new Dexie('studentsbudget') as StudentsBudgetDb;

// Records which synced rows change, for live sync (src/sync/track-changes.ts). Registered before the database opens.
db.use(trackChanges);

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

// Three new tables for the weekly results behind the badges, the discount votes and the profile. Only they are
// listed: Dexie carries every other table over from version 2, and a shipped version is never edited.
db.version(3).stores({
  weekResults: 'weekStart',
  discountVotes: 'discountId',
  profile: 'id',
});

// Two tables for live sync (P2.2): the outbox of changed rows, and the phone's link to an account. Neither is in a
// backup, and Delete everything removes both with the rest.
db.version(4).stores({
  outbox: '[table+id]',
  syncState: 'id',
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
