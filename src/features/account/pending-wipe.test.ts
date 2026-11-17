import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bulk from '@/db/bulk';
import { db } from '@/db/db';
import { finishPendingWipe, settleWipeOnSignIn, wipeAfterSignOut, wipePending, WIPE_PENDING_KEY } from './pending-wipe';

/** localStorage as a map: the unit tests run in Node, which has none. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

const ACCOUNT = { id: 'local', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: 'x' } as const;

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  // No Web Locks in Node: the wipe just runs.
  vi.stubGlobal('navigator', {});
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.accounts.put(ACCOUNT);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('wipeAfterSignOut', () => {
  it('clears the phone and leaves nothing owed', async () => {
    await wipeAfterSignOut();
    expect(await db.accounts.get('local')).toBeUndefined();
    expect(wipePending()).toBe(false);
  });

  it('keeps the wipe owed when it fails, so the next start does it (review, 09-11-2026)', async () => {
    vi.spyOn(bulk, 'deleteEverything').mockRejectedValueOnce(new Error('blocked by another window'));
    await expect(wipeAfterSignOut()).rejects.toThrow('blocked');
    expect(localStorage.getItem(WIPE_PENDING_KEY)).toBe('pending');
    expect(await db.accounts.get('local')).toEqual(ACCOUNT);
  });
});

describe('finishPendingWipe', () => {
  it('does nothing when no wipe is owed', async () => {
    expect(await finishPendingWipe()).toBe('none');
    expect(await db.accounts.get('local')).toEqual(ACCOUNT);
  });

  it('clears the phone a sign-out still owed, and says so', async () => {
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    expect(await finishPendingWipe()).toBe('done');
    expect(await db.accounts.get('local')).toBeUndefined();
    expect(wipePending()).toBe(false);
  });

  it('says when it still can’t, and keeps it owed', async () => {
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    vi.spyOn(bulk, 'deleteEverything').mockRejectedValueOnce(new Error('blocked'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await finishPendingWipe()).toBe('failed');
    expect(wipePending()).toBe(true);
  });
});

describe('settleWipeOnSignIn (review B1, 17-11-2026)', () => {
  async function linkTo(userId: string | null) {
    await db.syncState.put({ id: 'current', userId, cursor: 0, lastSyncedAt: null, problem: null });
  }

  it('does nothing when no wipe is owed', async () => {
    await linkTo('user-a');
    expect(await settleWipeOnSignIn('user-b')).toBe('none');
    expect(await db.accounts.get('local')).toEqual(ACCOUNT);
  });

  it('clears the last account’s data before another account signs in', async () => {
    await linkTo('user-a');
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    expect(await settleWipeOnSignIn('user-b')).toBe('done');
    expect(await db.accounts.get('local')).toBeUndefined();
    expect((await db.syncState.get('current'))?.userId ?? null).toBeNull();
    expect(wipePending()).toBe(false);
  });

  it('keeps the data when the same account signs in again', async () => {
    await linkTo('user-a');
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    expect(await settleWipeOnSignIn('user-a')).toBe('kept');
    expect(await db.accounts.get('local')).toEqual(ACCOUNT);
    expect(wipePending()).toBe(false);
  });

  it('keeps the data on a phone with no link: linking asks what to keep', async () => {
    await linkTo(null);
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    expect(await settleWipeOnSignIn('user-b')).toBe('kept');
    expect(await db.accounts.get('local')).toEqual(ACCOUNT);
  });

  it('keeps the wipe owed when it fails, so linking still refuses', async () => {
    await linkTo('user-a');
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    vi.spyOn(bulk, 'deleteEverything').mockRejectedValueOnce(new Error('blocked'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await settleWipeOnSignIn('user-b')).toBe('failed');
    expect(wipePending()).toBe(true);
  });

  it('shares one check between the session listener and linking, so the wipe runs once', async () => {
    await linkTo('user-a');
    localStorage.setItem(WIPE_PENDING_KEY, 'pending');
    const wipe = vi.spyOn(bulk, 'deleteEverything');
    const [first, second] = await Promise.all([settleWipeOnSignIn('user-b'), settleWipeOnSignIn('user-b')]);
    expect([first, second]).toEqual(['done', 'done']);
    expect(wipe).toHaveBeenCalledTimes(1);
  });
});
