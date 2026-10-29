import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { saveEntry } from '@/db/repo';
import { syncNow, syncStatusText } from './engine';
import { UPDATE_NEEDED } from './pull';
import { StoreError } from './store';
import { expense, fakeStore } from './test-helpers';

// The sync engine over fake-indexeddb (with the real tracking middleware) and the fake store.

const USER = 'user-1';
const LOCAL = { id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: 'x' } as const;

async function state() {
  return db.syncState.get('current');
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncState.put({ id: 'current', userId: USER, cursor: 0, lastSyncedAt: null, problem: null });
  await db.accounts.put(LOCAL);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncNow', () => {
  it('pushes this phone’s changes, then pulls the account’s, and records when', async () => {
    const { store, tables, calls } = fakeStore();
    await saveEntry(expense('e1'));
    await store.upsert('entries', [{ id: 'e9', data: expense('e9') }]);
    calls.length = 0;

    expect(await syncNow(store, USER)).toEqual({ kind: 'synced', sent: 2, received: 3 });
    // Push first (its rows come back in the pull, unchanged), then the pull.
    expect(calls[0]).toBe('upsert accounts local');
    expect(calls.at(-2)).toBe('pull 0');
    expect(tables.entries.has('e1')).toBe(true);
    expect(await db.entries.get('e9')).toEqual(expense('e9'));
    expect((await state())?.lastSyncedAt).not.toBeNull();
    expect((await state())?.problem).toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it('runs one sync at a time: a second call gets the first one’s result', async () => {
    const { store, calls } = fakeStore();
    const first = syncNow(store, USER);
    const second = syncNow(store, USER);
    expect(second).toBe(first);
    await first;
    expect(calls.filter((call) => call === 'pull 0')).toHaveLength(1);
  });

  it('does nothing for an account this phone isn’t linked to, or while offline', async () => {
    const { store, calls } = fakeStore();
    expect(await syncNow(store, 'someone-else')).toEqual({ kind: 'not-linked' });
    vi.stubGlobal('navigator', { onLine: false });
    expect(await syncNow(store, USER)).toEqual({ kind: 'offline' });
    expect(calls).toEqual([]);
  });

  it('keeps the changes and says calmly what stopped it; the next sync clears the problem', async () => {
    const { store } = fakeStore();
    await saveEntry(expense('e1'));
    const refusing = { ...store, upsert: async () => Promise.reject(new StoreError('accounts', 0, '', 'offline')) };
    expect(await syncNow(refusing, USER)).toEqual({
      kind: 'problem',
      problem: "Couldn't sync just now. Your changes wait on this phone; try again.",
    });
    expect(await db.outbox.count()).toBe(2);
    expect((await state())?.problem).toMatch(/^Couldn't sync just now/);

    await syncNow(store, USER);
    expect((await state())?.problem).toBeNull();
    expect(await db.outbox.count()).toBe(0);
  });

  it('asks to sign in again when the sign-in has run out', async () => {
    const { store } = fakeStore();
    await saveEntry(expense('e1'));
    const expired = { ...store, upsert: async () => Promise.reject(new StoreError('accounts', 401, 'PGRST301', 'JWT expired')) };
    expect(await syncNow(expired, USER)).toMatchObject({ problem: 'Your sign-in has run out. Sign out and in again; your changes wait on this phone.' });
  });

  it('stops at a row this app can’t read, and says it needs an update', async () => {
    const { store } = fakeStore();
    await store.upsert('entries', [{ id: 'e2', data: { ...expense('e2'), type: 'gift' } }]);
    expect(await syncNow(store, USER)).toEqual({ kind: 'problem', problem: UPDATE_NEEDED });
    expect((await state())?.problem).toBe(UPDATE_NEEDED);
  });
});

describe('syncStatusText', () => {
  const now = new Date('2026-10-29T14:05:00');
  const base = { lastSyncedAt: null, problem: null, waiting: 0, online: true, now };

  it('says when it last synced, and what still waits', () => {
    expect(syncStatusText(base)).toBe('Not synced yet.');
    expect(syncStatusText({ ...base, lastSyncedAt: '2026-10-29T14:04:40' })).toBe('Synced just now.');
    expect(syncStatusText({ ...base, lastSyncedAt: '2026-10-29T14:03:00', waiting: 3 })).toBe(
      'Synced 2 min ago. 3 changes waiting.',
    );
    expect(syncStatusText({ ...base, lastSyncedAt: '2026-10-29T09:30:00', waiting: 1 })).toBe(
      'Synced on 29-10-2026, 09:30. 1 change waiting.',
    );
  });

  it('says offline first, then the problem that stopped the last sync', () => {
    expect(syncStatusText({ ...base, online: false })).toBe('Offline. Changes made now wait on this phone.');
    expect(syncStatusText({ ...base, online: false, waiting: 1, problem: UPDATE_NEEDED })).toBe(
      'Offline: 1 change waits on this phone.',
    );
    expect(syncStatusText({ ...base, problem: UPDATE_NEEDED, lastSyncedAt: '2026-10-29T14:04:40' })).toBe(UPDATE_NEEDED);
  });
});
