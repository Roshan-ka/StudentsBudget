import { db } from './db';
import { ensureSeeded } from './repo';
import type { Account, Category, DiscountVote, Entry, Guess, Plan, Profile, Rate, WeekResult } from './types';

/** Everything the app stores, as one value. `fxRates` holds every row, the ECB and the manual one of a currency. */
export type BackupData = {
  accounts: Account[];
  categories: Category[];
  entries: Entry[];
  plan: Plan | null;
  guesses: Guess[];
  fxRates: Rate[];
  weekResults: WeekResult[];
  discountVotes: DiscountVote[];
  /** One row, like the plan: null until the user has saved a profile. */
  profile: Profile | null;
};

function allTables() {
  return [
    db.accounts,
    db.categories,
    db.entries,
    db.plan,
    db.guesses,
    db.fxRates,
    db.weekResults,
    db.discountVotes,
    db.profile,
  ];
}

/** Reads every table in one snapshot. */
export async function exportAll(): Promise<BackupData> {
  return db.transaction('r', allTables(), async () => ({
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    entries: await db.entries.toArray(),
    plan: (await db.plan.get('current')) ?? null,
    guesses: await db.guesses.toArray(),
    fxRates: await db.fxRates.toArray(),
    weekResults: await db.weekResults.toArray(),
    discountVotes: await db.discountVotes.toArray(),
    profile: (await db.profile.get('current')) ?? null,
  }));
}

/**
 * Swaps everything on the device for `d`, in one transaction: either every table is replaced or, when any
 * row is refused, nothing changes. Rejects with the error that aborted it.
 */
export async function replaceAll(d: BackupData): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    for (const table of allTables()) await table.clear();
    await db.accounts.bulkAdd(d.accounts);
    await db.categories.bulkAdd(d.categories);
    await db.entries.bulkAdd(d.entries);
    if (d.plan) await db.plan.add(d.plan);
    await db.guesses.bulkAdd(d.guesses);
    await db.fxRates.bulkAdd(d.fxRates);
    await db.weekResults.bulkAdd(d.weekResults);
    await db.discountVotes.bulkAdd(d.discountVotes);
    if (d.profile) await db.profile.add(d.profile);
  });
}

/**
 * Deletes the whole database, then opens it again and puts the built-in categories back. Dexie does not
 * reopen a deleted database by itself, and categories are otherwise only seeded when the app starts.
 */
export async function deleteEverything(): Promise<void> {
  await db.delete();
  await db.open();
  await ensureSeeded();
}
