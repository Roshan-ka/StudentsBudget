import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { saveEntry } from '@/db/repo';
import { syncNow, syncResultText, syncStatusText } from './engine';
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

describe('an account still in use', () => {
  it('sends it back in the same Sync now when the other phone deleted it while this one still books on it', async () => {
    const { store, tables } = fakeStore();
    await saveEntry(expense('e1'));
    await syncNow(store, USER);
    // The other phone deletes the account, which it had no entries on.
    await store.tombstone('accounts', ['local']);
    expect(await syncNow(store, USER)).toMatchObject({ kind: 'synced' });
    expect(tables.accounts.get('local')).toMatchObject({ id: 'local' });
    expect(await db.accounts.get('local')).toEqual(LOCAL);
    expect(await db.outbox.count()).toBe(0);
  });
});

// What a screen reader hears once after Sync now (the status line itself is not announced: its clock ticks). Never
// the same words as the status line, so the two can be told apart (P2.2 chunk 10, row 7).
describe('syncResultText', () => {
  it('says how the tap ended, in words the status line never uses', () => {
    expect(syncResultText({ kind: 'synced', sent: 2, received: 3 })).toBe('Sync finished.');
    expect(syncResultText({ kind: 'offline' })).toBe('Not synced: you’re offline. Changes wait on this phone.');
    expect(syncResultText({ kind: 'not-linked' })).toBe('Not synced: this phone is linked to another account.');
    expect(syncResultText({ kind: 'problem', problem: UPDATE_NEEDED })).toBe(`Not synced: ${UPDATE_NEEDED}`);
  });
});

// Two tabs of one phone share its database but not their module state: each has its own one-at-a-time guard. A Web
// Lock keeps their syncs apart too (triage row 8, P2.2 chunk 10). Node has Web Locks, so the lock here is a real one.
describe('two tabs', () => {
  it('lets a second tab’s sync start only once the first one has finished', async () => {
    const { store, calls } = fakeStore();
    await saveEntry(expense('e1'));
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = { ...store, upsert: async (...args: Parameters<typeof store.upsert>) => (await gate, store.upsert(...args)) };

    // The other tab: the same engine, loaded afresh, with its own module state.
    vi.resetModules();
    const otherTab = await import('./engine');
    const first = syncNow(slow, USER);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = otherTab.syncNow(store, USER);
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The first holds the lock while its push waits: the second has sent and read nothing yet.
    expect(calls).toEqual([]);

    release();
    expect(await first).toMatchObject({ kind: 'synced' });
    expect(await second).toMatchObject({ kind: 'synced' });
    // One after the other: the first pushed and pulled, then the second found nothing to push and pulled from where
    // the first left the cursor.
    expect(calls).toEqual(['upsert accounts local', 'upsert entries e1', 'pull 0', 'pull 2', 'pull 2']);
  });
});
