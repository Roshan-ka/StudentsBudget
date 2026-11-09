import { describe, expect, it } from 'vitest';
import type { SetupPatch } from '@/features/ai/contract';
import { applyPatch, draftForChat } from './chat-patch';
import { amountOf, initialDraft, validateStep, type SetupDraft } from './draft';

// The setup chat's side of the wizard (the AI phase, chunk 11): a turn's patch applied to the draft.

const TODAY = '2026-11-09';
const NONE: SetupPatch = { rent: null, incomes: [], fixed: [], envelopes: [], spendingBudget: null, accounts: null };

const FULL: SetupPatch = {
  rent: 450,
  incomes: [
    { categoryId: 'income-job', amount: 520 },
    { categoryId: 'income-parents', amount: 300 },
  ],
  fixed: [
    { categoryId: 'phone', amount: 12.99 },
    { categoryId: 'insurance', amount: 130 },
  ],
  envelopes: [
    { categoryId: 'food', amount: 220 },
    { categoryId: 'eating-out', amount: 60 },
  ],
  spendingBudget: 400,
  accounts: [
    { name: 'Sparkasse', kind: 'bank', currency: 'EUR', balance: 1250.5 },
    { name: 'Cash', kind: 'cash', currency: 'EUR', balance: 40 },
  ],
};

const apply = (patch: unknown, draft: SetupDraft = initialDraft(), accountsExist = false) =>
  applyPatch(draft, patch, { accountsExist });

describe('applyPatch', () => {
  it('fills the draft as typing would, and every step it reaches passes as it is', () => {
    const { draft, changes } = apply(FULL);
    expect(draft.rentMinor).toBe(45000);
    expect(draft.rentSchedule).toMatchObject({ on: true, frequency: 'monthly', day: 1 });
    expect(amountOf(draft.incomes, 'income-job')).toBe(52000);
    expect(draft.incomes.every((line) => line.schedule?.on)).toBe(true);
    expect(amountOf(draft.fixed, 'phone')).toBe(1299);
    expect(amountOf(draft.envelopes, 'food')).toBe(22000);
    expect(amountOf(draft.envelopes, 'shopping')).toBe(0);
    expect(draft.spendingBudgetMinor).toBe(40000);
    expect(draft.accounts.map((a) => [a.name, a.kind, a.currency, a.openingMinor])).toEqual([
      ['Sparkasse', 'bank', 'EUR', 125050],
      ['Cash', 'cash', 'EUR', 4000],
    ]);
    expect(draft.accounts.every((a) => a.key?.startsWith('draft-'))).toBe(true);
    for (const step of ['accounts', 'income', 'fixed', 'envelopes'] as const) {
      expect(validateStep(step, draft, TODAY), step).toEqual([]);
    }
    expect(changes.map((c) => `${c.step}:${c.what}`)).toEqual([
      'fixed:rent',
      'income:income-job',
      'income:income-parents',
      'fixed:phone',
      'fixed:insurance',
      'envelopes:food',
      'envelopes:eating-out',
      'envelopes:budget',
      'accounts:accounts',
    ]);
  });

  it('changes only what the patch names', () => {
    const first = apply(FULL).draft;
    const { draft, changes } = apply({ ...NONE, envelopes: [{ categoryId: 'food', amount: 250 }] }, first);
    expect(draft).toEqual({ ...first, envelopes: draft.envelopes });
    expect(amountOf(draft.envelopes, 'food')).toBe(25000);
    expect(amountOf(draft.envelopes, 'eating-out')).toBe(6000);
    expect(changes).toEqual([{ step: 'envelopes', what: 'food', minor: 25000 }]);
  });

  it('leaves out an amount that isn’t money or is over €20,000, and applies the rest', () => {
    const { draft, changes } = apply({
      ...NONE,
      rent: -450,
      incomes: [
        { categoryId: 'income-job', amount: 20_000.01 },
        { categoryId: 'income-parents', amount: 1e12 },
        { categoryId: 'income-other', amount: 50 },
      ],
      spendingBudget: -5,
    });
    expect(draft.rentMinor).toBe(0);
    expect(draft.incomes.map((line) => [line.categoryId, line.monthlyMinor])).toEqual([['income-other', 5000]]);
    expect(draft.spendingBudgetMinor).toBe(0);
    expect(changes).toEqual([{ step: 'income', what: 'income-other', minor: 5000 }]);
  });

  it('keeps each line in its own step: rent is no fixed line, and an income is no envelope', () => {
    const { draft, changes } = apply({
      ...NONE,
      fixed: [{ categoryId: 'rent', amount: 450 }],
      envelopes: [{ categoryId: 'income-job', amount: 100 }, { categoryId: 'casino', amount: 50 }],
      incomes: [{ categoryId: 'food', amount: 200 }],
    });
    expect(draft).toEqual(initialDraft());
    expect(changes).toEqual([]);
  });

  it('changes the accounts only in a setup that has none stored, and only to accounts the app can hold', () => {
    expect(apply(FULL, initialDraft(true), true).draft.accounts).toEqual([]);
    const odd = apply({
      ...NONE,
      accounts: [
        { name: '  ', kind: 'bank', currency: 'EUR', balance: 10 },
        { name: 'Wallet', kind: 'cash', currency: 'BTC', balance: 1 },
        { name: 'Home bank', kind: 'bank', currency: 'inr', balance: -2000 },
      ],
    }).draft;
    expect(odd.accounts.map((a) => [a.name, a.currency, a.openingMinor])).toEqual([['Home bank', 'INR', -200000]]);
    expect(apply({ ...NONE, accounts: [] }).draft.accounts).toEqual(initialDraft().accounts);
  });

  it('changes nothing for something that isn’t a patch', () => {
    // JSON carries no NaN, and the patch's schema refuses one.
    for (const patch of [null, 'rent 450', { ...NONE, rent: '450' }, { ...NONE, extra: true }, { ...NONE, rent: Number.NaN }]) {
      expect(apply(patch)).toEqual({ draft: initialDraft(), changes: [] });
    }
  });
});

describe('draftForChat', () => {
  it('sends the draft in euros, with null for a field that isn’t an amount, and no keys or schedules', () => {
    const { draft } = apply(FULL);
    const chat = draftForChat({ ...draft, spendingBudgetMinor: Number.NaN });
    expect(chat).toMatchObject({ rentEur: 450, spendingBudgetEur: null });
    expect(chat.accounts[0]).toEqual({ name: 'Sparkasse', kind: 'bank', currency: 'EUR', balance: 1250.5 });
    expect(chat.incomes).toEqual([
      { categoryId: 'income-job', monthlyEur: 520 },
      { categoryId: 'income-parents', monthlyEur: 300 },
    ]);
    expect(JSON.stringify(chat)).not.toMatch(/draft-|schedule|key/);
  });
});
