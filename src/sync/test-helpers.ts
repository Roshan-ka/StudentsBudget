import { CATEGORIES } from '@/data/categories';
import type { BackupData } from '@/db/bulk';
import type { Entry, Rate } from '@/db/types';
import type { UserDataStore } from './store';
import { byTable, type ServerTable } from './tables';

// Shared by the save and load tests: a phone with a bit of everything, and the account's tables in memory.

export function expense(id: string): Entry {
  return {
    id,
    type: 'expense',
    date: '2026-10-16',
    accountId: 'local',
    categoryId: 'food',
    amountMinor: 650,
    eurMinor: 650,
    note: id,
    createdAt: '2026-10-16T08:00:00.000Z',
  };
}

export const ECB: Rate = { currency: 'INR', perEur: 95, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
export const MANUAL: Rate = { ...ECB, perEur: 97, source: 'manual' };

/** A phone with a bit of everything. */
export function snapshot(overrides: Partial<BackupData> = {}): BackupData {
  return {
    accounts: [
      { id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 50_000, createdAt: 'x' },
      { id: 'home', name: 'Home bank', kind: 'bank', currency: 'INR', openingMinor: 1_000_000, createdAt: 'x' },
    ],
    categories: CATEGORIES,
    entries: [expense('e1'), expense('e2'), expense('rec:s1:2026-10-01')],
    plan: {
      id: 'current',
      cityId: 'regensburg',
      incomes: [],
      fixed: [{ categoryId: 'rent', monthlyMinor: 40_000 }],
      oneOffs: [],
      envelopes: [{ categoryId: 'food', monthlyMinor: 20_000 }],
      createdOn: '2026-10-16',
    },
    guesses: [{ categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' }],
    fxRates: [ECB, MANUAL],
    weekResults: [
      {
        weekStart: '2026-10-12',
        weekEnd: '2026-10-18',
        plannedMinor: 7_000,
        spentMinor: 6_500,
        foodSpentMinor: 4_000,
        eatingOutSpentMinor: 900,
        handLoggedCount: 3,
        paused: false,
        recordedAt: '2026-10-21T08:00:00.000Z',
      },
    ],
    discountVotes: [{ discountId: 'cinema-student', vote: 'works', on: '2026-10-20' }],
    profile: {
      id: 'current',
      name: 'Roshan',
      university: 'ur',
      semesterStart: '',
      semesterEnd: '',
      updatedAt: '2026-10-20T08:00:00.000Z',
    },
    ...overrides,
  };
}

/**
 * The account's tables in memory, for tests: the store, the tables to look at or seed (table → id → data), and every
 * call written down ("list entries", "upsert entries e1,e2", "tombstone entries e2"). A tombstone is kept as null.
 */
/** The ids of a fake table's rows that are not tombstones, sorted. */
export function liveIds(rows: Map<string, unknown>): string[] {
  return [...rows.keys()].filter((id) => rows.get(id) !== null).sort();
}

export function fakeStore(initial: Partial<Record<ServerTable, Record<string, unknown>>> = {}) {
  const tables = byTable((table) => new Map<string, unknown>(Object.entries(initial[table] ?? {})));
  const calls: string[] = [];
  const store: UserDataStore = {
    async listIds(table) {
      calls.push(`list ${table}`);
      return liveIds(tables[table]);
    },
    async listRows(table) {
      calls.push(`read ${table}`);
      return liveIds(tables[table]).map((id) => ({ id, data: tables[table].get(id) }));
    },
    async upsert(table, rows) {
      calls.push(`upsert ${table} ${rows.map((row) => row.id).join(',')}`);
      // Stored as JSON would be: a copy, not the phone's own object.
      for (const row of rows) tables[table].set(row.id, structuredClone(row.data));
    },
    async tombstone(table, ids) {
      calls.push(`tombstone ${table} ${ids.join(',')}`);
      // As the database does: an id it never had gets a tombstone too.
      for (const id of ids) tables[table].set(id, null);
    },
  };
  return { store, tables, calls };
}
