import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { saveEntry } from '@/db/repo';
import { pull, UPDATE_NEEDED } from './pull';
import { push } from './push';
import { expense, fakeStore, MANUAL } from './test-helpers';

// Pulls into fake-indexeddb, with the real tracking middleware (registered in db.ts), from the fake store. The other
// phone is played by writing to the store as its push would.

const LOCAL = { id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: 'x' } as const;

async function cursor(): Promise<number> {
  return (await db.syncState.get('current'))?.cursor ?? -1;
}

/** The outbox as "table:id", sorted. */
async function queued(): Promise<string[]> {
  return (await db.outbox.toArray()).map((entry) => `${entry.table}:${entry.id}`).sort();
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  // Linked, so the middleware would record any write that isn't marked untracked.
  await db.syncState.put({ id: 'current', userId: 'user-1', cursor: 0, lastSyncedAt: null, problem: null });
});

describe('pull', () => {
  it('brings the other phone’s rows, edits and deletes, without sending them back', async () => {
    const { store } = fakeStore();
    await store.upsert('accounts', [{ id: 'local', data: LOCAL }]);
    await store.upsert('entries', [
      { id: 'e1', data: expense('e1') },
      { id: 'e2', data: expense('e2') },
    ]);
    await store.upsert('manual_rates', [{ id: 'INR', data: MANUAL }]);
    expect(await pull(store)).toEqual({ kind: 'done', applied: 4, cursor: 4 });
    expect((await db.entries.toArray()).map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(await db.fxRates.get(['INR', 'manual'])).toEqual(MANUAL);
    expect(await queued()).toEqual([]);

    await store.upsert('entries', [{ id: 'e1', data: { ...expense('e1'), note: 'changed there' } }]);
    await store.tombstone('entries', ['e2']);
    await store.tombstone('manual_rates', ['INR']);
    await pull(store);
    expect(await db.entries.get('e1')).toMatchObject({ note: 'changed there' });
    expect(await db.entries.get('e2')).toBeUndefined();
    expect(await db.fxRates.get(['INR', 'manual'])).toBeUndefined();
    expect(await queued()).toEqual([]);
    expect(await cursor()).toBe(7);
  });

  it('leaves a change still waiting on this phone, which then wins with the next push', async () => {
    const { store, tables } = fakeStore();
    await db.accounts.put(LOCAL);
    await saveEntry({ ...expense('e1'), note: 'mine' });
    await store.upsert('entries', [{ id: 'e1', data: { ...expense('e1'), note: 'theirs' } }]);
    await pull(store);
    expect(await db.entries.get('e1')).toMatchObject({ note: 'mine' });
    expect(await cursor()).toBe(1);

    await push(store);
    expect(tables.entries.get('e1')).toMatchObject({ note: 'mine' });
  });

  it('stops at a row it can’t read, changing nothing and keeping the cursor', async () => {
    const { store } = fakeStore();
    await store.upsert('entries', [{ id: 'e1', data: expense('e1') }]);
    await pull(store);
    // A newer phone writes a row this app doesn't know, then another row after it.
    await store.upsert('entries', [{ id: 'e2', data: { ...expense('e2'), type: 'gift' } }]);
    await store.upsert('entries', [{ id: 'e3', data: expense('e3') }]);
    expect(await pull(store)).toEqual({ kind: 'invalid', problem: UPDATE_NEEDED });
    expect((await db.entries.toArray()).map((e) => e.id)).toEqual(['e1']);
    expect(await cursor()).toBe(1);
  });

  it('refuses a row filed under another id', async () => {
    const { store } = fakeStore();
    await store.upsert('entries', [{ id: 'e1', data: expense('e9') }]);
    expect(await pull(store)).toEqual({ kind: 'invalid', problem: UPDATE_NEEDED });
    expect(await db.entries.count()).toBe(0);
  });

  it('reads page by page, and the next pull asks only for what is newer', async () => {
    const { store, calls } = fakeStore();
    await store.upsert('entries', ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, data: expense(id) })));
    expect(await pull(store, 3)).toEqual({ kind: 'done', applied: 7, cursor: 7 });
    expect(calls.filter((call) => call.startsWith('pull'))).toEqual(['pull 0', 'pull 3', 'pull 6', 'pull 7']);
    calls.length = 0;
    expect(await pull(store, 3)).toEqual({ kind: 'done', applied: 0, cursor: 7 });
    expect(calls).toEqual(['pull 7']);
  });

  it('takes this phone’s own pushed rows back without changing anything or queueing them again', async () => {
    const { store } = fakeStore();
    await db.accounts.put(LOCAL);
    await saveEntry(expense('e1'));
    await push(store);
    await pull(store);
    expect(await db.entries.get('e1')).toEqual(expense('e1'));
    expect(await queued()).toEqual([]);
  });
});
