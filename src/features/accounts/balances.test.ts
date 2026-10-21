import { describe, expect, it } from 'vitest';
import type { Account, Entry, Rate } from '@/db/types';
import type { RateMap } from '@/lib/fx';
import type { CurrencyCode } from '@/lib/money';
import { accountBalance, defaultAccount, euroAccount, sortAccounts, totalInEur } from './balances';

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

  it('starts below zero for an overdrawn account, and income climbs back up from there', () => {
    const bank = account('bank', 'EUR', -25000);

    expect(accountBalance(bank, [])).toBe(-25000);
    expect(accountBalance(bank, [expense('e1', 'bank', 650)])).toBe(-25650);
    expect(accountBalance(bank, [income('e1', 'bank', 30000)])).toBe(5000);
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

  it('is negative when the overdrawn accounts outweigh the rest, and converts a negative balance with the rate', () => {
    const overdrawn = account('bank', 'EUR', -25000);
    const cash = account('cash', 'EUR', 5000);
    const inr = account('inr', 'INR', -950000);

    expect(totalInEur([overdrawn, cash], [], {})).toEqual({ totalMinor: -20000, missingRates: [] });
    expect(totalInEur([cash, inr], [], { INR: rate('INR', 95) })).toEqual({ totalMinor: -5000, missingRates: [] });
  });
});

describe('defaultAccount', () => {
  const at = (day: number) => `2026-10-0${day}T08:00:00.000Z`;
  const made = (id: string, kind: Account['kind'], currency: CurrencyCode, day: number, isDefault?: true): Account => ({
    ...account(id, currency, 0),
    kind,
    createdAt: at(day),
    ...(isDefault && { isDefault }),
  });
  const localBank = made('local-bank', 'bank', 'EUR', 1);
  const homeBank = made('home-bank', 'bank', 'INR', 2);
  const cash = made('cash', 'cash', 'EUR', 3);

  it('is the account marked as the default, whatever the rule would pick', () => {
    const markedCash = { ...cash, isDefault: true as const };

    expect(defaultAccount([localBank, homeBank, markedCash])).toBe(markedCash);
    expect(defaultAccount([{ ...homeBank, isDefault: true as const }, localBank, cash])?.id).toBe('home-bank');
  });

  it('is the first euro bank account when none is marked, not the cash account that sorts first by name', () => {
    expect(defaultAccount([localBank, homeBank, cash])).toBe(localBank);
    expect(defaultAccount([homeBank, cash, localBank])).toBe(localBank);
    expect(defaultAccount([homeBank, { ...localBank, id: 'second-euro-bank' }, localBank])?.id).toBe('second-euro-bank');
  });

  it('is a euro account of any kind when no bank account is in euros: cash in euros beats a bank in rupees', () => {
    expect(defaultAccount([homeBank, cash])).toBe(cash);
    expect(defaultAccount([cash, homeBank, made('pound-bank', 'bank', 'GBP', 4)])).toBe(cash);
    // The first euro account counts, in the order given.
    expect(defaultAccount([homeBank, { ...cash, id: 'second-cash' }, cash])?.id).toBe('second-cash');
  });

  it('is the first bank account when no account is in euros', () => {
    const wallet = made('wallet', 'cash', 'INR', 1);

    expect(defaultAccount([wallet, homeBank, made('pound-bank', 'bank', 'GBP', 4)])).toBe(homeBank);
  });

  it('is the first account when none is in euros and none is a bank account', () => {
    const wallet = made('wallet', 'cash', 'INR', 1);
    const pocket = made('pocket', 'cash', 'GBP', 2);

    expect(defaultAccount([wallet, pocket])).toBe(wallet);
    // A euro wallet is not the first account, but it still wins over a wallet in rupees.
    expect(defaultAccount([wallet, cash])).toBe(cash);
  });

  it('is the first marked one if a damaged file marks two', () => {
    const a = made('a', 'bank', 'EUR', 1, true);
    const b = made('b', 'cash', 'EUR', 2, true);

    expect(defaultAccount([a, b])).toBe(a);
  });

  it('is undefined without accounts', () => {
    expect(defaultAccount([])).toBeUndefined();
  });

  it('falls back to the rule once the marked account is deleted: nothing is left marked', () => {
    const accounts = [localBank, homeBank, { ...cash, isDefault: true as const }];
    expect(defaultAccount(accounts)?.id).toBe('cash');

    expect(defaultAccount(accounts.filter((a) => a.id !== 'cash'))).toBe(localBank);
  });

  it('chooses among setup options too, which carry no more than a kind and a currency', () => {
    const options = [
      { id: 'draft-2', name: 'Home bank', currency: 'INR' as const, kind: 'bank' as const },
      { id: 'draft-3', name: 'Cash', currency: 'EUR' as const, kind: 'cash' as const },
      { id: 'draft-1', name: 'Local bank', currency: 'EUR' as const, kind: 'bank' as const },
    ];

    expect(defaultAccount(options)?.id).toBe('draft-1');
    // An option without a kind (a caller that has none) is chosen only as the first.
    expect(defaultAccount([{ id: 'x', name: 'X', currency: 'EUR' as const }])?.id).toBe('x');
  });
});

describe('euroAccount', () => {
  const made = (id: string, kind: Account['kind'], currency: CurrencyCode): Account => ({
    ...account(id, currency, 0),
    kind,
    createdAt: '2026-10-01T08:00:00.000Z',
  });

  it('is the first euro bank account, else the first euro account of any kind, else nothing', () => {
    const inr = made('inr', 'bank', 'INR');
    const cash = made('cash', 'cash', 'EUR');
    const bank = made('bank', 'bank', 'EUR');

    expect(euroAccount([inr, cash, bank])).toBe(bank);
    expect(euroAccount([inr, cash])).toBe(cash);
    expect(euroAccount([inr, made('wallet', 'cash', 'INR')])).toBeUndefined();
    expect(euroAccount([])).toBeUndefined();
  });

  it('ignores the mark: it is the euro part of the rule, not the account marked as the default', () => {
    const markedInr = { ...made('inr', 'bank', 'INR'), isDefault: true as const };
    const cash = made('cash', 'cash', 'EUR');

    expect(euroAccount([markedInr, cash])).toBe(cash);
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
