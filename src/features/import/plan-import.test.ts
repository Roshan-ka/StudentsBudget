import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import type { Account, Entry, Plan } from '@/db/types';
import { REVOLUT, SPARKASSE_CAMT } from './fixtures';
import { planImport, type ImportInput } from './plan-import';
import { openStatement } from './statement';

// What an import will do with a statement: the drafts, the skipped rows with their reasons, and the start-of-account
// moves. The statements are the fixtures' Sparkasse (30.10.–04.11.2026) and Revolut (01.–05.11.2026) files.

const NOW = new Date('2026-11-06T12:00:00');

const account = (id: string, name: string, kind: Account['kind'] = 'bank', createdAt = '2026-10-01T08:00:00'): Account => ({
  id,
  name,
  kind,
  currency: 'EUR',
  openingMinor: 0,
  createdAt: new Date(createdAt).toISOString(),
});
const SPARKASSE = account('spk', 'Sparkasse');
const REVOLUT_ACCOUNT = account('rev', 'Revolut');
const CASH = account('cash', 'Cash', 'cash');

const PLAN: Plan = { id: 'current', cityId: 'regensburg', incomes: [], fixed: [], oneOffs: [], envelopes: [], createdOn: '2026-10-05' };

function read(file: Uint8Array) {
  const statement = openStatement(file);
  if (statement.kind !== 'bank') throw new Error('not a bank statement');
  return statement.read;
}

function plan(file: Uint8Array, overrides: Partial<ImportInput> = {}) {
  return planImport({
    read: read(file),
    account: SPARKASSE,
    accounts: [SPARKASSE, REVOLUT_ACCOUNT, CASH],
    entries: [],
    categories: CATEGORIES,
    plan: PLAN,
    batchId: 'batch-1',
    now: NOW,
    ...overrides,
  });
}

