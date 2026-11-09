import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as bulk from '@/db/bulk';
import { db } from '@/db/db';
import { finishPendingWipe, wipeAfterSignOut, wipePending, WIPE_PENDING_KEY } from './pending-wipe';

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
