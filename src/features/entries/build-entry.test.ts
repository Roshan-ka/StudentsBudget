import { describe, expect, it } from 'vitest';
import type { Account, Entry, Rate } from '@/db/types';
import type { RateMap } from '@/lib/fx';
import type { CurrencyCode } from '@/lib/money';
import { buildEntry, type EntryInput } from './build-entry';

const NOW = new Date('2026-10-16T09:30:00.000Z');

function account(id: string, currency: CurrencyCode): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' };
}

function rate(currency: CurrencyCode, perEur: number): Rate {
  return { currency, perEur, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
}

const INR_RATES: RateMap = { INR: rate('INR', 95) };

const expense: EntryInput = {
  type: 'expense',
  date: '2026-10-16',
  accountId: 'inr',
  amountMinor: 95000,
  categoryId: 'food',
  note: '  Groceries ',
};

describe('buildEntry', () => {
  it('converts INR at save time', () => {
    const result = buildEntry(expense, account('inr', 'INR'), INR_RATES, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({
      type: 'expense',
      date: '2026-10-16',
      accountId: 'inr',
      amountMinor: 95000,
      eurMinor: 1000,
      categoryId: 'food',
      note: 'Groceries',
      createdAt: '2026-10-16T09:30:00.000Z',
    });
    expect(result.entry.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses INR without a rate', () => {
    const result = buildEntry(expense, account('inr', 'INR'), {}, NOW);

    expect(result).toEqual({ ok: false, error: 'No exchange rate for INR yet. Set one in Settings.' });
  });

  it('needs no rate for EUR', () => {
    const result = buildEntry({ ...expense, accountId: 'bank', amountMinor: 650 }, account('bank', 'EUR'), {}, NOW);

    expect(result.ok && result.entry.eurMinor).toBe(650);
  });

  it('builds income the same way', () => {
    const result = buildEntry(
      { type: 'income', date: '2026-10-01', accountId: 'inr', amountMinor: 190000, categoryId: 'income-parents', note: '' },
      account('inr', 'INR'),
      INR_RATES,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({ type: 'income', categoryId: 'income-parents', eurMinor: 2000, note: '' });
  });

  it('gives each entry its own id', () => {
    const a = buildEntry(expense, account('inr', 'INR'), INR_RATES, NOW);
    const b = buildEntry(expense, account('inr', 'INR'), INR_RATES, NOW);

    expect(a.ok && b.ok && a.entry.id !== b.entry.id).toBe(true);
  });

  it('keeps the id the input carries', () => {
    const fromInput = buildEntry({ ...expense, id: 'chosen-id' }, account('inr', 'INR'), INR_RATES, NOW);
    expect(fromInput.ok && fromInput.entry.id).toBe('chosen-id');

    const transfer = buildEntry(
      { type: 'transfer', id: 'chosen-id', date: '2026-10-16', accountId: 'inr', amountMinor: 95000, toAccountId: 'bank', toAmountMinor: 1000, note: '' },
      account('inr', 'INR'),
      INR_RATES,
      NOW,
    );
    expect(transfer.ok && transfer.entry.id).toBe('chosen-id');
  });

  it('rejects an amount of zero or less', () => {
    for (const amountMinor of [0, -5]) {
      const result = buildEntry({ ...expense, amountMinor }, account('inr', 'INR'), INR_RATES, NOW);

      expect(result).toEqual({ ok: false, error: 'Enter an amount.' });
    }
  });

  it('asks for the amount before it asks for a rate', () => {
    const result = buildEntry({ ...expense, amountMinor: 0 }, account('inr', 'INR'), {}, NOW);

    expect(result).toEqual({ ok: false, error: 'Enter an amount.' });
  });

  it('editing keeps id and createdAt', () => {
    const existing: Entry = {
      id: 'entry-1',
      type: 'expense',
      date: '2026-10-10',
      accountId: 'bank',
      amountMinor: 600,
      eurMinor: 600,
      categoryId: 'eating-out',
      note: 'döner',
      createdAt: '2026-10-10T11:00:00.000Z',
    };

    const result = buildEntry(
      { type: 'expense', date: '2026-10-11', accountId: 'bank', amountMinor: 750, categoryId: 'food', note: 'Kebab' },
      account('bank', 'EUR'),
      {},
      NOW,
      existing,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toEqual({
      id: 'entry-1',
      type: 'expense',
      date: '2026-10-11',
      accountId: 'bank',
      amountMinor: 750,
      eurMinor: 750,
      categoryId: 'food',
      note: 'Kebab',
      createdAt: '2026-10-10T11:00:00.000Z',
    });
  });

  describe('editing and the stored EUR value', () => {
    // 95000 INR was worth 1000 cents when it was entered (rate 95).
    const existing: Entry = {
      id: 'entry-1',
      type: 'expense',
      date: '2026-10-10',
      accountId: 'inr',
      amountMinor: 95000,
      eurMinor: 1000,
      categoryId: 'food',
      note: 'Groceries',
      createdAt: '2026-10-10T11:00:00.000Z',
    };
    const edit: EntryInput = { ...expense, date: '2026-10-11', note: 'Groceries and snacks', categoryId: 'shopping' };

    it('a note-only edit keeps eurMinor when the rate has moved', () => {
      const result = buildEntry(edit, account('inr', 'INR'), { INR: rate('INR', 100) }, NOW, existing);

      expect(result.ok && result.entry.eurMinor).toBe(1000);
    });

    it('a note-only edit keeps eurMinor and saves when there is no rate at all', () => {
      const result = buildEntry(edit, account('inr', 'INR'), {}, NOW, existing);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.entry).toMatchObject({ id: 'entry-1', eurMinor: 1000, note: 'Groceries and snacks', categoryId: 'shopping' });
    });

    it('an amount edit converts again with the current rate', () => {
      const result = buildEntry({ ...edit, amountMinor: 100000 }, account('inr', 'INR'), { INR: rate('INR', 100) }, NOW, existing);

      expect(result.ok && result.entry.eurMinor).toBe(1000);
      const other = buildEntry({ ...edit, amountMinor: 190000 }, account('inr', 'INR'), { INR: rate('INR', 95) }, NOW, existing);
      expect(other.ok && other.entry.eurMinor).toBe(2000);
    });

    it('an amount edit without a rate is refused', () => {
      const result = buildEntry({ ...edit, amountMinor: 190000 }, account('inr', 'INR'), {}, NOW, existing);

      expect(result).toEqual({ ok: false, error: 'No exchange rate for INR yet. Set one in Settings.' });
    });

    it('moving the entry to another account converts again', () => {
      const result = buildEntry({ ...edit, accountId: 'bank' }, account('bank', 'EUR'), {}, NOW, existing);

      expect(result.ok && result.entry.eurMinor).toBe(95000);
    });

    it('a transfer edit that leaves the sending account and amount alone keeps eurMinor', () => {
      const transfer: Entry = {
        id: 'transfer-1',
        type: 'transfer',
        date: '2026-10-10',
        accountId: 'inr',
        amountMinor: 95000,
        eurMinor: 1000,
        toAccountId: 'bank',
        toAmountMinor: 1000,
        note: '',
        createdAt: '2026-10-10T11:00:00.000Z',
      };
      const input: EntryInput = {
        type: 'transfer',
        date: '2026-10-12',
        accountId: 'inr',
        amountMinor: 95000,
        toAccountId: 'bank',
        toAmountMinor: 1100,
        note: 'Fee taken',
      };

      const kept = buildEntry(input, account('inr', 'INR'), {}, NOW, transfer);
      expect(kept.ok && kept.entry.eurMinor).toBe(1000);

      const changed = buildEntry({ ...input, amountMinor: 190000 }, account('inr', 'INR'), { INR: rate('INR', 100) }, NOW, transfer);
      expect(changed.ok && changed.entry.eurMinor).toBe(1900);
    });
  });

  it('editing a transfer keeps id and createdAt', () => {
    const existing: Entry = {
      id: 'transfer-1',
      type: 'transfer',
      date: '2026-10-10',
      accountId: 'bank',
      amountMinor: 5000,
      eurMinor: 5000,
      toAccountId: 'inr',
      toAmountMinor: 475000,
      note: '',
      createdAt: '2026-10-10T11:00:00.000Z',
    };

    const result = buildEntry(
      { type: 'transfer', date: '2026-10-12', accountId: 'bank', amountMinor: 6000, toAccountId: 'inr', toAmountMinor: 570000, note: 'Top-up' },
      account('bank', 'EUR'),
      INR_RATES,
      NOW,
      existing,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({
      id: 'transfer-1',
      type: 'transfer',
      createdAt: '2026-10-10T11:00:00.000Z',
      amountMinor: 6000,
      eurMinor: 6000,
      toAmountMinor: 570000,
      note: 'Top-up',
    });
  });

  it('transfer stores eurMinor of the sending side', () => {
    const result = buildEntry(
      { type: 'transfer', date: '2026-10-16', accountId: 'inr', amountMinor: 95000, toAccountId: 'bank', toAmountMinor: 1000, note: '' },
      account('inr', 'INR'),
      INR_RATES,
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({
      type: 'transfer',
      accountId: 'inr',
      toAccountId: 'bank',
      amountMinor: 95000,
      toAmountMinor: 1000,
      eurMinor: 1000,
    });
  });

  it('transfers inherit the four transfer errors', () => {
    const transfer = {
      type: 'transfer',
      date: '2026-10-16',
      accountId: 'inr',
      amountMinor: 95000,
      toAccountId: 'bank',
      toAmountMinor: 1000,
      note: '',
    } as const;
    const inr = account('inr', 'INR');

    expect(buildEntry(transfer, inr, {}, NOW)).toEqual({
      ok: false,
      error: 'No exchange rate for INR yet. Set one in Settings.',
    });
    expect(buildEntry({ ...transfer, toAccountId: 'inr' }, inr, INR_RATES, NOW)).toEqual({
      ok: false,
      error: 'Pick two different accounts.',
    });
    expect(buildEntry({ ...transfer, amountMinor: 0 }, inr, INR_RATES, NOW)).toEqual({
      ok: false,
      error: 'Enter an amount.',
    });
    expect(buildEntry({ ...transfer, toAmountMinor: 0 }, inr, INR_RATES, NOW)).toEqual({
      ok: false,
      error: 'Enter the amount received.',
    });
  });
});