describe('planImport', () => {
  it('turns Sparkasse’s rows into entries: categories, a cash withdrawal and a top-up of Revolut as transfers, the pending one left out', () => {
    const result = plan(SPARKASSE_CAMT);

    expect(result.add.map(({ input }) => input)).toEqual([
      { type: 'expense', date: '2026-10-30', accountId: 'spk', amountMinor: 2345, categoryId: 'food', note: 'REWE Markt GmbH' },
      { type: 'income', date: '2026-10-31', accountId: 'spk', amountMinor: 93400, categoryId: 'income-bafoeg', note: 'Bundesamt fuer Ausbildungsfoerderung · BAFOEG 10/2026' },
      { type: 'expense', date: '2026-11-01', accountId: 'spk', amountMinor: 125000, categoryId: 'rent', note: 'Studierendenwerk Niederbayern/Oberpfalz · Miete November' },
      { type: 'transfer', date: '2026-11-02', accountId: 'spk', toAccountId: 'cash', amountMinor: 5000, toAmountMinor: 5000, note: 'Sparkasse Regensburg · GA NR00001234 BLZ75050000 0' },
      { type: 'transfer', date: '2026-11-04', accountId: 'spk', toAccountId: 'rev', amountMinor: 10000, toAmountMinor: 10000, note: 'Revolut · Aufladen' },
    ]);
    expect(result.add.map(({ imported }) => imported)).toEqual([
      { batchId: 'batch-1', merchant: 'rewe', guess: 'food' },
      { batchId: 'batch-1', merchant: 'bundesamt fuer', guess: 'income-bafoeg' },
      { batchId: 'batch-1', merchant: 'studierendenwerk niederbayern/oberpfalz', guess: 'rent' },
      { batchId: 'batch-1', merchant: 'sparkasse regensburg' },
      { batchId: 'batch-1', merchant: 'revolut' },
    ]);
    expect(result.skipped).toEqual([{ index: 5, reason: 'pending', date: '2026-11-03', amountMinor: -310, text: 'Bäckerei Müller · Brötchen' }]);
    expect(result.openingChanges.size).toBe(0);
  });

  it('skips every row when the same file is imported again: each is already in the app', () => {
    const first = plan(SPARKASSE_CAMT);
    const entries: Entry[] = first.add.map(({ input, imported }, at) => {
      const common = { id: `e${at}`, eurMinor: input.amountMinor, createdAt: NOW.toISOString(), imported };
      return input.type === 'transfer' ? { ...input, ...common } : { ...input, ...common };
    });

    const again = plan(SPARKASSE_CAMT, { entries });

    expect(again.add).toEqual([]);
    expect(again.skipped.map((row) => [row.index, row.reason])).toEqual([
      [1, 'duplicate'],
      [2, 'duplicate'],
      [3, 'duplicate'],
      [4, 'duplicate'],
      [5, 'pending'],
      [6, 'duplicate'],
    ]);
  });

  it('skips the other half of the top-up when Revolut’s statement comes after Sparkasse’s', () => {
    const sparkasse = plan(SPARKASSE_CAMT);
    const topUp = sparkasse.add.find(({ input }) => input.type === 'transfer' && input.toAccountId === 'rev')!;
    const entries: Entry[] = [{ ...(topUp.input as Extract<Entry, { type: 'transfer' }>), id: 't1', eurMinor: 10000, createdAt: NOW.toISOString() }];

    const revolut = plan(REVOLUT, { account: REVOLUT_ACCOUNT, entries });
    // Revolut's first top-up (01.11., 100 €) is three days from Sparkasse's 04.11. booking: the same transfer.
    expect(revolut.skipped.find((row) => row.index === 1)?.reason).toBe('duplicate');
  });

  it('gives each of Revolut’s rows its due: top-ups, cash, moves inside Revolut, pending, other currencies', () => {
    const result = plan(REVOLUT, { account: REVOLUT_ACCOUNT });

    expect(result.add.map(({ row, input }) => [row.index, input.type, input.amountMinor])).toEqual([
      [1, 'transfer', 10000],
      [2, 'expense', 1840],
      [3, 'transfer', 5100],
      [9, 'transfer', 2500],
    ]);
    expect(result.add.find(({ row }) => row.index === 1)?.input).toMatchObject({ accountId: 'spk', toAccountId: 'rev' });
    expect(result.add.find(({ row }) => row.index === 3)?.input).toMatchObject({ accountId: 'rev', toAccountId: 'cash' });
    expect(result.add.find(({ row }) => row.index === 2)?.input).toMatchObject({ categoryId: 'eating-out' });
    expect(result.skipped.map((row) => [row.index, row.reason])).toEqual([
      [4, 'internal'],
      [5, 'internal'],
      [6, 'pending'],
      [7, 'currency'],
      [8, 'pending'],
    ]);
  });

  it('leaves out rows from before the plan’s month and after today, and keeps everything without a plan', () => {
    const late = plan(SPARKASSE_CAMT, { plan: { ...PLAN, createdOn: '2026-11-01' }, now: new Date('2026-11-02T12:00:00') });
    expect(late.skipped.map((row) => [row.index, row.reason])).toEqual([
      [1, 'beforePlan'],
      [2, 'beforePlan'],
      [5, 'pending'],
      [6, 'future'],
    ]);
    expect(plan(SPARKASSE_CAMT, { plan: null }).add).toHaveLength(5);
  });

  it('skips a top-up or cash withdrawal with no account to go with it', () => {
    const result = plan(SPARKASSE_CAMT, { accounts: [SPARKASSE, REVOLUT_ACCOUNT] });
    expect(result.skipped.find((row) => row.index === 4)?.reason).toBe('noTransferAccount');
  });

  it('moves the start of each account by the entries dated before the day it was added', () => {
    // Sparkasse added on 01.11.2026, Cash on 03.11.: the REWE payment, BAföG and the cash withdrawal came before.
    const sparkasse = account('spk', 'Sparkasse', 'bank', '2026-11-01T09:00:00');
    const cash = account('cash', 'Cash', 'cash', '2026-11-03T09:00:00');
    const result = plan(SPARKASSE_CAMT, { account: sparkasse, accounts: [sparkasse, REVOLUT_ACCOUNT, cash] });

    // REWE −23,45 and BAföG +934,00 before 01.11.: Sparkasse's start moves by −910,55. The withdrawal (02.11.) is
    // after Sparkasse was added, and before Cash was: Cash's start moves by −50,00.
    expect(result.openingChanges).toEqual(
      new Map([
        ['spk', -91055],
        ['cash', -5000],
      ]),
    );
  });
});
