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

    expect(await db.categories.count()).toBe(26);
    expect(await db.fxRates.count()).toBe(0);
    expect(db.verno).toBe(4);
    // The version-1 table is gone from the real database, not only from the schema.
    expect(db.backendDB().objectStoreNames.contains('rates')).toBe(false);
    // A database two versions behind gets the version-3 tables too, empty.
    expect(await db.weekResults.count()).toBe(0);
    expect(await db.discountVotes.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
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

  it('upgrades a version-2 database to version 3 and keeps every row', async () => {
    // Start over, then build the database the way a browser that ran version 2 holds it. The schema is
    // declared here as it shipped: version 3 must not need a line of it changed.
    await db.delete();
    const v2 = new Dexie('studentsbudget');
    v2.version(1).stores({
      accounts: 'id',
      categories: 'id, kind',
      entries: 'id, date, accountId, categoryId, type',
      plan: 'id',
      guesses: 'categoryId',
      rates: 'currency',
    });
    v2.version(2).stores({ rates: null, fxRates: '[currency+source], currency' });
    await v2.open();
    const account = { id: 'a1', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 1000, createdAt: '2026-10-01T08:00:00.000Z' };
    const entry = { id: 'e1', type: 'expense', date: '2026-10-16', accountId: 'a1', categoryId: 'food', amountMinor: 650, eurMinor: 650, note: '', createdAt: '2026-10-16T08:00:00.000Z' };
    const plan = { id: 'current', cityId: 'regensburg', incomes: [], fixed: [], oneOffs: [], envelopes: [], createdOn: '2026-10-16' };
    const guess = { categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' };
    const ecb = { currency: 'INR', perEur: 95, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
    const manual = { ...ecb, perEur: 97, source: 'manual' };
    await v2.table('accounts').add(account);
    await v2.table('categories').bulkAdd(CATEGORIES);
    await v2.table('entries').add(entry);
    await v2.table('plan').add(plan);
    await v2.table('guesses').add(guess);
    await v2.table('fxRates').bulkAdd([ecb, manual]);
    expect(v2.verno).toBe(2);
    v2.close();

    await db.open();

    expect(db.verno).toBe(4);
    expect(await db.accounts.toArray()).toEqual([account]);
    expect(await db.categories.count()).toBe(26);
    expect(await db.entries.toArray()).toEqual([entry]);
    expect(await db.plan.toArray()).toEqual([plan]);
    expect(await db.guesses.toArray()).toEqual([guess]);
    expect(await db.fxRates.toArray()).toEqual(expect.arrayContaining<unknown>([ecb, manual]));
    expect(await db.fxRates.count()).toBe(2);
    // The indexes of the old tables came across with their rows.
    expect(await db.entries.where('date').equals('2026-10-16').count()).toBe(1);
    expect(await db.fxRates.where('currency').equals('INR').count()).toBe(2);
    // The three new tables exist in the real database, are empty and are keyed as the brief says.
    const stores = db.backendDB().objectStoreNames;
    for (const store of ['weekResults', 'discountVotes', 'profile']) expect(stores.contains(store)).toBe(true);
    expect(await db.weekResults.count()).toBe(0);
    expect(await db.discountVotes.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);

    const week = { weekStart: '2026-10-12', weekEnd: '2026-10-18', plannedMinor: 7000, spentMinor: 6500, foodSpentMinor: 4000, eatingOutSpentMinor: 900, handLoggedCount: 3, paused: false, recordedAt: '2026-10-19T08:00:00.000Z' } as const;
    const vote = { discountId: 'cinema-student', vote: 'works', on: '2026-10-20' } as const;
    const profile = { id: 'current', name: 'Roshan', university: 'ur', semesterStart: '2026-10-12', semesterEnd: '2027-02-12', updatedAt: '2026-10-20T08:00:00.000Z' } as const;
    await db.weekResults.add(week);
    await db.discountVotes.add(vote);
    await db.profile.add(profile);
    expect(await db.weekResults.get('2026-10-12')).toEqual(week);
    expect(await db.discountVotes.get('cinema-student')).toEqual(vote);
    expect(await db.profile.get('current')).toEqual(profile);
    // One row per week, one vote per discount, one profile: a second one with the same key is refused.
    await expect(db.weekResults.add({ ...week, spentMinor: 1 })).rejects.toThrow();
    await expect(db.discountVotes.add({ ...vote, vote: 'outdated' })).rejects.toThrow();
    await expect(db.profile.add({ ...profile, name: 'Other' })).rejects.toThrow();
  });
});
