import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { parseBackup, serializeBackup } from '@/features/backup/backup';
import { recordCompletedWeeks, setAway, weekAwaitingRecord, weekResultOf } from '@/features/badges/week-results';
import { addDays } from '@/lib/dates';
import { deleteEverything, exportAll, replaceAll, type BackupData } from './bulk';
import { db } from './db';
import type { Account, DiscountVote, Entry, Plan, Profile, Rate, WeekResult } from './types';

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

function week(weekStart: string, overrides: Partial<WeekResult> = {}): WeekResult {
  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    plannedMinor: 7_000,
    spentMinor: 6_500,
    foodSpentMinor: 4_000,
    eatingOutSpentMinor: 900,
    handLoggedCount: 3,
    paused: false,
    recordedAt: '2026-10-19T08:00:00.000Z',
    ...overrides,
  };
}

function vote(discountId: string, overrides: Partial<DiscountVote> = {}): DiscountVote {
  return { discountId, vote: 'works', on: '2026-10-20', ...overrides };
}

const PROFILE: Profile = {
  id: 'current',
  name: 'Roshan',
  university: 'ur',
  semesterStart: '2026-10-12',
  semesterEnd: '2027-02-12',
  updatedAt: '2026-10-20T08:00:00.000Z',
};

function backup(overrides: Partial<BackupData> = {}): BackupData {
  return {
    accounts: [account('b1'), account('b2', 'INR')],
    categories: CATEGORIES,
    entries: [expense('new', 'b1')],
    plan: PLAN,
    guesses: [{ categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' }],
    fxRates: [ECB, MANUAL],
    weekResults: [week('2026-10-12'), week('2026-10-19', { paused: true, handLoggedCount: 0 })],
    discountVotes: [vote('cinema-student'), vote('mensa-card', { vote: 'outdated' })],
    profile: PROFILE,
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
  await db.weekResults.bulkAdd([week('2026-09-07'), week('2026-09-14')]);
  await db.discountVotes.bulkAdd([vote('old-discount')]);
  await db.profile.put({ ...PROFILE, name: 'Old name' });
}

async function everyRow() {
  return {
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    entries: await db.entries.toArray(),
    plan: await db.plan.toArray(),
    guesses: await db.guesses.toArray(),
    fxRates: await db.fxRates.toArray(),
    weekResults: await db.weekResults.toArray(),
    discountVotes: await db.discountVotes.toArray(),
    profile: await db.profile.toArray(),
  };
}

/** IndexedDB sorts rows by primary key, so the tables are compared without regard to row order. */
function expectSameData(actual: BackupData, expected: BackupData) {
  for (const table of ['accounts', 'categories', 'entries', 'guesses', 'fxRates', 'weekResults', 'discountVotes'] as const) {
    expect(actual[table]).toHaveLength(expected[table].length);
    expect(actual[table]).toEqual(expect.arrayContaining<unknown>(expected[table]));
  }
  expect(actual.plan).toEqual(expected.plan);
  expect(actual.profile).toEqual(expected.profile);
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('exportAll', () => {
  it('reads every table, both rate rows and the version-3 tables included', async () => {
    await db.accounts.bulkAdd([account('a1')]);
    await db.categories.bulkAdd(CATEGORIES);
    await db.entries.bulkAdd([expense('e1')]);
    await db.plan.put(PLAN);
    await db.guesses.bulkAdd([{ categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' }]);
    await db.fxRates.bulkAdd([ECB, MANUAL]);
    await db.weekResults.bulkAdd([week('2026-10-12'), week('2026-10-19')]);
    await db.discountVotes.bulkAdd([vote('cinema-student')]);
    await db.profile.put(PROFILE);

    const data = await exportAll();

    expect(data.accounts.map((a) => a.id)).toEqual(['a1']);
    expect(data.categories).toHaveLength(26);
    expect(data.entries.map((e) => e.id)).toEqual(['e1']);
    expect(data.plan).toEqual(PLAN);
    expect(data.guesses).toHaveLength(1);
    expect(data.fxRates.map((r) => r.source).sort()).toEqual(['ecb', 'manual']);
    expect(data.weekResults.map((w) => w.weekStart).sort()).toEqual(['2026-10-12', '2026-10-19']);
    expect(data.discountVotes).toEqual([vote('cinema-student')]);
    expect(data.profile).toEqual(PROFILE);
  });

  it('gives a null plan and a null profile before setup', async () => {
    const data = await exportAll();

    expect(data.plan).toBeNull();
    expect(data.profile).toBeNull();
    expect(data.weekResults).toEqual([]);
    expect(data.discountVotes).toEqual([]);
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
    // The demo file is from version 1: whatever the device held in the version-3 tables is gone, nothing replaces it.
    expect(restored.weekResults).toEqual([]);
    expect(restored.discountVotes).toEqual([]);
    expect(restored.profile).toBeNull();
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
    expect(rows.weekResults.map((w) => w.weekStart).sort()).toEqual(['2026-10-12', '2026-10-19']);
    expect(await db.weekResults.get('2026-09-07')).toBeUndefined();
    expect(rows.discountVotes.map((v) => `${v.discountId}:${v.vote}`).sort()).toEqual(['cinema-student:works', 'mensa-card:outdated']);
    expect(await db.discountVotes.get('old-discount')).toBeUndefined();
    expect(rows.profile).toEqual([PROFILE]);
  });

  it('restores a version 2 file, and the version-3 tables end up empty', async () => {
    await fillWithOldData();
    const file = JSON.parse(serializeBackup(backup(), new Date('2026-10-16T10:00:00.000Z'))) as {
      version: number;
      data: Record<string, unknown>;
    };
    file.version = 2;
    for (const key of ['weekResults', 'discountVotes', 'profile']) delete file.data[key];
    const parsed = parseBackup(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);

    await replaceAll(parsed.data);

    const rows = await everyRow();
    expect(rows.entries.map((e) => e.id)).toEqual(['new']);
    expect(rows.weekResults).toEqual([]);
    expect(rows.discountVotes).toEqual([]);
    expect(rows.profile).toEqual([]);
  });

  it('empties the plan table when the backup has no plan', async () => {
    await fillWithOldData();

    await replaceAll(backup({ plan: null }));

    expect(await db.plan.count()).toBe(0);
  });

  it('keeps the profile one row, and empties it when the backup has none', async () => {
    await fillWithOldData();

    await replaceAll(backup());
    expect(await db.profile.toArray()).toEqual([PROFILE]);

    await replaceAll(backup({ profile: null }));
    expect(await db.profile.count()).toBe(0);
  });

  it('leaves the old data untouched when a row breaks a constraint', async () => {
    await fillWithOldData();
    const before = await everyRow();

    // Passes the schema check, but two entries share an id.
    await expect(replaceAll(backup({ entries: [expense('dup', 'b1'), expense('dup', 'b1')] }))).rejects.toThrow();

    expect(await everyRow()).toEqual(before);
  });

  it('leaves the old data untouched when the rates fail', async () => {
    await fillWithOldData();
    const before = await everyRow();

    await expect(replaceAll(backup({ fxRates: [ECB, ECB] }))).rejects.toThrow();

    expect(await everyRow()).toEqual(before);
  });

  it.each([
    ['two results for one week', { weekResults: [week('2026-10-12'), week('2026-10-12')] }],
    ['two votes for one discount', { discountVotes: [vote('cinema-student'), vote('cinema-student')] }],
  ])('leaves the old data untouched when a version-3 table has %s', async (_name, overrides) => {
    await fillWithOldData();
    const before = await everyRow();

    await expect(replaceAll(backup(overrides))).rejects.toThrow();

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
    // The weekly results, votes and profile came through the file too.
    expect((await db.weekResults.toArray()).map((w) => w.weekStart).sort()).toEqual(['2026-09-07', '2026-09-14']);
    expect(await db.discountVotes.toArray()).toEqual([vote('old-discount')]);
    expect(await db.profile.toArray()).toEqual([{ ...PROFILE, name: 'Old name' }]);
  });
});

describe('restoring and the saved weeks', () => {
  const NOW = new Date('2026-11-02T10:00:00.000Z');

  /** Spending typed in by hand on the day it is for. */
  function spent(id: string, date: string, eurMinor: number): Entry {
    return { ...expense(id), date, amountMinor: eurMinor, eurMinor, createdAt: `${date}T12:00:00.000Z` };
  }

  // Set up on Friday 16 October, with groceries logged in each week up to the week of 2 November.
  const ENTRIES = [
    spent('w1', '2026-10-17', 1000),
    spent('w2', '2026-10-20', 2000),
    spent('w3', '2026-10-28', 1500),
    spent('w4', '2026-11-02', 1200),
  ];

  async function deviceWithPlan() {
    await db.accounts.bulkAdd([account('a1')]);
    await db.categories.bulkAdd(CATEGORIES);
    await db.plan.put(PLAN);
    await db.entries.bulkAdd(ENTRIES);
  }

  /** Writes the device to a file, wipes it, and restores the file, as Restore does after Delete everything. */
  async function throughAFile(): Promise<BackupData> {
    const parsed = parseBackup(serializeBackup(await exportAll(), NOW));
    if (!parsed.ok) throw new Error(parsed.error);
    await Promise.all(db.tables.map((table) => table.clear()));
    await replaceAll(parsed.data);
    return parsed.data;
  }

  it("restores the app's own export, recorded weeks and away marks included, and the marks become weeks away", async () => {
    await deviceWithPlan();
    // Monday 2 November: two weeks are recorded, last week waits, and both last week and this week are marked away.
    expect(await recordCompletedWeeks('2026-11-02')).toEqual({ recorded: 2 });
    const lastWeek = weekAwaitingRecord(PLAN, '2026-11-02');
    if (lastWeek === null) throw new Error('last week waits on a Monday');
    await setAway(lastWeek.start, true);
    await setAway('2026-11-02', true);
    const before = await exportAll();
    expect(before.weekResults.map((w) => [w.weekStart, w.paused, w.recordedAt === ''])).toEqual([
      ['2026-10-12', false, false],
      ['2026-10-19', false, false],
      ['2026-10-26', true, true],
      ['2026-11-02', true, true],
    ]);

    // The file passes every check, the week checks included, and every row comes back as it was.
    const restored = await throughAFile();
    expectSameData(restored, before);
    expectSameData(await exportAll(), before);

    // The next open on Wednesday records last week as a week away, with what was spent in it; this week waits.
    expect(await recordCompletedWeeks('2026-11-04')).toEqual({ recorded: 1 });
    expect(await db.weekResults.get('2026-10-26')).toMatchObject({
      ...weekResultOf(PLAN, ENTRIES, { start: '2026-10-26', end: '2026-11-01' }),
      foodSpentMinor: 1500,
      paused: true,
    });
    expect((await db.weekResults.get('2026-11-02'))?.recordedAt).toBe('');
    // The weeks recorded before the backup were not written again.
    for (const weekStart of ['2026-10-12', '2026-10-19']) {
      expect(await db.weekResults.get(weekStart)).toEqual(before.weekResults.find((w) => w.weekStart === weekStart));
    }
  });

  it('records a mark restored long after its week as a week away, on the next open', async () => {
    await deviceWithPlan();
    await setAway('2026-11-02', true);
    await throughAFile();

    // Restored and opened on Wednesday 25 November: every week since setup is recorded, the marked one as a week away.
    expect(await recordCompletedWeeks('2026-11-25')).toEqual({ recorded: 6 });
    const weeks = await db.weekResults.orderBy('weekStart').toArray();
    expect(weeks.map((w) => [w.weekStart, w.paused])).toEqual([
      ['2026-10-12', false],
      ['2026-10-19', false],
      ['2026-10-26', false],
      ['2026-11-02', true],
      ['2026-11-09', false],
      ['2026-11-16', false],
    ]);
    expect(weeks[3]).toMatchObject({ foodSpentMinor: 1200, handLoggedCount: 1 });
    expect(weeks.every((w) => w.recordedAt !== '')).toBe(true);
  });

  it('backfills every week since setup on the next open after restoring an old file without saved weeks', async () => {
    await deviceWithPlan();
    // A version 2 file, from before weeks were saved.
    const file = JSON.parse(serializeBackup(await exportAll(), NOW)) as { version: number; data: Record<string, unknown> };
    file.version = 2;
    for (const key of ['weekResults', 'discountVotes', 'profile']) delete file.data[key];
    const parsed = parseBackup(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);
    // Another device's data, saved weeks included, which the restore replaces.
    await Promise.all(db.tables.map((table) => table.clear()));
    await fillWithOldData();

    await replaceAll(parsed.data);
    expect(await db.weekResults.count()).toBe(0);

    expect(await recordCompletedWeeks('2026-11-04')).toEqual({ recorded: 3 });
    const weeks = await db.weekResults.orderBy('weekStart').toArray();
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    for (const w of weeks) {
      expect(w).toMatchObject({ ...weekResultOf(PLAN, ENTRIES, { start: w.weekStart, end: w.weekEnd }), paused: false });
    }
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
    expect(rows.weekResults).toEqual([]);
    expect(rows.discountVotes).toEqual([]);
    expect(rows.profile).toEqual([]);
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
