import { describe, expect, it } from 'vitest';
import type { Plan, Schedule } from '@/db/types';
import {
  accountOptions,
  draftAccountOf,
  draftFromPlan,
  draftToRecords,
  dropUnparsed,
  envelopesFooter,
  initialDraft,
  rangeLine,
  setLineAmount,
  setLineSchedule,
  setRentAmount,
  shouldShowInstallHint,
  summarizeDraft,
  validateStep,
  withAccountKeys,
  withAmount,
  type SetupDraft,
} from './draft';

const TODAY = '2026-10-16';

const draft: SetupDraft = {
  rentMinor: 40000,
  accounts: [
    { name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 100000 },
    { name: 'Home bank', kind: 'bank', currency: 'INR', openingMinor: 5000000 },
    { name: 'Cash', kind: 'cash', currency: 'EUR', openingMinor: 5000 },
  ],
  incomes: [
    { categoryId: 'income-job', monthlyMinor: 40000 },
    { categoryId: 'income-parents', monthlyMinor: 50000 },
  ],
  fixed: [],
  oneOffs: [{ name: 'Semester fee', amountMinor: 30000, dueMonth: '2027-03' }],
  guesses: [
    { categoryId: 'food', monthlyMinor: 20000 },
    { categoryId: 'eating-out', monthlyMinor: 8000 },
    { categoryId: 'going-out', monthlyMinor: 6000 },
    { categoryId: 'transport', monthlyMinor: 2000 },
    { categoryId: 'shopping', monthlyMinor: 4000 },
    { categoryId: 'other', monthlyMinor: 2000 },
  ],
  envelopes: [
    { categoryId: 'food', monthlyMinor: 31000 },
    { categoryId: 'eating-out', monthlyMinor: 12400 },
    { categoryId: 'going-out', monthlyMinor: 0 },
    { categoryId: 'transport', monthlyMinor: 0 },
    { categoryId: 'shopping', monthlyMinor: 0 },
    { categoryId: 'health', monthlyMinor: 0 },
    { categoryId: 'personal-care', monthlyMinor: 0 },
    { categoryId: 'study', monthlyMinor: 0 },
    { categoryId: 'household', monthlyMinor: 0 },
    { categoryId: 'travel', monthlyMinor: 0 },
    { categoryId: 'gifts', monthlyMinor: 0 },
    { categoryId: 'other', monthlyMinor: 0 },
  ],
};

