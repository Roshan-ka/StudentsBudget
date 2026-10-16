import { describe, expect, it } from 'vitest';
import type { Account, Rate } from '@/db/types';
import type { RateMap } from '@/lib/fx';
import type { CurrencyCode } from '@/lib/money';
import { buildTransfer } from './transfer';

const NOW = new Date('2026-10-16T09:30:00.000Z');

function account(id: string, currency: CurrencyCode): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' };
}

function rate(currency: CurrencyCode, perEur: number): Rate {
  return { currency, perEur, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
}

const input = {
  fromAccountId: 'inr',
  toAccountId: 'bank',
  amountMinor: 95000,
  toAmountMinor: 1000,
  date: '2026-10-16',
  note: '  Rent top-up ',
};

describe('buildTransfer', () => {
  it('converts the sent amount to EUR with the rate', () => {
    const rates: RateMap = { INR: rate('INR', 95) };

    const result = buildTransfer(input, account('inr', 'INR'), rates, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry).toMatchObject({
      type: 'transfer',
      accountId: 'inr',
      toAccountId: 'bank',
      amountMinor: 95000,
      toAmountMinor: 1000,
      eurMinor: 1000,
      date: '2026-10-16',
      note: 'Rent top-up',
      createdAt: '2026-10-16T09:30:00.000Z',
    });
    expect(result.entry.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gives each transfer its own id', () => {
    const rates: RateMap = { INR: rate('INR', 95) };
    const a = buildTransfer(input, account('inr', 'INR'), rates, NOW);
    const b = buildTransfer(input, account('inr', 'INR'), rates, NOW);

    expect(a.ok && b.ok && a.entry.id !== b.entry.id).toBe(true);
  });

  it('needs no rate when the sending account is in EUR', () => {
    const result = buildTransfer(
      { ...input, fromAccountId: 'bank', toAccountId: 'inr', amountMinor: 1000, toAmountMinor: 95000 },
      account('bank', 'EUR'),
      {},
      NOW,
    );

    expect(result.ok && result.entry.eurMinor).toBe(1000);
  });

  it('reports a missing rate with the currency code', () => {
    const result = buildTransfer(input, account('inr', 'INR'), {}, NOW);

    expect(result).toEqual({ ok: false, error: 'No exchange rate for INR yet. Set one in Settings.' });
  });

  it('rejects the same account on both sides', () => {
    const result = buildTransfer({ ...input, toAccountId: 'inr' }, account('inr', 'INR'), { INR: rate('INR', 95) }, NOW);

    expect(result).toEqual({ ok: false, error: 'Pick two different accounts.' });
  });

  it('rejects an amount of zero or less', () => {
    const rates: RateMap = { INR: rate('INR', 95) };

    expect(buildTransfer({ ...input, amountMinor: 0 }, account('inr', 'INR'), rates, NOW)).toEqual({
      ok: false,
      error: 'Enter an amount.',
    });
    expect(buildTransfer({ ...input, amountMinor: -5 }, account('inr', 'INR'), rates, NOW)).toEqual({
      ok: false,
      error: 'Enter an amount.',
    });
  });

  it('rejects a received amount of zero or less', () => {
    const result = buildTransfer({ ...input, toAmountMinor: 0 }, account('inr', 'INR'), { INR: rate('INR', 95) }, NOW);

    expect(result).toEqual({ ok: false, error: 'Enter the amount received.' });
  });
});
