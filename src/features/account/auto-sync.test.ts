import 'fake-indexeddb/auto';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { saveEntry } from '@/db/repo';
import { StoreError } from '@/sync/store';
import { expense, fakeStore } from '@/sync/test-helpers';
import { outboxShape, runOnce } from './auto-sync';

// One automatic sync, as the session stands (automatic sync, chunk 3), over fake-indexeddb and the fake store.

const USER = 'user-1';
const LOCAL = { id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: 'x' } as const;

/** A session as supabase-js hands it over: signed in, or with a confirmed authenticator whose code is owed. */
function session(codeOwed = false): Session {
  return {
    access_token: 'header.eyJhYWwiOiJhYWwxIn0.signature',
    user: {
      id: USER,
      email: 'roshan@example.com',
      factors: codeOwed ? [{ id: 'f1', factor_type: 'totp', status: 'verified' }] : [],
    },
  } as unknown as Session;
}

const noRefresh = { refreshSession: vi.fn() };

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncState.put({ id: 'current', userId: USER, cursor: 0, lastSyncedAt: null, problem: null });
  await db.accounts.put(LOCAL);
  noRefresh.refreshSession.mockReset();
});

describe('outboxShape', () => {
  it('counts the rows waiting and reads the newest seq', async () => {
    expect(await outboxShape()).toEqual({ count: 1, newest: expect.any(Number) });
    await saveEntry(expense('e1'));
    const shape = await outboxShape();
    expect(shape.count).toBe(2);
    expect(shape.newest).toBeGreaterThan(0);
  });
});

describe('runOnce', () => {
  it('syncs as the signed-in user, and tells the outbox it left', async () => {
    const { store, tables } = fakeStore();
    await saveEntry(expense('e1'));
    const done = await runOnce({ session: async () => session(), store: () => store, refresh: noRefresh, firstFailure: () => true });
    expect(done).toEqual({ outcome: 'synced', outbox: { count: 0, newest: 0 }, held: 0 });
    expect(tables.entries.has('e1')).toBe(true);
  });

  it('runs nothing signed out, or with the code owed', async () => {
    const { store, calls } = fakeStore();
    expect((await runOnce({ session: async () => null, store: () => store, refresh: noRefresh, firstFailure: () => true })).outcome).toBe(
      'signed-out',
    );
    expect(
      (await runOnce({ session: async () => session(true), store: () => store, refresh: noRefresh, firstFailure: () => true })).outcome,
    ).toBe('second-step');
    expect(calls).toEqual([]);
  });

  it('on a first failure, asks whether the account now wants the code, and stops for it if so', async () => {
    const { store } = fakeStore();
    await saveEntry(expense('e1'));
    const refused = { ...store, upsert: async () => Promise.reject(new StoreError('accounts', 403, '42501', 'new row violates row-level security policy')) };
    const refresh = { refreshSession: vi.fn(async () => ({ data: { session: session(true) }, error: null })) };
    const done = await runOnce({ session: async () => session(), store: () => refused, refresh: refresh as never, firstFailure: () => true });
    expect(done.outcome).toBe('second-step');
    expect(refresh.refreshSession).toHaveBeenCalledTimes(1);

    // Later failures in a row don't ask again: one refresh, not one a minute.
    const later = await runOnce({ session: async () => session(), store: () => refused, refresh: refresh as never, firstFailure: () => false });
    expect(later.outcome).toBe('failed');
    expect(refresh.refreshSession).toHaveBeenCalledTimes(1);
  });
});
