import { describe, expect, it } from 'vitest';
import type { Entry } from '@/db/types';
import { groupByDate, neighbourOf } from './list-order';

/** An expense with only what the order reads: its id, its day and when it was made. */
function entry(id: string, date: string, createdAt: string): Entry {
  return {
    id,
    type: 'expense',
    date,
    createdAt,
    amountMinor: 100,
    eurMinor: 100,
    currency: 'EUR',
    accountId: 'a1',
    categoryId: 'food',
    note: id,
  } as Entry;
}

// The ids sort the other way round from the list, as the database's own order can: by day first, then by id.
const morning = entry('c', '2026-11-18', '2026-11-18T10:00:00.000Z');
const noon = entry('b', '2026-11-18', '2026-11-18T11:00:00.000Z');
const evening = entry('a', '2026-11-18', '2026-11-18T12:00:00.000Z');
const dayBefore = entry('z', '2026-11-17', '2026-11-17T09:00:00.000Z');
const ENTRIES = [dayBefore, evening, noon, morning];

describe('groupByDate', () => {
  it('lists the newest day first, and in a day the newest entry first', () => {
    expect(groupByDate(ENTRIES).map((group) => [group.date, group.entries.map((e) => e.id)])).toEqual([
      ['2026-11-18', ['a', 'b', 'c']],
      ['2026-11-17', ['z']],
    ]);
  });
});

// Quick add breakpoints (18-11-2026): after a delete, the focus went to the next entry in the database's order.
describe('neighbourOf', () => {
  it('names the entry shown after the one that goes', () => {
    expect(neighbourOf(ENTRIES, 'b')).toBe('c');
    expect(neighbourOf(ENTRIES, 'a')).toBe('b');
    expect(neighbourOf(ENTRIES, 'c')).toBe('z');
  });

  it('names the one shown before when the last goes, and none when it was the only one', () => {
    expect(neighbourOf(ENTRIES, 'z')).toBe('c');
    expect(neighbourOf([morning], 'c')).toBeNull();
  });
});
