import { describe, expect, it } from 'vitest';
import type { Account } from '@/db/types';
import type { CurrencyCode } from '@/lib/money';
import type { StatementRow } from './read-rows';
import { isCashWithdrawal, transferTarget } from './transfers';

const account = (id: string, name: string, kind: Account['kind'] = 'bank', currency: CurrencyCode = 'EUR'): Account => ({
  id,
  name,
  kind,
  currency,
  openingMinor: 0,
  createdAt: '2026-10-01T08:00:00.000Z',
});

const SPARKASSE = account('spk', 'Sparkasse');
const REVOLUT = account('rev', 'Revolut');
const CASH = account('cash', 'Cash', 'cash');
const INR = account('inr', 'SBI India', 'bank', 'INR');

const row = (extra: Partial<StatementRow>): StatementRow => ({
  index: 1,
  date: '2026-11-04',
  amountMinor: -10000,
  currency: 'EUR',
  payee: '',
  purpose: '',
  bookingText: '',
  pending: false,
  kind: 'payment',
  ...extra,
});

describe('transferTarget', () => {
  it('makes a row that names another account a transfer, money out or in', () => {
    expect(transferTarget(row({ payee: 'Revolut', purpose: 'Aufladen' }), SPARKASSE, [SPARKASSE, REVOLUT, CASH])).toEqual({
      kind: 'transfer',
      otherAccountId: 'rev',
    });
    expect(transferTarget(row({ amountMinor: 20000, purpose: 'Rueckueberweisung von Revolut' }), SPARKASSE, [SPARKASSE, REVOLUT])).toEqual({
      kind: 'transfer',
      otherAccountId: 'rev',
    });
  });

  it('leaves a payment alone: its own account, a generic name and part of a word name nothing', () => {
    expect(transferTarget(row({ payee: 'REWE Markt GmbH' }), SPARKASSE, [SPARKASSE, REVOLUT, CASH])).toEqual({ kind: 'none' });
    expect(transferTarget(row({ payee: 'Sparkasse Regensburg', purpose: 'Kontofuehrung' }), SPARKASSE, [SPARKASSE])).toEqual({ kind: 'none' });
    expect(transferTarget(row({ payee: 'Deutsche Bank' }), SPARKASSE, [SPARKASSE, account('b', 'Bank')])).toEqual({ kind: 'none' });
    expect(transferTarget(row({ payee: 'Revolution Records' }), SPARKASSE, [SPARKASSE, REVOLUT])).toEqual({ kind: 'none' });
  });

  it('takes the longest name a row holds', () => {
    const savings = account('rev-save', 'Revolut Savings');
    expect(transferTarget(row({ purpose: 'To Revolut Savings' }), SPARKASSE, [SPARKASSE, REVOLUT, savings])).toEqual({
      kind: 'transfer',
      otherAccountId: 'rev-save',
    });
  });

  it('sends a cash withdrawal to the cash account, never to the bank whose machine it was', () => {
    const atm = row({ payee: 'Sparkasse Regensburg', bookingText: 'BARGELDAUSZAHLUNG', purpose: 'GA NR00001234', amountMinor: -5000 });
    expect(transferTarget(atm, SPARKASSE, [SPARKASSE, CASH])).toEqual({ kind: 'transfer', otherAccountId: 'cash' });
    const revolutAtm = row({ payee: 'Cash at Sparkasse', kind: 'cash', amountMinor: -5100 });
    expect(transferTarget(revolutAtm, REVOLUT, [SPARKASSE, REVOLUT, CASH])).toEqual({ kind: 'transfer', otherAccountId: 'cash' });
  });

  it('sends a top-up from the only other euro bank account', () => {
    const topUp = row({ payee: 'Top-Up by *1234', kind: 'topUp', amountMinor: 10000 });
    expect(transferTarget(topUp, REVOLUT, [SPARKASSE, REVOLUT, CASH, INR])).toEqual({ kind: 'transfer', otherAccountId: 'spk' });
  });

  it('skips a top-up or cash withdrawal with no account to go with it, and a transfer to another currency', () => {
    const topUp = row({ payee: 'Top-Up by *1234', kind: 'topUp', amountMinor: 10000 });
    expect(transferTarget(topUp, REVOLUT, [REVOLUT])).toEqual({ kind: 'skip', reason: 'noTransferAccount' });
    expect(transferTarget(topUp, REVOLUT, [REVOLUT, SPARKASSE, account('dkb', 'DKB')])).toEqual({ kind: 'skip', reason: 'noTransferAccount' });
    expect(transferTarget(row({ bookingText: 'BARGELDAUSZAHLUNG' }), SPARKASSE, [SPARKASSE])).toEqual({ kind: 'skip', reason: 'noTransferAccount' });
    expect(transferTarget(row({ purpose: 'Sent to SBI India' }), SPARKASSE, [SPARKASSE, INR])).toEqual({ kind: 'skip', reason: 'otherCurrencyTransfer' });
  });
});

describe('isCashWithdrawal', () => {
  it('reads the bank’s word for it, and money in is never one', () => {
    expect(isCashWithdrawal(row({ bookingText: 'GELDAUTOMAT' }))).toBe(true);
    expect(isCashWithdrawal(row({ purpose: 'Auszahlung GAA 1234' }))).toBe(true);
    expect(isCashWithdrawal(row({ kind: 'cash' }))).toBe(true);
    expect(isCashWithdrawal(row({ bookingText: 'BARGELDAUSZAHLUNG', amountMinor: 5000 }))).toBe(false);
    expect(isCashWithdrawal(row({ payee: 'Bargeld Lounge' }))).toBe(false);
  });
});