describe('draftToRecords', () => {
  it('stores the rent as the rent fixed cost', () => {
    const { plan } = draftToRecords(draft, TODAY);
    expect(plan.fixed).toContainEqual({ categoryId: 'rent', monthlyMinor: 40000 });
  });

  it('puts rent first, then the other fixed costs', () => {
    const withPhone = { ...draft, fixed: [{ categoryId: 'phone', monthlyMinor: 2500 }] };
    expect(draftToRecords(withPhone, TODAY).plan.fixed).toEqual([
      { categoryId: 'rent', monthlyMinor: 40000 },
      { categoryId: 'phone', monthlyMinor: 2500 },
    ]);
  });

  it("creates each one-off in today's month", () => {
    const { plan } = draftToRecords(draft, TODAY);
    expect(plan.oneOffs).toHaveLength(1);
    expect(plan.oneOffs[0]).toMatchObject({
      name: 'Semester fee',
      amountMinor: 30000,
      createdMonth: '2026-10',
      dueMonth: '2027-03',
    });
    expect(plan.oneOffs[0].id).toEqual(expect.any(String));
  });

  it('stamps every guess with today', () => {
    const { guesses } = draftToRecords(draft, TODAY);
    expect(guesses).toHaveLength(6);
    expect(guesses.every((g) => g.guessedOn === TODAY)).toBe(true);
    expect(guesses).toContainEqual({ categoryId: 'eating-out', monthlyMinor: 8000, guessedOn: TODAY });
  });

  it('creates the plan today', () => {
    const { plan } = draftToRecords(draft, TODAY);
    expect(plan).toMatchObject({ id: 'current', cityId: 'regensburg', createdOn: TODAY });
    expect(plan.incomes).toEqual(draft.incomes);
    expect(plan.envelopes).toEqual(draft.envelopes);
  });

  it('gives each account its own id and creation time', () => {
    const { accounts } = draftToRecords(draft, TODAY);
    expect(accounts.map((a) => a.name)).toEqual(['Local bank', 'Home bank', 'Cash']);
    expect(accounts[1]).toMatchObject({ kind: 'bank', currency: 'INR', openingMinor: 5000000 });
    expect(new Set(accounts.map((a) => a.id)).size).toBe(3);
    expect(accounts.every((a) => !Number.isNaN(Date.parse(a.createdAt)))).toBe(true);
  });

  describe('editing a saved plan', () => {
    const existing: Plan = {
      id: 'current',
      cityId: 'regensburg',
      incomes: [{ categoryId: 'income-parents', monthlyMinor: 90000 }],
      fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
      oneOffs: [
        { id: 'fee', name: 'Semester fee', amountMinor: 30000, createdMonth: '2026-09', dueMonth: '2027-03' },
      ],
      envelopes: draft.envelopes,
      createdOn: '2026-10-01',
    };
    const laptop = { name: 'Laptop', amountMinor: 80000, dueMonth: '2027-02' };

    it('keeps the creation date and a kept one-off, and dates a new one-off today', () => {
      const edited: SetupDraft = {
        ...draft,
        oneOffs: [{ name: 'Semester fee', amountMinor: 30000, dueMonth: '2027-03' }, laptop],
      };
      const { plan } = draftToRecords(edited, TODAY, existing);
      expect(plan.createdOn).toBe('2026-10-01');
      expect(plan.oneOffs[0]).toEqual(existing.oneOffs[0]);
      expect(plan.oneOffs[1]).toMatchObject({ ...laptop, createdMonth: '2026-10' });
      expect(plan.oneOffs[1].id).not.toBe('fee');
    });

    it('keeps a one-off that still carries its id, even when it was changed', () => {
      const edited: SetupDraft = {
        ...draft,
        oneOffs: [{ id: 'fee', name: 'Semester fee', amountMinor: 35000, dueMonth: '2027-04' }],
      };
      const { plan } = draftToRecords(edited, TODAY, existing);
      expect(plan.oneOffs).toEqual([
        { id: 'fee', name: 'Semester fee', amountMinor: 35000, createdMonth: '2026-09', dueMonth: '2027-04' },
      ]);
    });

    it('does not let two rows claim the same kept one-off', () => {
      const twin = { name: 'Semester fee', amountMinor: 30000, dueMonth: '2027-03' };
      const { plan } = draftToRecords({ ...draft, oneOffs: [twin, twin] }, TODAY, existing);
      expect(plan.oneOffs.map((o) => o.createdMonth)).toEqual(['2026-09', '2026-10']);
      expect(new Set(plan.oneOffs.map((o) => o.id)).size).toBe(2);
    });

    it('round-trips: opening the plan and saving it unchanged changes nothing', () => {
      expect(draftToRecords(draftFromPlan(existing), TODAY, existing).plan).toEqual(existing);
    });
  });
});

describe('draftFromPlan', () => {
  it('takes rent out of the fixed costs and leaves accounts and guesses to Settings', () => {
    const plan: Plan = {
      id: 'current',
      cityId: 'regensburg',
      incomes: [{ categoryId: 'income-job', monthlyMinor: 40000 }],
      fixed: [
        { categoryId: 'rent', monthlyMinor: 40000 },
        { categoryId: 'phone', monthlyMinor: 2500 },
      ],
      oneOffs: [],
      envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }],
      createdOn: '2026-10-01',
    };
    const d = draftFromPlan(plan);
    expect(d.rentMinor).toBe(40000);
    expect(d.fixed).toMatchObject([{ categoryId: 'phone', monthlyMinor: 2500 }]);
    expect(d.fixed).toHaveLength(1);
    // Lines saved without a schedule open with "Add it automatically" off.
    expect(d.fixed[0].schedule?.on).toBe(false);
    expect(d.rentSchedule?.on).toBe(false);
    expect(d.accounts).toEqual([]);
    expect(d.guesses).toEqual([]);
    expect(d.envelopes).toHaveLength(12);
    expect(d.envelopes[0]).toEqual({ categoryId: 'food', monthlyMinor: 31000 });
    expect(d.envelopes[1]).toEqual({ categoryId: 'eating-out', monthlyMinor: 0 });
    // A plan saved before the new categories has no row for them: they start at €0.
    expect(d.envelopes.find((e) => e.categoryId === 'health')).toEqual({ categoryId: 'health', monthlyMinor: 0 });
  });
});

