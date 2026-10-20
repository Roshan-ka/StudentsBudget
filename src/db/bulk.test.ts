import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { parseBackup, serializeBackup } from '@/features/backup/backup';
import { deleteEverything, exportAll, replaceAll, type BackupData } from './bulk';
import { db } from './db';
import type { Account, Entry, Plan, Rate } from './types';

function account(id: string, currency: Account['currency'] = 'EUR'): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor: 1000, createdAt: '2026-10-01T08:00:00.000Z' };
}

function expense(id: string, accountId = 'a1'): Entry {
  return {
    id,
    type: 'expense',
    date: '2026-10-16',
    accountId,
    categoryId: 'food',
    amountMinor: 650,
    eurMinor: 650,
    note: id,
    createdAt: '2026-10-16T08:00:00.000Z',
  };
}

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [{ categoryId: 'income-job', monthlyMinor: 40_000 }],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40_000 }],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 31_000 }],
  createdOn: '2026-10-16',
};

const ECB: Rate = { currency: 'INR', perEur: 95, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
const MANUAL: Rate = { ...ECB, perEur: 97, source: 'manual' };

function backup(overrides: Partial<BackupData> = {}): BackupData {
  return {
    accounts: [account('b1'), account('b2', 'INR')],
    categories: CATEGORIES,
    entries: [expense('new', 'b1')],
    plan: PLAN,
    guesses: [{ categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' }],
    fxRates: [ECB, MANUAL],
    ...overrides,
  };
}

async function fillWithOldData() {
  await db.accounts.bulkAdd([account('a1')]);
  await db.categories.bulkAdd([{ id: 'old-category', name: 'Old', kind: 'flexible', order: 0 }]);
  await db.entries.bulkAdd([expense('old', 'a1')]);
  await db.plan.put({ ...PLAN, createdOn: '2026-09-01' });
  await db.guesses.bulkAdd([{ categoryId: 'transport', monthlyMinor: 1000, guessedOn: '2026-09-01' }]);
  await db.fxRates.bulkAdd([{ ...ECB, perEur: 90 }]);
}

async function everyRow() {
  return {
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    entries: await db.entries.toArray(),
    plan: await db.plan.toArray(),
    guesses: await db.guesses.toArray(),
    fxRates: await db.fxRates.toArray(),
  };
}

/** IndexedDB sorts rows by primary key, so the tables are compared without regard to row order. */
function expectSameData(actual: BackupData, expected: BackupData) {
  for (const table of ['accounts', 'categories', 'entries', 'guesses', 'fxRates'] as const) {
    expect(actual[table]).toHaveLength(expected[table].length);
    expect(actual[table]).toEqual(expect.arrayContaining<unknown>(expected[table]));
  }
  expect(actual.plan).toEqual(expected.plan);
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('exportAll', () => {
  it('reads every table, both rate rows included', async () => {
    await db.accounts.bulkAdd([account('a1')]);
    await db.categories.bulkAdd(CATEGORIES);
    await db.entries.bulkAdd([expense('e1')]);
    await db.plan.put(PLAN);
    await db.guesses.bulkAdd([{ categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' }]);
    await db.fxRates.bulkAdd([ECB, MANUAL]);

    const data = await exportAll();

    expect(data.accounts.map((a) => a.id)).toEqual(['a1']);
    expect(data.categories).toHaveLength(26);
    expect(data.entries.map((e) => e.id)).toEqual(['e1']);
    expect(data.plan).toEqual(PLAN);
    expect(data.guesses).toHaveLength(1);
    expect(data.fxRates.map((r) => r.source).sort()).toEqual(['ecb', 'manual']);
  });

  it('gives a null plan before setup', async () => {
    expect((await exportAll()).plan).toBeNull();
  });
});

describe('replaceAll', () => {
  it('restores the downloadable demo backup without losing any rows', async () => {
    const text = readFileSync(new URL('../../fixtures/studentsbudget-demo-2026-10.json', import.meta.url), 'utf8');
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    await fillWithOldData();

    await replaceAll(parsed.data);

    const restored = await exportAll();
    expectSameData(restored, parsed.data);
    expect(restored.entries).toHaveLength(47);
    // The demo file is from before the new categories: it lists 18, and the restore adds the rest.
    expect(restored.categories).toHaveLength(26);
    const accountIds = new Set(restored.accounts.map((a) => a.id));
    const categoryIds = new Set(restored.categories.map((c) => c.id));
    for (const entry of restored.entries) {
      expect(accountIds.has(entry.accountId)).toBe(true);
      if (entry.type === 'transfer') expect(accountIds.has(entry.toAccountId)).toBe(true);
      else expect(categoryIds.has(entry.categoryId)).toBe(true);
    }
  });

  it('puts all 26 built-in categories on the device when the file lists only some of them', async () => {
    await fillWithOldData();
    const text = serializeBackup(backup({ categories: CATEGORIES.slice(0, 5) }), new Date('2026-10-16T10:00:00.000Z'));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);

    await replaceAll(parsed.data);

    const stored = await db.categories.toArray();
    expect(stored).toHaveLength(26);
    expect(stored).toEqual(expect.arrayContaining<unknown>(CATEGORIES));
    expect(await db.categories.get('old-category')).toBeUndefined();
  });

  it('replaces the existing rows of every table', async () => {
    await fillWithOldData();

    await replaceAll(backup());

    const rows = await everyRow();
    expect(rows.accounts.map((a) => a.id).sort()).toEqual(['b1', 'b2']);
    expect(rows.categories).toHaveLength(26);
    expect(rows.entries.map((e) => e.id)).toEqual(['new']);
    expect(await db.entries.get('old')).toBeUndefined();
    expect(rows.plan).toEqual([PLAN]);
    expect(rows.guesses.map((g) => g.categoryId)).toEqual(['food']);
    expect(rows.fxRates.map((r) => `${r.source}:${r.perEur}`).sort()).toEqual(['ecb:95', 'manual:97']);
  });

  it('empties the plan table when the backup has no plan', async () => {
    await fillWithOldData();

    await replaceAll(backup({ plan: null }));

    expect(await db.plan.count()).toBe(0);
  });

  it('leaves the old data untouched when a row breaks a constraint', async () => {
    await fillWithOldData();
    const before = await everyRow();

    // Passes the schema check, but two entries share an id.
    await expect(replaceAll(backup({ entries: [expense('dup', 'b1'), expense('dup', 'b1')] }))).rejects.toThrow();

    expect(await everyRow()).toEqual(before);
  });

  it('leaves the old data untouched when the last table fails', async () => {
    await fillWithOldData();
    const before = await everyRow();

    await expect(replaceAll(backup({ fxRates: [ECB, ECB] }))).rejects.toThrow();

    expect(await everyRow()).toEqual(before);
  });

  it('restores what exportAll read, through a file', async () => {
    await fillWithOldData();
    await db.fxRates.put(MANUAL);
    const text = serializeBackup(await exportAll(), new Date('2026-10-16T10:00:00.000Z'));
    await Promise.all(db.tables.map((table) => table.clear()));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);

    await replaceAll(parsed.data);

    // The one category the device had, and the 25 built-in ones the file did not list.
    expectSameData(await exportAll(), parsed.data);
    expect((await db.categories.toArray()).length).toBe(27);
    expect((await db.fxRates.toArray()).map((r) => r.source).sort()).toEqual(['ecb', 'manual']);
  });
});

describe('deleteEverything', () => {
  it('leaves nothing but the 26 reseeded categories, in a database that is open', async () => {
    await fillWithOldData();

    await deleteEverything();

    expect(db.isOpen()).toBe(true);
    const rows = await everyRow();
    expect(rows.accounts).toEqual([]);
    expect(rows.entries).toEqual([]);
    expect(rows.plan).toEqual([]);
    expect(rows.guesses).toEqual([]);
    expect(rows.fxRates).toEqual([]);
    expect(rows.categories).toHaveLength(26);
    expect(await db.categories.get('old-category')).toBeUndefined();
    expect(await db.categories.get('food')).toBeDefined();
  });

  it('works on a database that is already empty', async () => {
    await deleteEverything();

    expect(db.isOpen()).toBe(true);
    expect(await db.categories.count()).toBe(26);
  });
});
