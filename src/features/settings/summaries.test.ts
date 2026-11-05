import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '@/db/types';
import { LANGUAGES } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import type { CurrencyCode } from '@/lib/money';
import { accountsSummary } from './summaries';

function account(id: string, currency: CurrencyCode, openingMinor: number): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor, createdAt: '2026-10-01T08:00:00.000Z' };
}

const expense: Entry = {
  id: 'e1',
  type: 'expense',
  categoryId: 'food',
  accountId: 'bank',
  amountMinor: 4050,
  eurMinor: 4050,
  date: '2026-10-16',
  note: '',
  createdAt: '2026-10-16T08:00:00.000Z',
};

describe('accountsSummary', () => {
  const en = MESSAGES.en;
  const locale = LANGUAGES.en.locale;

  it('says so when there is no account yet', () => {
    expect(accountsSummary([], [], {}, en, locale)).toBe('No accounts yet');
  });

  it('counts the accounts and totals them in whole euros, after what was spent', () => {
    const accounts = [account('bank', 'EUR', 120000), account('cash', 'EUR', 6000)];
    expect(accountsSummary(accounts, [expense], {}, en, locale)).toBe('2 accounts · €1,220');
    expect(accountsSummary([accounts[0]], [], {}, en, locale)).toBe('1 account · €1,200');
  });

  it('shows a dash for the total when no account converts, as Home does', () => {
    expect(accountsSummary([account('home', 'INR', 500000)], [], {}, en, locale)).toBe('1 account · —');
  });

  it('is in the phone’s language', () => {
    const accounts = [account('bank', 'EUR', 120000), account('cash', 'EUR', 6000)];
    expect(accountsSummary(accounts, [], {}, MESSAGES.de, LANGUAGES.de.locale)).toBe('2 Konten · 1.260 €');
  });
});