describe('validateStep', () => {
  it('asks for a guess on the six categories people guess, and on no other', () => {
    expect(validateStep('guesses', draft, TODAY)).toEqual([]);
    const fresh = initialDraft();
    expect(fresh.envelopes).toHaveLength(12);
    expect(validateStep('guesses', fresh, TODAY)).toEqual([
      'Add a guess for Food & groceries',
      'Add a guess for Eating out',
      'Add a guess for Going out',
      'Add a guess for Transport',
      'Add a guess for Shopping',
      'Add a guess for Other',
    ]);
  });

  it('names the guess that is missing', () => {
    const noEatingOut = { ...draft, guesses: draft.guesses.filter((g) => g.categoryId !== 'eating-out') };
    expect(validateStep('guesses', noEatingOut, TODAY)).toEqual(['Add a guess for Eating out']);
  });

  it('accepts a guess of 0', () => {
    const zero = { ...draft, guesses: draft.guesses.map((g) => ({ ...g, monthlyMinor: 0 })) };
    expect(validateStep('guesses', zero, TODAY)).toEqual([]);
  });

  it('rejects a guess that did not parse', () => {
    const bad = withAmount(draft.guesses, 'food', Number.NaN);
    expect(validateStep('guesses', { ...draft, guesses: bad }, TODAY)).toEqual([
      'Check the guess for Food & groceries.',
    ]);
  });

  it('needs at least one account, each with a name and a readable balance', () => {
    expect(validateStep('accounts', { ...draft, accounts: [] }, TODAY)).toEqual(['Add at least one account']);
    expect(validateStep('accounts', draft, TODAY)).toEqual([]);
    const blank = [{ name: ' ', kind: 'cash' as const, currency: 'EUR' as const, openingMinor: Number.NaN }];
    expect(validateStep('accounts', { ...draft, accounts: blank }, TODAY)).toEqual([
      'Give every account a name.',
      'Check the opening balance for account 1.',
    ]);
  });

  it('accepts a rent of 0 and rejects one that did not parse', () => {
    expect(validateStep('city-rent', { ...draft, rentMinor: 0 }, TODAY)).toEqual([]);
    expect(validateStep('city-rent', { ...draft, rentMinor: Number.NaN }, TODAY)).toEqual([
      'Check the amount for Rent.',
    ]);
  });

  it('names the income and fixed cost that did not parse', () => {
    const incomes = withAmount(draft.incomes, 'income-bafoeg', Number.NaN);
    expect(validateStep('income', { ...draft, incomes }, TODAY)).toEqual(['Check the amount for BAföG.']);
    const fixed = withAmount(draft.fixed, 'phone', Number.NaN);
    expect(validateStep('fixed', { ...draft, fixed }, TODAY)).toEqual(['Check the amount for Phone & internet.']);
    expect(validateStep('income', draft, TODAY)).toEqual([]);
    expect(validateStep('fixed', draft, TODAY)).toEqual([]);
  });

  describe('one-offs', () => {
    const fee = { name: 'Semester fee', amountMinor: 30000 };

    it('is fine with none', () => {
      expect(validateStep('one-offs', { ...draft, oneOffs: [] }, TODAY)).toEqual([]);
    });

    it('wants a due month after the current one', () => {
      const check = (dueMonth: string) =>
        validateStep('one-offs', { ...draft, oneOffs: [{ ...fee, dueMonth }] }, TODAY);
      expect(check('2026-11')).toEqual([]);
      expect(check('2026-10')).toEqual(['Pick a month after this one.']);
      expect(check('2026-09')).toEqual(['Pick a month after this one.']);
      expect(check('')).toEqual(['Pick a month after this one.']);
      expect(check('2027-13')).toEqual(['Pick a month after this one.']);
    });

    it('wants a name and an amount above zero', () => {
      const oneOffs = [{ name: ' ', amountMinor: 0, dueMonth: '2027-03' }];
      expect(validateStep('one-offs', { ...draft, oneOffs }, TODAY)).toEqual([
        'Name every one-off cost.',
        'Enter an amount above 0 for one-off cost 1.',
      ]);
    });

    describe('in edit mode', () => {
      // Saved in September, due in October: by the 16th of October the due month is no longer "after this one".
      const saved: Plan = {
        id: 'current',
        cityId: 'regensburg',
        incomes: draft.incomes.map(({ categoryId, monthlyMinor }) => ({ categoryId, monthlyMinor })),
        fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
        oneOffs: [{ id: 'fee', name: 'Semester fee', amountMinor: 30000, createdMonth: '2026-09', dueMonth: '2026-10' }],
        envelopes: draft.envelopes,
        createdOn: '2026-09-01',
      };
      const kept = { id: 'fee', ...fee, dueMonth: '2026-10' };
      const check = (oneOffs: SetupDraft['oneOffs']) =>
        validateStep('one-offs', { ...draft, oneOffs }, TODAY, saved);

      it('does not ask again about a kept one-off whose due month has passed', () => {
        expect(check([kept])).toEqual([]);
        // Without the saved plan the same row is a new one and is rejected.
        expect(validateStep('one-offs', { ...draft, oneOffs: [kept] }, TODAY)).toEqual([
          'Pick a month after this one.',
        ]);
      });

      it('matches a row without an id by name, amount and due month', () => {
        expect(check([{ ...fee, dueMonth: '2026-10' }])).toEqual([]);
      });

      it('still checks a kept one-off whose due month was changed to a past month', () => {
        expect(check([{ ...kept, dueMonth: '2026-09' }])).toEqual(['Pick a month after this one.']);
        expect(check([{ ...kept, dueMonth: '2026-11' }])).toEqual([]);
      });

      it('still checks a new one-off, and still checks a kept row for a name and an amount', () => {
        const laptop = { name: 'Laptop', amountMinor: 80000, dueMonth: '2026-10' };
        expect(check([kept, laptop])).toEqual(['Pick a month after this one.']);
        expect(check([{ ...kept, amountMinor: 0 }])).toEqual(['Enter an amount above 0 for Semester fee.']);
      });
    });

    it('says it once when several rows share a problem', () => {
      const oneOffs = [
        { ...fee, dueMonth: '2026-01' },
        { name: 'Laptop', amountMinor: 80000, dueMonth: '2026-02' },
      ];
      expect(validateStep('one-offs', { ...draft, oneOffs }, TODAY)).toEqual(['Pick a month after this one.']);
    });
  });

  it('wants a readable amount in every envelope', () => {
    expect(validateStep('envelopes', draft, TODAY)).toEqual([]);
    const missing = { ...draft, envelopes: draft.envelopes.filter((e) => e.categoryId !== 'other') };
    expect(validateStep('envelopes', missing, TODAY)).toEqual(['Add an amount for Other']);
    const bad = withAmount(draft.envelopes, 'food', Number.NaN);
    expect(validateStep('envelopes', { ...draft, envelopes: bad }, TODAY)).toEqual([
      'Check the amount for Food & groceries.',
    ]);
  });

  it('lets a fresh draft through every step except the unanswered guesses', () => {
    const fresh = initialDraft();
    expect(validateStep('city-rent', fresh, TODAY)).toEqual([]);
    expect(validateStep('accounts', fresh, TODAY)).toEqual([]);
    expect(validateStep('income', fresh, TODAY)).toEqual([]);
    expect(validateStep('fixed', fresh, TODAY)).toEqual([]);
    expect(validateStep('one-offs', fresh, TODAY)).toEqual([]);
    expect(validateStep('envelopes', fresh, TODAY)).toEqual([]);
    // Guesses start unanswered: a blank is not a 0, because they are saved once.
    expect(validateStep('guesses', fresh, TODAY)).toHaveLength(6);
  });
});

