import { describe, expect, it } from 'vitest';
import type { Account, Entry, Rate } from '@/db/types';
import type { RateMap } from '@/lib/fx';
import type { CurrencyCode } from '@/lib/money';
import { accountBalance, sortAccounts, totalInEur } from './balances';

function account(id: string, currency: CurrencyCode, openingMinor: number): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor, createdAt: '2026-10-01T08:00:00.000Z' };
}

function rate(currency: CurrencyCode, perEur: number): Rate {
  return { currency, perEur, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
}

const base = { date: '2026-10-16', note: '', createdAt: '2026-10-16T08:00:00.000Z' };

function expense(id: string, accountId: string, amountMinor: number): Entry {
  return { ...base, id, type: 'expense', categoryId: 'groceries', accountId, amountMinor, eurMinor: amountMinor };
}

function income(id: string, accountId: string, amountMinor: number): Entry {
  return { ...base, id, type: 'income', categoryId: 'job', accountId, amountMinor, eurMinor: amountMinor };
}

function transfer(id: string, accountId: string, amountMinor: number, toAccountId: string, toAmountMinor: number): Entry {
  return { ...base, id, type: 'transfer', accountId, amountMinor, eurMinor: amountMinor, toAccountId, toAmountMinor };
}

describe('accountBalance', () => {
  it('adds income and transfers in, subtracts expenses and transfers out', () => {
    const bank = account('bank', 'EUR', 10000);
    const entries = [
      expense('e1', 'bank', 650),
      income('e2', 'bank', 5000),
      transfer('e3', 'bank', 2000, 'cash', 2000),
    ];

    expect(accountBalance(bank, entries)).toBe(12350);
  });

  it('adds the received amount of a transfer in, not the amount sent', () => {
    const inr = account('inr', 'INR', 0);
    const entries = [transfer('e1', 'bank', 100, 'inr', 1000)];

    expect(accountBalance(inr, entries)).toBe(1000);
  });

  it('ignores entries of other accounts', () => {
    const cash = account('cash', 'EUR', 500);
    const entries = [expense('e1', 'bank', 650), income('e2', 'bank', 5000), transfer('e3', 'bank', 2000, 'inr', 200000)];

    expect(accountBalance(cash, entries)).toBe(500);
  });
});

describe('totalInEur', () => {
  it('converts with the rate and reports missing ones', () => {
    const eur = account('eur', 'EUR', 10000);
    const inr = account('inr', 'INR', 950000);
    const rates: RateMap = { INR: rate('INR', 95) };

    expect(totalInEur([eur, inr], [], rates)).toEqual({ totalMinor: 20000, missingRates: [] });
    expect(totalInEur([eur, inr], [], {})).toEqual({ totalMinor: 10000, missingRates: ['INR'] });
  });

  it('lists a currency without a rate once, however many accounts use it', () => {
    const accounts = [account('a', 'INR', 100), account('b', 'INR', 200), account('c', 'USD', 300)];

    expect(totalInEur(accounts, [], {})).toEqual({ totalMinor: 0, missingRates: ['INR', 'USD'] });
  });

  it('includes entries in each balance before converting', () => {
    const inr = account('inr', 'INR', 950000);
    const entries = [expense('e1', 'inr', 475000)];

    expect(totalInEur([inr], entries, { INR: rate('INR', 95) })).toEqual({ totalMinor: 5000, missingRates: [] });
  });
});

describe('sortAccounts', () => {
  it('orders accounts by creation time, then by name, without changing the input', () => {
    const early = { ...account('b', 'EUR', 0), name: 'Savings', createdAt: '2026-10-01T08:00:00.000Z' };
    const lateA = { ...account('a', 'INR', 0), name: 'Home bank', createdAt: '2026-10-02T08:00:00.000Z' };
    const lateB = { ...account('c', 'EUR', 0), name: 'Cash', createdAt: '2026-10-02T08:00:00.000Z' };
    const input = [lateA, lateB, early];

    expect(sortAccounts(input).map((a) => a.id)).toEqual(['b', 'c', 'a']);
    expect(input.map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });
});
