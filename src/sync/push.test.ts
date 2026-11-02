import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { setManualRate } from '@/db/rates';
import { deleteAccount, deleteEntry, saveEntry } from '@/db/repo';
import type { Plan } from '@/db/types';
import { automatic } from './automatic';
import { push } from './push';
import { ECB, expense, fakeStore, liveIds } from './test-helpers';
import { untracked } from './untracked';

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
    expect(await push(store)).toEqual({ sent: 1, deleted: 1, held: 0 });
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
    expect(await push(store)).toEqual({ sent: 0, deleted: 0, held: 0 });
    expect(calls).toEqual([]);
  });
});

// What the poster adds on its own (recurring entries, and the plan's watermarks) goes to the account only where the
// account has nothing yet: a phone that hasn't synced posts from what it knew, and must not undo what another phone
// changed meanwhile (triage row 2, P2.2 chunk 9).
describe('automatic rows', () => {
  const RENT_ID = 'rec:rent-s:2026-11';
  const rent = (amountMinor: number) => ({ ...expense(RENT_ID), amountMinor, eurMinor: amountMinor });
  const scheduled = (postedThrough: string, monthlyMinor = 40_000): Plan => ({
    ...PLAN,
    fixed: [
      {
        categoryId: 'rent',
        monthlyMinor,
        schedule: { id: 'rent-s', frequency: 'monthly', day: 1, accountId: 'local', amountMinor: monthlyMinor, startOn: '2026-10-17', postedThrough },
      },
    ],
  });

  it('marks what the poster writes, and adds an entry the account doesn’t have yet', async () => {
    const { store, tables, calls } = fakeStore();
    await automatic([db.entries], () => db.entries.put(rent(40_000)));
    expect(await db.outbox.get(['entries', RENT_ID])).toMatchObject({ auto: true });
    await push(store);
    expect(calls).toContain(`insert entries ${RENT_ID}`);
    expect(tables.entries.get(RENT_ID)).toMatchObject({ amountMinor: 40_000 });
    expect(await queued()).toEqual([]);
  });

  it('never writes over the account’s copy: an edit made on another phone wins, here too', async () => {
    const { store, tables } = fakeStore({ entries: { [RENT_ID]: rent(41_000) } });
    await automatic([db.entries], () => db.entries.put(rent(40_000)));
    await push(store);
    expect(tables.entries.get(RENT_ID)).toMatchObject({ amountMinor: 41_000 });
    expect(await db.entries.get(RENT_ID)).toMatchObject({ amountMinor: 41_000 });
    expect(await queued()).toEqual([]);
  });

  it('never brings back an entry deleted on another phone', async () => {
    const { store, tables } = fakeStore({ entries: { [RENT_ID]: null } });
    await automatic([db.entries], () => db.entries.put(rent(40_000)));
    await push(store);
    expect(tables.entries.get(RENT_ID)).toBeNull();
    expect(await db.entries.get(RENT_ID)).toBeUndefined();
    expect(await queued()).toEqual([]);
  });

  it('sends the person’s edit of a posted entry as an edit', async () => {
    const { store, tables } = fakeStore({ entries: { [RENT_ID]: rent(41_000) } });
    await automatic([db.entries], () => db.entries.put(rent(40_000)));
    await saveEntry(rent(39_000));
    expect((await db.outbox.get(['entries', RENT_ID]))?.auto).toBeUndefined();
    await push(store);
    expect(tables.entries.get(RENT_ID)).toMatchObject({ amountMinor: 39_000 });
  });

  it('keeps a change the person made first as theirs when the poster writes the row again', async () => {
    const { store, tables } = fakeStore({ plans: { current: scheduled('2026-10-31', 41_000) } });
    await db.plan.put(scheduled('2026-10-31', 45_000));
    await automatic([db.plan], () => db.plan.put(scheduled('2026-11-30', 45_000)));
    expect((await db.outbox.get(['plans', 'current']))?.auto).toBeUndefined();
    await push(store);
    expect(tables.plans.get('current')).toEqual(scheduled('2026-11-30', 45_000));
  });

  it('never writes the poster’s moved watermark over the account’s plan, and keeps it on the phone', async () => {
    // Another phone changed the rent; this one only posted November, which moved its watermark.
    const { store, tables } = fakeStore({ plans: { current: scheduled('2026-10-31', 41_000) } });
    await untracked([db.plan], () => db.plan.put(scheduled('2026-10-31')));
    await automatic([db.plan], () => db.plan.put(scheduled('2026-11-30')));
    await push(store);
    expect(tables.plans.get('current')).toEqual(scheduled('2026-10-31', 41_000));
    expect(await db.plan.get('current')).toEqual(scheduled('2026-11-30', 41_000));
    expect(await queued()).toEqual([]);
  });
});

// Rules between rows (an entry needs its account) hold on the account too, even when a push stops halfway: every row
// goes before any delete, and entries are deleted before the accounts they were on (triage row 5, P2.2 chunk 9).
describe('push order', () => {
  it('sends every row before any delete, and deletes entries before the account they were on', async () => {
    const { store, calls } = fakeStore();
    await db.accounts.put({ id: 'old', name: 'Old bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: 'x' });
    await saveEntry({ ...expense('on-old'), accountId: 'old' });
    await push(store);
    await deleteEntry('on-old');
    await deleteAccount('old');
    await saveEntry(expense('new'));
    calls.length = 0;
    await push(store);
    expect(calls).toEqual(['upsert entries new', 'tombstone entries on-old', 'tombstone accounts old']);
  });
});

// A row this app's own checks refuse would stop every phone's pull at "This app needs an update" (triage row 11,
// P2.2 chunk 11). So push checks each row as a pull would, and holds back the ones that fail.
describe('rows the app can’t check', () => {
  it('holds back a row its own checks refuse, keeps it queued, and sends the rest', async () => {
    const { store, tables, calls } = fakeStore();
    await push(store);
    calls.length = 0;
    // Written past the app's own checks: a fraction of a cent.
    await db.entries.put({ ...expense('bad'), amountMinor: 1.5 });
    await saveEntry(expense('good'));
    expect(await push(store)).toEqual({ sent: 1, deleted: 0, held: 1 });
    expect(calls).toEqual(['upsert entries good']);
    expect(tables.entries.has('bad')).toBe(false);
    expect(await queued()).toEqual(['entries:bad']);
  });
});
