import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { db, requestPersistence } from './db';
import {
  AccountInUseError,
  GuessesLockedError,
  deleteAccount,
  deleteEntry,
  ensureSeeded,
  entriesInRange,
  saveEntry,
  saveGuesses,
} from './repo';
import type { Account, Entry, Guess } from './types';

const FLEXIBLE_IDS = [
  'food',
  'eating-out',
  'going-out',
  'transport',
  'shopping',
  'health',
  'personal-care',
  'study',
  'household',
  'travel',
  'gifts',
  'other',
];

const NEW_IDS = ['health', 'personal-care', 'study', 'household', 'travel', 'gifts', 'gym', 'utilities'];

/** The 18 built-in rows a database held before the new categories: their ids, kinds and positions in the old list. */
function oldRows() {
  return CATEGORIES.filter((c) => !NEW_IDS.includes(c.id)).map((c, order) => ({ ...c, order }));
}

function account(id: string): Account {
  return { id, name: id, kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' };
}

function expense(id: string, date: string, accountId = 'a1'): Entry {
  return {
    id,
    type: 'expense',
    date,
    accountId,
    categoryId: 'food',
    amountMinor: 650,
    eurMinor: 650,
    note: '',
    createdAt: '2026-10-01T08:00:00.000Z',
  };
}

function transfer(id: string, accountId: string, toAccountId: string): Entry {
  return {
    id,
    type: 'transfer',
    date: '2026-10-05',
    accountId,
    toAccountId,
    amountMinor: 10_000,
    toAmountMinor: 10_000,
    eurMinor: 10_000,
    note: '',
    createdAt: '2026-10-05T08:00:00.000Z',
  };
}

function guess(categoryId: string, monthlyMinor: number): Guess {
  return { categoryId, monthlyMinor, guessedOn: '2026-10-16' };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('ensureSeeded', () => {
  it('seeds the 26 categories once', async () => {
    await ensureSeeded();
    await ensureSeeded();

    expect(await db.categories.count()).toBe(26);
  });

  it('seeds once even when called concurrently', async () => {
    await Promise.all([ensureSeeded(), ensureSeeded()]);

    expect(await db.categories.count()).toBe(26);
  });

  it('seeds the categories in the specified order', async () => {
    await ensureSeeded();

    // `order` is not an index in the schema, so sort in memory.
    const categories = (await db.categories.toArray()).sort((a, b) => a.order - b.order);
    expect(categories.map((c) => c.id)).toEqual([
      ...FLEXIBLE_IDS,
      'rent',
      'phone',
      'insurance',
      'subscriptions',
      'transport-pass',
      'gym',
      'utilities',
      'one-off',
      'income-job',
      'income-parents',
      'income-bafoeg',
      'income-sperrkonto',
      'income-scholarship',
      'income-other',
    ]);
    expect(categories.map((c) => c.order)).toEqual(Array.from({ length: 26 }, (_, i) => i));
    expect(categories.filter((c) => c.kind === 'flexible').map((c) => c.id)).toEqual(FLEXIBLE_IDS);
    expect(categories.filter((c) => c.kind === 'fixed')).toHaveLength(7);
    expect(categories.filter((c) => c.kind === 'oneoff')).toHaveLength(1);
    expect(categories.filter((c) => c.kind === 'income')).toHaveLength(6);
  });

  it('adds the new categories to a database that holds the 18 old ones, and corrects the orders', async () => {
    await db.categories.bulkAdd(oldRows());

    await ensureSeeded();

    expect(await db.categories.count()).toBe(26);
    // Every built-in row now equals the constant, so `other` and the rows after it moved up.
    expect((await db.categories.toArray()).sort((a, b) => a.order - b.order)).toEqual(CATEGORIES);
  });

  it('leaves a row that is not built in alone', async () => {
    const mine = { id: 'my-own', name: 'My own', kind: 'flexible' as const, order: 99 };
    await db.categories.bulkAdd([...oldRows(), mine]);

    await ensureSeeded();

    expect(await db.categories.count()).toBe(27);
    expect(await db.categories.get('my-own')).toEqual(mine);
  });

  it('puts a built-in row back to the name, kind and order of the constant', async () => {
    await db.categories.put({ id: 'food', name: 'Custom', kind: 'fixed', order: 99 });

    await ensureSeeded();

    expect(await db.categories.count()).toBe(26);
    expect(await db.categories.get('food')).toEqual(CATEGORIES[0]);
  });
});

describe('entries', () => {
  it('entriesInRange includes both edge dates', async () => {
    await saveEntry(expense('e1', '2026-10-01'));
    await saveEntry(expense('e2', '2026-10-31'));
    await saveEntry(expense('e3', '2026-11-01'));

    const found = await entriesInRange('2026-10-01', '2026-10-31');

    expect(found.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('saveEntry replaces an entry with the same id', async () => {
    await saveEntry(expense('e1', '2026-10-01'));
    await saveEntry({ ...expense('e1', '2026-10-02'), note: 'edited' });

    const found = await entriesInRange('2026-10-01', '2026-10-31');

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ date: '2026-10-02', note: 'edited' });
  });

  it('deleteEntry removes the entry', async () => {
    await saveEntry(expense('e1', '2026-10-01'));
    await saveEntry(expense('e2', '2026-10-02'));

    await deleteEntry('e1');

    expect((await entriesInRange('2026-10-01', '2026-10-31')).map((e) => e.id)).toEqual(['e2']);
  });
});

describe('saveGuesses', () => {
  it('saveGuesses refuses to overwrite', async () => {
    await saveGuesses([guess('food', 20_000)]);

    await expect(saveGuesses([guess('food', 99_999)])).rejects.toBeInstanceOf(GuessesLockedError);
    expect(await db.guesses.toArray()).toEqual([guess('food', 20_000)]);
  });
});

describe('deleteAccount', () => {
  it('deleteAccount refuses an account with entries', async () => {
    await db.accounts.bulkAdd([account('a1'), account('a2')]);
    await saveEntry(expense('e1', '2026-10-01', 'a1'));

    await expect(deleteAccount('a1')).rejects.toBeInstanceOf(AccountInUseError);

    expect(await db.accounts.get('a1')).toBeDefined();
  });

  it('deleteAccount refuses an account that only receives a transfer', async () => {
    await db.accounts.bulkAdd([account('a1'), account('a2')]);
    await saveEntry(transfer('t1', 'a1', 'a2'));

    await expect(deleteAccount('a2')).rejects.toBeInstanceOf(AccountInUseError);

    expect(await db.accounts.get('a2')).toBeDefined();
  });

  it('deletes an unused account', async () => {
    await db.accounts.bulkAdd([account('a1'), account('a2')]);
    await saveEntry(expense('e1', '2026-10-01', 'a1'));

    await deleteAccount('a2');

    expect(await db.accounts.get('a2')).toBeUndefined();
    expect(await db.accounts.get('a1')).toBeDefined();
  });
});

describe('requestPersistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when the Storage API is unavailable', async () => {
    vi.stubGlobal('navigator', {});

    expect(await requestPersistence()).toBe(false);
  });

  it('returns what navigator.storage.persist() resolves to', async () => {
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(true) } });

    expect(await requestPersistence()).toBe(true);
  });

  it('returns false instead of throwing when persist() fails', async () => {
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('denied')) } });

    expect(await requestPersistence()).toBe(false);
  });
});
