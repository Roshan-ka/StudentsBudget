import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { unsentChanges } from './unsent';

beforeEach(async () => {
  await db.outbox.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('unsentChanges (review B3)', () => {
  it('counts what the outbox holds', async () => {
    expect(await unsentChanges()).toBe(0);
    await db.outbox.put({ table: 'entries', id: 'e1', seq: 1 });
    await db.outbox.put({ table: 'entries', id: 'e2', seq: 2 });
    expect(await unsentChanges()).toBe(2);
  });

  it('answers null, never 0, when the outbox can’t be read', async () => {
    vi.spyOn(db.outbox, 'count').mockRejectedValueOnce(new Error('database closed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await unsentChanges()).toBeNull();
  });
});
