import { CATEGORIES } from '@/data/categories';
import type { IsoDate } from '@/lib/dates';
import { db } from './db';
import type { Entry } from './types';

export class AccountInUseError extends Error {
  constructor() {
    super('This account has entries and cannot be deleted.');
    this.name = 'AccountInUseError';
  }
}

export class AccountHasScheduleError extends Error {
  constructor() {
    super('A fixed cost or income is added to this account automatically, so it cannot be deleted.');
    this.name = 'AccountHasScheduleError';
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

/**
 * What still uses the account: `booked` when an entry is booked on it or transfers into it, `scheduled` when an income
 * or fixed cost of the plan is added to it automatically (paused or not), else null. Reads the entries and the plan, in
 * the caller's transaction when there is one.
 */
export async function accountUse(id: string): Promise<'booked' | 'scheduled' | null> {
  const booked = await db.entries.where('accountId').equals(id).count();
  // No index on toAccountId; a scan is fine at this data size.
  const received = await db.entries.filter((e) => e.type === 'transfer' && e.toAccountId === id).count();
  if (booked + received > 0) return 'booked';
  const plan = await db.plan.get('current');
  if (plan && [...plan.incomes, ...plan.fixed].some((line) => line.schedule?.accountId === id)) return 'scheduled';
  return null;
}

/** Rejects with `AccountInUseError` or `AccountHasScheduleError` while something still uses the account (`accountUse`). */
export async function deleteAccount(id: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.entries, db.plan, async () => {
    const use = await accountUse(id);
    if (use === 'booked') throw new AccountInUseError();
    if (use === 'scheduled') throw new AccountHasScheduleError();
    await db.accounts.delete(id);
  });
}