describe('initialDraft', () => {
  it('prefills three accounts', () => {
    expect(initialDraft().accounts.map((a) => a.name)).toEqual(['Local bank', 'Home bank', 'Cash']);
  });

  it('leaves the accounts out when some already exist, so saving adds none', () => {
    const fresh = initialDraft(true);
    expect(fresh.accounts).toEqual([]);
    expect(draftToRecords(fresh, TODAY).accounts).toEqual([]);
  });
});

describe('withAmount', () => {
  it('adds, replaces and removes a row, keeping the category order', () => {
    let list = withAmount([], 'income-parents', 50000);
    list = withAmount(list, 'income-job', 40000);
    expect(list.map((a) => a.categoryId)).toEqual(['income-job', 'income-parents']);
    list = withAmount(list, 'income-job', 45000);
    expect(list[0]).toEqual({ categoryId: 'income-job', monthlyMinor: 45000 });
    list = withAmount(list, 'income-job', undefined);
    expect(list).toEqual([{ categoryId: 'income-parents', monthlyMinor: 50000 }]);
  });
});

describe('dropUnparsed', () => {
  it('turns amounts that did not parse into 0 or removes their rows', () => {
    const messy: SetupDraft = {
      ...draft,
      rentMinor: Number.NaN,
      accounts: [{ name: 'Cash', kind: 'cash', currency: 'EUR', openingMinor: Number.NaN }],
      incomes: withAmount(draft.incomes, 'income-bafoeg', Number.NaN),
      fixed: withAmount([], 'phone', Number.NaN),
      oneOffs: [{ name: 'Fee', amountMinor: Number.NaN, dueMonth: '2027-03' }],
      guesses: withAmount(draft.guesses, 'food', Number.NaN),
      envelopes: withAmount(draft.envelopes, 'food', Number.NaN),
    };
    const clean = dropUnparsed(messy);
    expect(clean.rentMinor).toBe(0);
    expect(clean.accounts[0].openingMinor).toBe(0);
    expect(clean.incomes).toEqual(draft.incomes);
    expect(clean.fixed).toEqual([]);
    expect(clean.oneOffs[0].amountMinor).toBe(0);
    expect(clean.guesses.some((g) => g.categoryId === 'food')).toBe(false);
    expect(clean.envelopes.find((e) => e.categoryId === 'food')?.monthlyMinor).toBe(0);
  });
});

