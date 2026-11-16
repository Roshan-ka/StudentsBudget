import { describe, expect, it } from 'vitest';
import type { Account } from '@/db/types';
import { formatDate } from '@/lib/dates';
import { savedWhat } from './saved-line';

// What quick add's and the receipt scan's Saved line lists: the account and the day only when they aren't the usual.

function account(id: string, currency: Account['currency'], day: number): Account {
  return { id, name: `${id} account`, kind: 'bank', currency, openingMinor: 0, createdAt: `2026-10-0${day}T08:00:00.000Z` };
}

const ACCOUNTS = [account('home', 'INR', 1), account('local', 'EUR', 2)];
const saved = { amount: '€23.45', note: 'REWE', category: 'Food & groceries', accountId: 'local', date: '2026-11-16' };

describe('savedWhat', () => {
  it('lists the amount, the note and the category for the default account today', () => {
    expect(savedWhat(saved, ACCOUNTS, '2026-11-16')).toBe('€23.45 · REWE · Food & groceries');
  });

  it('adds the account when it isn’t the default, and the day when it isn’t today', () => {
    expect(savedWhat({ ...saved, accountId: 'home', date: '2026-11-14' }, ACCOUNTS, '2026-11-16')).toBe(
      `€23.45 · REWE · Food & groceries · home account · ${formatDate('2026-11-14')}`,
    );
  });

  it('leaves out an empty note', () => {
    expect(savedWhat({ ...saved, note: '' }, ACCOUNTS, '2026-11-16')).toBe('€23.45 · Food & groceries');
  });
});
