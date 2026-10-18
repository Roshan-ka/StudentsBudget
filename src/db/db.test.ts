import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { db } from './db';

describe('schema upgrade', () => {
  it('upgrades a version-1 database', async () => {
    // Build the database the way a browser that ran Task 3 holds it: schema version 1, categories seeded.
    // Importing `db` opens nothing, so this runs before the app's `db` touches IndexedDB.
    const v1 = new Dexie('studentsbudget');
    v1.version(1).stores({
      accounts: 'id',
      categories: 'id, kind',
      entries: 'id, date, accountId, categoryId, type',
      plan: 'id',
      guesses: 'categoryId',
      rates: 'currency',
    });
    await v1.open();
    await v1.table('categories').bulkAdd(CATEGORIES);
    await v1.table('rates').put({
      currency: 'INR',
      perEur: 95,
      rateDate: '2026-10-15',
      fetchedOn: '2026-10-15',
      source: 'ecb',
    });
    expect(v1.verno).toBe(1);
    v1.close();

    await db.open();

    expect(await db.categories.count()).toBe(18);
    expect(await db.fxRates.count()).toBe(0);
    expect(db.verno).toBe(2);
    // The version-1 table is gone from the real database, not only from the schema.
    expect(db.backendDB().objectStoreNames.contains('rates')).toBe(false);
  });

  it('keeps the manual and the ECB rate of one currency side by side', async () => {
    await db.open();

    await db.fxRates.bulkPut([
      { currency: 'INR', perEur: 95, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' },
      { currency: 'INR', perEur: 97, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'manual' },
    ]);

    expect(await db.fxRates.count()).toBe(2);
    expect((await db.fxRates.where('currency').equals('INR').toArray()).map((r) => r.source).sort()).toEqual([
      'ecb',
      'manual',
    ]);
  });
});