describe('summarizeDraft', () => {
  it('works out available and planned money from the draft', () => {
    // 900 income - 400 rent - 60 a month set aside for the 300 fee (Oct to Mar) = 440.
    expect(summarizeDraft(draft, TODAY)).toMatchObject({
      availableMinor: 44000,
      envelopesMinor: 43400,
      overByMinor: 0,
    });
  });

  it('says by how much the envelopes are over', () => {
    const over = { ...draft, envelopes: withAmount(draft.envelopes, 'eating-out', 15500) };
    expect(summarizeDraft(over, TODAY)).toMatchObject({
      availableMinor: 44000,
      envelopesMinor: 46500,
      overByMinor: 2500,
    });
  });

  it('counts an amount that did not parse as 0', () => {
    const bad = { ...draft, envelopes: withAmount(draft.envelopes, 'eating-out', Number.NaN) };
    expect(summarizeDraft(bad, TODAY).envelopesMinor).toBe(31000);
  });
});

describe('envelopesFooter', () => {
  const footer = (d: SetupDraft) => envelopesFooter(summarizeDraft(d, TODAY));

  it('reads like the brief when over', () => {
    const over = { ...draft, envelopes: withAmount(draft.envelopes, 'eating-out', 15500) };
    expect(footer(over)).toBe('Available €440 · Planned €465 · Over by €25');
  });

  it('drops the over part when the plan fits', () => {
    expect(footer(draft)).toBe('Available €440 · Planned €434');
  });

  describe('with a set-aside that is not a whole euro', () => {
    // 100 over Oct, Nov, Dec is 33.34 a month: 900 - 400 - 33.34 = 466.66 available.
    const course = { name: 'Course', amountMinor: 10000, dueMonth: '2027-01' };
    const planned = (eatingOut: number): SetupDraft => ({
      ...draft,
      oneOffs: [course],
      envelopes: withAmount(draft.envelopes, 'eating-out', eatingOut),
    });

    it('rounds Available down, so it is never more than there is', () => {
      expect(summarizeDraft(planned(0), TODAY).availableMinor).toBe(46666);
      expect(footer(planned(0))).toBe('Available €466 · Planned €310');
    });

    it('rounds the overage up, so it never reads Over by €0', () => {
      // 310 + 157 = 467 against 466.66: over by 34 cents.
      const d = planned(15700);
      expect(summarizeDraft(d, TODAY).overByMinor).toBe(34);
      expect(footer(d)).toBe('Available €466 · Planned €467 · Over by €1');
    });

    it('says Over by €25 for 24.01 over and Over by €24 for exactly 24 over', () => {
      expect(footer(planned(15666 + 2401))).toContain('Over by €25');
      expect(footer(planned(15666 + 2400))).toContain('Over by €24');
    });
  });
});

