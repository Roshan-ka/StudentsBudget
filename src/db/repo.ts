import { CATEGORIES } from '@/data/categories';
import type { IsoDate } from '@/lib/dates';
import { db } from './db';
import type { Entry, Guess } from './types';

export class GuessesLockedError extends Error {
  constructor() {
    super('Guesses are saved once and cannot be changed.');
    this.name = 'GuessesLockedError';
  }
}

export class AccountInUseError extends Error {
  constructor() {
    super('This account has entries and cannot be deleted.');
    this.name = 'AccountInUseError';
  }
}

/**
 * Brings the built-in categories up to date: adds each one that is missing and rewrites each whose name, kind or
 * order differs from the constant (the orders shift when a category is added). Rows that are not built in are left
 * alone. That repairs a database from an older version and a restored version 1 backup. The read and the writes
 * share one transaction, so concurrent calls seed once.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const stored = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const outdated = CATEGORIES.filter((c) => {
      const row = stored.get(c.id);
      return row === undefined || row.name !== c.name || row.kind !== c.kind || row.order !== c.order;
    });
    if (outdated.length > 0) await db.categories.bulkPut(outdated);
  });
}

/** Adds the entry, or replaces the one with the same id. */
export async function saveEntry(e: Entry): Promise<void> {
  await db.entries.put(e);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

/** Entries dated from `from` to `to`, both days included. */
export async function entriesInRange(from: IsoDate, to: IsoDate): Promise<Entry[]> {
  return db.entries.where('date').between(from, to, true, true).toArray();
}

/** Guesses are saved once in setup. Rejects with `GuessesLockedError` when any exist. */
export async function saveGuesses(gs: Guess[]): Promise<void> {
  await db.transaction('rw', db.guesses, async () => {
    if ((await db.guesses.count()) > 0) throw new GuessesLockedError();
    await db.guesses.bulkAdd(gs);
  });
}

/** Rejects with `AccountInUseError` when an entry is booked on the account or transfers into it. */
export async function deleteAccount(id: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.entries, async () => {
    const booked = await db.entries.where('accountId').equals(id).count();
    // No index on toAccountId; a scan is fine at this data size.
    const received = await db.entries.filter((e) => e.type === 'transfer' && e.toAccountId === id).count();
    if (booked + received > 0) throw new AccountInUseError();
    await db.accounts.delete(id);
  });
}
