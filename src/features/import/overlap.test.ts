import { describe, expect, it } from 'vitest';
import type { Entry } from '@/db/types';
import { findOverlaps, OVERLAP_DAYS } from './overlap';

const base = { eurMinor: 0, note: '', createdAt: '2026-11-01T08:00:00.000Z' };
const expense = (id: string, date: string, amountMinor: number, accountId = 'bank'): Entry => ({
  ...base,
  id,
  type: 'expense',
  date,
  accountId,
  amountMinor,
  categoryId: 'food',
});
const income = (id: string, date: string, amountMinor: number): Entry => ({ ...base, id, type: 'income', date, accountId: 'bank', amountMinor, categoryId: 'income-job' });
const transfer = (id: string, date: string, from: string, to: string, amountMinor: number): Entry => ({
  ...base,
  id,
  type: 'transfer',
  date,
  accountId: from,
  toAccountId: to,
  amountMinor,
  toAmountMinor: amountMinor,
});

describe('findOverlaps', () => {
  it('finds an expense for money out and an income for money in, on the same account, within three days', () => {
    const entries = [expense('rewe', '2026-11-01', 2345), income('job', '2026-11-03', 45000), expense('other-account', '2026-11-01', 999, 'cash')];
    const rows = [
      { index: 1, date: '2026-11-03', amountMinor: -2345 },
      { index: 2, date: '2026-11-03', amountMinor: 45000 },
      { index: 3, date: '2026-11-01', amountMinor: -999 },
      { index: 4, date: '2026-11-01', amountMinor: 2345 },
    ];
    expect(findOverlaps(rows, 'bank', entries)).toEqual(
      new Map([
        [1, 'rewe'],
        [2, 'job'],
      ]),
    );
  });

  it('goes by direction, not type: cash typed as a transfer to Cash is the bank row of the withdrawal, both halves found', () => {
    const entries = [transfer('atm', '2026-11-02', 'bank', 'cash', 5000), transfer('topup', '2026-11-04', 'bank', 'revolut', 10000)];
    expect(findOverlaps([{ index: 1, date: '2026-11-02', amountMinor: -5000 }], 'bank', entries)).toEqual(new Map([[1, 'atm']]));
    // The other half: the top-up as Revolut's statement shows it, money in.
    expect(findOverlaps([{ index: 7, date: '2026-11-05', amountMinor: 10000 }], 'revolut', entries)).toEqual(new Map([[7, 'topup']]));
  });

  it('stops at OVERLAP_DAYS', () => {
    const entries = [expense('mensa', '2026-11-01', 350)];
    expect(findOverlaps([{ index: 1, date: `2026-11-0${1 + OVERLAP_DAYS}`, amountMinor: -350 }], 'bank', entries).size).toBe(1);
    expect(findOverlaps([{ index: 1, date: `2026-11-0${2 + OVERLAP_DAYS}`, amountMinor: -350 }], 'bank', entries).size).toBe(0);
  });

  it('covers one row with each entry, the closest dates first', () => {
    const entries = [expense('typed', '2026-11-03', 350)];
    const rows = [
      { index: 1, date: '2026-11-01', amountMinor: -350 },
      { index: 2, date: '2026-11-03', amountMinor: -350 },
    ];
    expect(findOverlaps(rows, 'bank', entries)).toEqual(new Map([[2, 'typed']]));
  });

  it('pairs every row of a file imported a second time with the entry the first import made', () => {
    const entries = [expense('a', '2026-11-03', 350), expense('b', '2026-11-03', 350), expense('c', '2026-11-04', 1249)];
    const rows = [
      { index: 1, date: '2026-11-03', amountMinor: -350 },
      { index: 2, date: '2026-11-03', amountMinor: -350 },
      { index: 3, date: '2026-11-04', amountMinor: -1249 },
    ];
    expect(findOverlaps(rows, 'bank', entries)).toEqual(
      new Map([
        [1, 'a'],
        [2, 'b'],
        [3, 'c'],
      ]),
    );
  });
});