describe('rangeLine', () => {
  const range = { minMinor: 3000, maxMinor: 13500 };

  it('gives the range as it is when it has a source', () => {
    expect(rangeLine('Students here', { ...range, source: 'DSW 22nd Sozialerhebung 2021' })).toBe(
      'Students here: €30–135',
    );
  });

  it('marks a range without a source as an estimate', () => {
    expect(rangeLine('Students here', { ...range, source: 'Estimate' })).toBe('Students here: €30–135 (estimate)');
  });
});

describe('shouldShowInstallHint', () => {
  it('shows on iOS when not installed', () => {
    expect(shouldShowInstallHint({ isIos: true, standalone: false })).toBe(true);
  });

  it('hides once the app runs standalone', () => {
    expect(shouldShowInstallHint({ isIos: true, standalone: true })).toBe(false);
  });

  it('hides everywhere else', () => {
    expect(shouldShowInstallHint({ isIos: false, standalone: false })).toBe(false);
    expect(shouldShowInstallHint({ isIos: false, standalone: true })).toBe(false);
  });
});

describe('adding lines automatically', () => {
  // A new setup: the prefilled accounts have draft keys, and Local bank is the first.
  const fresh = initialDraft();
  const withLines = (d: SetupDraft): SetupDraft => ({
    ...setRentAmount(d, 40000),
    incomes: setLineAmount(setLineAmount([], 'income-parents', 50000), 'income-job', 40000),
    fixed: setLineAmount([], 'phone', 2500),
  });

  it('gives every draft account a key of its own, and keeps the keys it has', () => {
    expect(new Set(fresh.accounts.map((a) => a.key)).size).toBe(3);
    const blank = { name: '', kind: 'bank' as const, currency: 'EUR' as const, openingMinor: 0 };
    const added = withAccountKeys({ ...fresh, accounts: [...fresh.accounts, blank] });
    expect(added.accounts.slice(0, 3)).toEqual(fresh.accounts);
    expect(added.accounts[3].key).toEqual(expect.any(String));
    expect(new Set(added.accounts.map((a) => a.key)).size).toBe(4);
    expect(withAccountKeys(added)).toBe(added);
  });

  it('offers the draft accounts in a new setup, and the stored ones otherwise', () => {
    const stored = [{ id: 'a1', name: 'Sparkasse', currency: 'EUR' as const }];
    expect(accountOptions(fresh, stored).map((a) => [a.name, a.currency])).toEqual([
      ['Local bank', 'EUR'],
      ['Home bank', 'INR'],
      ['Cash', 'EUR'],
    ]);
    expect(accountOptions(initialDraft(true), stored)).toEqual(stored);
  });

  it('turns it on for a line that gets an amount, monthly on the 1st from the first account', () => {
    const d = withLines(fresh);
    expect(d.rentSchedule).toEqual({ on: true, frequency: 'monthly', day: 1, accountId: '', foreignMinor: 0 });
    expect(d.incomes.every((l) => l.schedule?.on)).toBe(true);

    const { plan, accounts } = draftToRecords(d, TODAY);
    const local = accounts.find((a) => a.name === 'Local bank');
    expect(plan.fixed[0]).toEqual({
      categoryId: 'rent',
      monthlyMinor: 40000,
      schedule: {
        id: expect.any(String),
        frequency: 'monthly',
        day: 1,
        accountId: local?.id,
        amountMinor: 40000,
        startOn: '2026-10-17',
        postedThrough: TODAY,
      },
    });
    expect(plan.incomes.map((l) => l.schedule?.amountMinor)).toEqual([40000, 50000]);
    expect(plan.fixed[1].schedule).toMatchObject({ accountId: local?.id, amountMinor: 2500 });
    expect(new Set([...plan.incomes, ...plan.fixed].map((l) => l.schedule?.id)).size).toBe(4);
    // The draft keys never reach the database.
    expect(accounts.every((a) => !('key' in a))).toBe(true);
  });

  it('saves the picked account, day and weekday', () => {
    const d = withLines(fresh);
    const cash = d.accounts[2].key ?? '';
    const job = { on: true, frequency: 'weekly' as const, day: 5, accountId: cash, foreignMinor: 0 };
    const { plan, accounts } = draftToRecords({ ...d, incomes: setLineSchedule(d.incomes, 'income-job', job) }, TODAY);
    expect(plan.incomes[0].schedule).toMatchObject({
      frequency: 'weekly',
      day: 5,
      accountId: accounts.find((a) => a.name === 'Cash')?.id,
      // €400 a month is €92.31 a week; the plan keeps the €400.
      amountMinor: 9231,
    });
    expect(plan.incomes[0].monthlyMinor).toBe(40000);
  });

  it('posts the amount typed in the currency of a foreign account and keeps the euro figure for the plan', () => {
    const d = withLines(fresh);
    const home = d.accounts[1].key ?? '';
    const parents = { on: true, frequency: 'monthly' as const, day: 1, accountId: home, foreignMinor: 5_000_000 };
    const { plan } = draftToRecords({ ...d, incomes: setLineSchedule(d.incomes, 'income-parents', parents) }, TODAY);
    expect(plan.incomes[1]).toMatchObject({ monthlyMinor: 50000, schedule: { amountMinor: 5_000_000 } });
  });

  it('asks for that amount before the step can be left', () => {
    const d = withLines(fresh);
    const home = d.accounts[1].key ?? '';
    const inr = { on: true, frequency: 'monthly' as const, day: 1, accountId: home, foreignMinor: 0 };
    const incomes = setLineSchedule(d.incomes, 'income-job', inr);
    const check = (job: typeof inr) =>
      validateStep('income', { ...d, incomes: setLineSchedule(incomes, 'income-job', job) }, TODAY);
    expect(check(inr)).toEqual(['Enter the amount in INR for Job.']);
    expect(check({ ...inr, foreignMinor: Number.NaN })).toEqual(['Enter the amount in INR for Job.']);
    expect(check({ ...inr, foreignMinor: 100 })).toEqual([]);
    expect(check({ ...inr, on: false })).toEqual([]);
    // Rent's choices sit in the fixed costs step.
    expect(validateStep('fixed', { ...d, rentSchedule: inr }, TODAY)).toEqual(['Enter the amount in INR for Rent.']);
    expect(validateStep('city-rent', { ...d, rentSchedule: inr }, TODAY)).toEqual([]);
  });

  it('saves no schedule for a line that is off, or that has no amount', () => {
    const d = withLines(fresh);
    const off = { ...d, rentSchedule: d.rentSchedule && { ...d.rentSchedule, on: false } };
    expect(draftToRecords(off, TODAY).plan.fixed[0]).toEqual({ categoryId: 'rent', monthlyMinor: 40000 });
    expect(draftToRecords(setRentAmount(d, 0), TODAY).plan.fixed[0]).toEqual({ categoryId: 'rent', monthlyMinor: 0 });
  });

  it('keeps the choices of a line that is cleared, and leaves it out of the plan until it has an amount again', () => {
    const d = withLines(fresh);
    const weekly = { on: true, frequency: 'weekly' as const, day: 3, accountId: '', foreignMinor: 0 };
    const cleared = setLineAmount(setLineSchedule(d.incomes, 'income-job', weekly), 'income-job', 0);
    expect(draftToRecords({ ...d, incomes: cleared }, TODAY).plan.incomes.map((l) => l.categoryId)).toEqual([
      'income-parents',
    ]);
    const typedAgain = setLineAmount(cleared, 'income-job', 30000);
    expect(typedAgain.find((l) => l.categoryId === 'income-job')?.schedule).toEqual(weekly);
    // A row without choices is simply removed.
    expect(setLineAmount([{ categoryId: 'phone', monthlyMinor: 2500 }], 'phone', 0)).toEqual([]);
  });

  describe('in edit mode', () => {
    const rentSchedule: Schedule = {
      id: 'rent-s',
      frequency: 'monthly',
      day: 3,
      accountId: 'local',
      amountMinor: 42000,
      startOn: '2026-10-17',
      postedThrough: '2026-11-30',
    };
    const jobSchedule: Schedule = {
      id: 'job-s',
      frequency: 'weekly',
      day: 5,
      accountId: 'home',
      amountMinor: 1_000_000,
      startOn: '2026-10-17',
      postedThrough: '2026-11-08',
      paused: true,
    };
    const saved: Plan = {
      id: 'current',
      cityId: 'regensburg',
      incomes: [
        { categoryId: 'income-job', monthlyMinor: 40000, schedule: jobSchedule },
        { categoryId: 'income-parents', monthlyMinor: 50000 },
      ],
      fixed: [
        { categoryId: 'rent', monthlyMinor: 42000, schedule: rentSchedule },
        { categoryId: 'phone', monthlyMinor: 2500 },
      ],
      oneOffs: [],
      envelopes: draft.envelopes,
      createdOn: '2026-10-16',
    };
    const stored = [
      { id: 'local', name: 'Local bank', currency: 'EUR' as const },
      { id: 'home', name: 'Home bank', currency: 'INR' as const },
    ];

    it('carries every schedule through unchanged, rent included', () => {
      expect(draftToRecords(draftFromPlan(saved), TODAY, saved, stored).plan).toEqual(saved);
    });

    it('keeps the id, start, watermark and pause of a schedule whose day or amount changes', () => {
      const d = draftFromPlan(saved);
      const moved = d.rentSchedule && { ...d.rentSchedule, day: 5 };
      const { plan } = draftToRecords({ ...d, rentSchedule: moved }, TODAY, saved, stored);
      expect(plan.fixed[0].schedule).toEqual({ ...rentSchedule, day: 5 });
      const rent = draftToRecords(setRentAmount(d, 43000), TODAY, saved, stored).plan.fixed[0];
      expect(rent).toEqual({ categoryId: 'rent', monthlyMinor: 43000, schedule: { ...rentSchedule, amountMinor: 43000 } });
      const job = draftToRecords(d, TODAY, saved, stored).plan.incomes[0].schedule;
      expect(job).toEqual(jobSchedule);
    });

    it('leaves a line of an older plan off, even when its amount changes', () => {
      const d = draftFromPlan(saved);
      const incomes = setLineAmount(d.incomes, 'income-parents', 55000);
      expect(draftToRecords({ ...d, incomes }, TODAY, saved, stored).plan.incomes[1]).toEqual({
        categoryId: 'income-parents',
        monthlyMinor: 55000,
      });
    });

    describe('when the account a schedule uses is gone', () => {
      // Rent's account was deleted; Home bank (INR) comes first, so no fallback may quietly take its place.
      const orphaned: Plan = {
        ...saved,
        fixed: [{ ...saved.fixed[0], schedule: { ...rentSchedule, accountId: 'gone', paused: true } }, saved.fixed[1]],
      };
      const accounts = [stored[1], stored[0]];

      it('saves the schedule untouched until an account is picked', () => {
        const d = draftFromPlan(orphaned);
        expect(draftAccountOf(d.rentSchedule, accountOptions(d, accounts))).toBeUndefined();
        expect(validateStep('fixed', d, TODAY, orphaned, accounts)).toEqual([]);
        const { plan } = draftToRecords(setRentAmount(d, 43000), TODAY, orphaned, accounts);
        expect(plan.fixed[0]).toEqual({ categoryId: 'rent', monthlyMinor: 43000, schedule: orphaned.fixed[0].schedule });
      });

      it('adds it again from tomorrow once an account is picked, without back-posting', () => {
        const d = draftFromPlan(orphaned);
        const picked = d.rentSchedule && { ...d.rentSchedule, accountId: 'local' };
        const { plan } = draftToRecords({ ...d, rentSchedule: picked }, TODAY, orphaned, accounts);
        expect(plan.fixed[0].schedule).toEqual({
          ...rentSchedule,
          accountId: 'local',
          paused: true,
          startOn: '2026-10-17',
          // The later of the old watermark (30 November) and today.
          postedThrough: '2026-11-30',
        });
        const later = draftToRecords({ ...d, rentSchedule: picked }, '2026-12-05', orphaned, accounts).plan;
        expect(later.fixed[0].schedule).toMatchObject({ startOn: '2026-12-06', postedThrough: '2026-12-05' });
      });
    });

    it('keeps a paused line out of the preview of the plan', () => {
      // Without the stored accounts (as the envelopes step previews it) the saved schedule still carries the pause.
      expect(summarizeDraft(draftFromPlan(saved), TODAY, saved).incomeMinor).toBe(50000);
    });
  });
});
