import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { setManualRate } from '@/db/rates';
import { deleteEntry, saveEntry } from '@/db/repo';
import type { Plan } from '@/db/types';
import { push } from './push';
import { ECB, expense, fakeStore, liveIds } from './test-helpers';

// Pushes run over the real tracking middleware (registered in db.ts) on fake-indexeddb, into the fake store.

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40_000 }],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 20_000 }],
  createdOn: '2026-10-16',
};

/** The outbox as "table:id", sorted. */
async function queued(): Promise<string[]> {
  return (await db.outbox.toArray()).map((entry) => `${entry.table}:${entry.id}`).sort();
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  // Linked: the middleware records every change to a synced table.
  await db.syncState.put({ id: 'current', userId: 'user-1', cursor: 0, lastSyncedAt: null, problem: null });
  await db.accounts.put({ id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: 'x' });
});

describe('push', () => {
  it('sends a new row, an edit and a delete, and empties the outbox', async () => {
    const { store, tables, calls } = fakeStore();
    await saveEntry(expense('e1'));
    await saveEntry(expense('e2'));
    await push(store);
    expect(liveIds(tables.entries)).toEqual(['e1', 'e2']);
    expect(liveIds(tables.accounts)).toEqual(['local']);
    expect(await queued()).toEqual([]);

    await saveEntry({ ...expense('e1'), note: 'changed' });
    await deleteEntry('e2');
    calls.length = 0;
    expect(await push(store)).toEqual({ sent: 1, deleted: 1 });
    expect(calls).toEqual(['upsert entries e1', 'tombstone entries e2']);
    expect(tables.entries.get('e1')).toMatchObject({ note: 'changed' });
    // A tombstone, so another phone learns of the delete.
    expect(tables.entries.has('e2')).toBe(true);
    expect(tables.entries.get('e2')).toBeNull();
    expect(await queued()).toEqual([]);
  });

  it('keeps an edit made while the row was being sent, for the next push', async () => {
    const { store, tables } = fakeStore();
    await saveEntry(expense('e1'));
    // The person edits the entry while the push is on its way.
    const sending = { ...store };
    sending.upsert = async (table, rows) => {
      await store.upsert(table, rows);
      if (table === 'entries') await saveEntry({ ...expense('e1'), note: 'edited meanwhile' });
    };
    await push(sending);
    expect(await queued()).toEqual(['entries:e1']);

    await push(store);
    expect(tables.entries.get('e1')).toMatchObject({ note: 'edited meanwhile' });
    expect(await queued()).toEqual([]);
  });

  it('keeps the queue when a write is refused, and sends it all on the next push', async () => {
    const { store, tables } = fakeStore();
    await saveEntry(expense('e1'));
    const refusing = { ...store };
    refusing.upsert = async (table, rows) => {
      if (table === 'entries') throw new Error('refused');
      await store.upsert(table, rows);
    };
    await expect(push(refusing)).rejects.toThrow('refused');
    // The tables written before the refused one are done; the refused one and those after it wait.
    expect(await queued()).toEqual(['entries:e1']);
    expect(liveIds(tables.accounts)).toEqual(['local']);

    await push(store);
    expect(liveIds(tables.entries)).toEqual(['e1']);
    expect(await queued()).toEqual([]);
  });

  it('sends a manual rate by its currency, and never an ECB rate', async () => {
    const { store, tables, calls } = fakeStore();
    await db.fxRates.put(ECB);
    await setManualRate('INR', 97, '2026-10-16');
    await push(store);
    expect(calls).toContain('upsert manual_rates INR');
    expect(liveIds(tables.manual_rates)).toEqual(['INR']);
    expect(tables.manual_rates.get('INR')).toMatchObject({ source: 'manual', perEur: 97 });
  });

  it('sends a plan edit as the whole plan row', async () => {
    const { store, tables } = fakeStore();
    await db.plan.put(PLAN);
    await push(store);
    await db.plan.update('current', { envelopes: [{ categoryId: 'food', monthlyMinor: 25_000 }] });
    await push(store);
    expect(tables.plans.get('current')).toEqual({ ...PLAN, envelopes: [{ categoryId: 'food', monthlyMinor: 25_000 }] });
  });

  it('sends nothing when nothing changed', async () => {
    const { store, calls } = fakeStore();
    await db.outbox.clear();
    expect(await push(store)).toEqual({ sent: 0, deleted: 0 });
    expect(calls).toEqual([]);
  });
});
