import { describe, expect, it } from 'vitest';
import type { Entry, Plan, Schedule } from '@/db/types';
import { currencyFixed } from './currency-lock';

const expense = (accountId: string): Entry => ({
  id: `e-${accountId}`,
  type: 'expense',
  date: '2026-11-09',
  accountId,
  amountMinor: 600,
  eurMinor: 600,
  categoryId: 'eating-out',
  note: 'döner',
  createdAt: '2026-11-09T12:00:00.000Z',
});

const transfer = (from: string, to: string): Entry => ({
  id: `t-${from}-${to}`,
  type: 'transfer',
  date: '2026-11-09',
  accountId: from,
  amountMinor: 2000,
  eurMinor: 2000,
  toAccountId: to,
  toAmountMinor: 2000,
  note: '',
  createdAt: '2026-11-09T12:00:00.000Z',
});

/** A plan whose parents' income posts to `incomeAccount` and whose rent, if given, posts to `rentAccount`. */
function plan(incomeAccount: string, rentAccount?: string): Plan {
  const schedule = (id: string, accountId: string): Schedule => ({
    id,
    frequency: 'monthly',
    day: 1,
    accountId,
    amountMinor: 2000000,
    startOn: '2026-11-10',
    postedThrough: '2026-11-09',
  });
  return {
    id: 'current',
    cityId: 'regensburg',
    incomes: [{ categoryId: 'income-parents', monthlyMinor: 22000, schedule: schedule('parents', incomeAccount) }],
    fixed: [
      rentAccount === undefined
        ? { categoryId: 'rent', monthlyMinor: 38000 }
        : { categoryId: 'rent', monthlyMinor: 38000, schedule: schedule('rent', rentAccount) },
    ],
    oneOffs: [],
    envelopes: [],
    createdOn: '2026-11-09',
  };
}

describe('currencyFixed', () => {
  it('is free for an account nothing uses yet', () => {
    expect(currencyFixed('home', [], null)).toBe(false);
    expect(currencyFixed('home', [expense('local')], plan('local'))).toBe(false);
  });

  it('is fixed once an entry books on the account, or a transfer goes either way', () => {
    expect(currencyFixed('home', [expense('home')], null)).toBe(true);
    expect(currencyFixed('home', [transfer('home', 'local')], null)).toBe(true);
    expect(currencyFixed('home', [transfer('local', 'home')], null)).toBe(true);
  });

  it('is fixed while an income or fixed cost posts to it, before any entry exists', () => {
    // Set up today, posting from tomorrow: no entry yet, but ₹20,000 from home would post as €20,000 after a change.
    expect(currencyFixed('home', [], plan('home'))).toBe(true);
    expect(currencyFixed('local', [], plan('home', 'local'))).toBe(true);
  });
});
