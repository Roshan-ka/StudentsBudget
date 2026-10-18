import { describe, expect, it } from 'vitest';
import type { Account } from '@/db/types';
import type { CurrencyCode } from '@/lib/money';
import { pickQuickAddAccount } from './quick-add-account';

let n = 0;
function account(name: string, kind: Account['kind'], currency: CurrencyCode, createdAt = '2026-10-01T08:00:00.000Z'): Account {
  n += 1;
  return { id: `a${n}`, name, kind, currency, openingMinor: 0, createdAt };
}

describe('pickQuickAddAccount', () => {
  it('takes a euro cash account first', () => {
    const accounts = [
      account('Local bank', 'bank', 'EUR', '2026-10-01T08:00:00.000Z'),
      account('Rupee wallet', 'cash', 'INR', '2026-10-02T08:00:00.000Z'),
      account('Cash', 'cash', 'EUR', '2026-10-03T08:00:00.000Z'),
    ];

    expect(pickQuickAddAccount(accounts)?.name).toBe('Cash');
  });

  it('takes any cash account when no cash account is in euros', () => {
    const accounts = [
      account('Local bank', 'bank', 'EUR', '2026-10-01T08:00:00.000Z'),
      account('Rupee wallet', 'cash', 'INR', '2026-10-02T08:00:00.000Z'),
    ];

    expect(pickQuickAddAccount(accounts)?.name).toBe('Rupee wallet');
  });

  it('takes a euro account when there is no cash account', () => {
    const accounts = [
      account('Home bank', 'bank', 'INR', '2026-10-01T08:00:00.000Z'),
      account('Local bank', 'bank', 'EUR', '2026-10-02T08:00:00.000Z'),
    ];

    expect(pickQuickAddAccount(accounts)?.name).toBe('Local bank');
  });

  it('takes the first account when none is cash or in euros', () => {
    const accounts = [
      account('Pound bank', 'bank', 'GBP', '2026-10-02T08:00:00.000Z'),
      account('Home bank', 'bank', 'INR', '2026-10-01T08:00:00.000Z'),
    ];

    expect(pickQuickAddAccount(accounts)?.name).toBe('Home bank');
  });

  it('takes the first created of several that qualify, whatever the order of the array', () => {
    const second = account('Cash 2', 'cash', 'EUR', '2026-10-02T08:00:00.000Z');
    const first = account('Cash 1', 'cash', 'EUR', '2026-10-01T08:00:00.000Z');

    expect(pickQuickAddAccount([second, first])?.name).toBe('Cash 1');
    expect(pickQuickAddAccount([first, second])?.name).toBe('Cash 1');
  });

  it('returns undefined when there is no account', () => {
    expect(pickQuickAddAccount([])).toBeUndefined();
  });
});
