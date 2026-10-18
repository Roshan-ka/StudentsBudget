import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { monthStatus } from '@/lib/budget';
import { categoryHistory, incomeBySource, spendingByCategory } from './aggregate';

const plan: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [{ categoryId: 'income-parents', monthlyMinor: 90000 }],
  fixed: [
    { categoryId: 'rent', monthlyMinor: 40000 },
    { categoryId: 'phone', monthlyMinor: 0 },
  ],
  oneOffs: [],
  envelopes: [
    { categoryId: 'food', monthlyMinor: 31000 },
    { categoryId: 'eating-out', monthlyMinor: 12400 },
    { categoryId: 'going-out', monthlyMinor: 0 },
  ],
  // The 1st, so October is a full month for this plan. The setup-month case sets its own date.
  createdOn: '2026-10-01',
};

/** No fixed costs and a single envelope, so a test sees only the rows it put there. */
const foodOnly: Plan = { ...plan, fixed: [], envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }] };

let nextId = 0;
function entry(
  type: 'expense' | 'income',
  categoryId: string,
  date: string,
  eurMinor: number,
  amountMinor: number = eurMinor,
): Entry {
  nextId += 1;
  return {
    id: `e${nextId}`,
    type,
    categoryId,
    date,
    accountId: 'cash',
    amountMinor,
    eurMinor,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
  };
}

const expense = (categoryId: string, date: string, eurMinor: number, amountMinor?: number) =>
  entry('expense', categoryId, date, eurMinor, amountMinor);
const income = (categoryId: string, date: string, eurMinor: number) => entry('income', categoryId, date, eurMinor);

function transfer(date: string, eurMinor: number): Entry {
  nextId += 1;
  return {
    id: `e${nextId}`,
    type: 'transfer',
    date,
    accountId: 'bank',
    toAccountId: 'cash',
    amountMinor: eurMinor,
    toAmountMinor: eurMinor,
    eurMinor,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
  };
}

describe('spendingByCategory', () => {
  it('excludes transfers and uses eurMinor', () => {
    const entries = [
      // 5,000 paise is what the account holds; 526 is what it was worth in euro cents when saved.
      expense('food', '2026-10-05', 526, 5000),
      expense('food', '2026-10-06', 1000),
      transfer('2026-10-07', 20000),
      income('income-parents', '2026-10-01', 90000),
    ];

    expect(spendingByCategory(entries, foodOnly, '2026-10')).toEqual([
      { categoryId: 'food', spentMinor: 1526, plannedMinor: 31000 },
    ]);
  });

  it('counts only the chosen month', () => {
    const entries = [
      expense('food', '2026-09-30', 700),
      expense('food', '2026-10-01', 1100),
      expense('food', '2026-10-31', 200),
      expense('food', '2026-11-01', 900),
    ];

    expect(spendingByCategory(entries, foodOnly, '2026-10')[0]?.spentMinor).toBe(1300);
  });

  it('plans a flexible category from its envelope, the same prorated amount monthStatus gives', () => {
    // Set up on the 16th: 16 of October's 31 days are planned (310 * 16/31 = 160).
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };
    const entries = [expense('food', '2026-10-20', 2000)];

    const rows = spendingByCategory(entries, setUpOn16th, '2026-10');

    const fromHome = monthStatus(setUpOn16th, entries, '2026-10')[0];
    expect(rows).toEqual([{ categoryId: 'food', spentMinor: 2000, plannedMinor: 16000 }]);
    expect(rows[0]?.plannedMinor).toBe(fromHome?.plannedMinor);
    // A later month is planned in full again.
    expect(spendingByCategory([], setUpOn16th, '2026-11')[0]?.plannedMinor).toBe(31000);
  });

  it('leaves spending before the setup day out of an envelope, as home does, but not out of a fixed or unplanned category', () => {
    // Set up on the 16th: €180 of groceries backdated to the 3rd must not read as "€180 of €160".
    const setUpOn16th: Plan = { ...plan, createdOn: '2026-10-16' };
    const entries = [
      expense('food', '2026-10-03', 18000),
      expense('food', '2026-10-20', 2000),
      expense('rent', '2026-10-01', 40000),
      expense('transport', '2026-10-03', 500),
    ];

    const rows = spendingByCategory(entries, setUpOn16th, '2026-10');

    const fromHome = monthStatus(setUpOn16th, entries, '2026-10').find((s) => s.categoryId === 'food');
    expect(rows.find((r) => r.categoryId === 'food')).toEqual({ categoryId: 'food', spentMinor: 2000, plannedMinor: 16000 });
    expect(rows.find((r) => r.categoryId === 'food')?.spentMinor).toBe(fromHome?.spentMinor);
    // Rent paid on the 1st still counts against the whole month's amount.
    expect(rows.find((r) => r.categoryId === 'rent')).toEqual({ categoryId: 'rent', spentMinor: 40000, plannedMinor: 40000 });
    expect(rows.find((r) => r.categoryId === 'transport')).toEqual({
      categoryId: 'transport',
      spentMinor: 500,
      plannedMinor: null,
    });
  });

  it('keeps an envelope whose only spending was before the setup day, at nothing spent of its plan', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };

    expect(spendingByCategory([expense('food', '2026-10-03', 18000)], setUpOn16th, '2026-10')).toEqual([
      { categoryId: 'food', spentMinor: 0, plannedMinor: 16000 },
    ]);
  });

  it('has no plan for any category in a month before the setup month, only what was spent', () => {
    const setUpOn16th: Plan = { ...plan, createdOn: '2026-10-16' };
    const entries = [expense('food', '2026-09-10', 3000), expense('rent', '2026-09-01', 40000)];

    // Envelopes and fixed amounts would all be planned in full here if the plan reached back; it does not.
    expect(spendingByCategory(entries, setUpOn16th, '2026-09')).toEqual([
      { categoryId: 'rent', spentMinor: 40000, plannedMinor: null },
      { categoryId: 'food', spentMinor: 3000, plannedMinor: null },
    ]);
    expect(spendingByCategory([], setUpOn16th, '2026-09')).toEqual([]);
  });

  it('plans every month from the setup month on, a full envelope after it', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };

    expect(spendingByCategory([expense('food', '2026-11-05', 1000)], setUpOn16th, '2026-11')).toEqual([
      { categoryId: 'food', spentMinor: 1000, plannedMinor: 31000 },
    ]);
  });

  it('plans a fixed category with its monthly amount, not prorated', () => {
    const setUpOn16th: Plan = { ...plan, createdOn: '2026-10-16' };
    const entries = [expense('rent', '2026-10-17', 40000)];

    const rent = spendingByCategory(entries, setUpOn16th, '2026-10').find((r) => r.categoryId === 'rent');

    expect(rent).toEqual({ categoryId: 'rent', spentMinor: 40000, plannedMinor: 40000 });
  });

  it('has a null plan for a category with neither an envelope nor a fixed amount', () => {
    const entries = [expense('transport', '2026-10-03', 250), expense('one-off', '2026-10-04', 3000)];

    const rows = spendingByCategory(entries, foodOnly, '2026-10');

    expect(rows.find((r) => r.categoryId === 'transport')?.plannedMinor).toBeNull();
    expect(rows.find((r) => r.categoryId === 'one-off')?.plannedMinor).toBeNull();
  });

  it('lists one row per category that has spending or a planned amount, and no empty ones', () => {
    // Rent and food are planned; eating out is planned and spent; going-out (€0) and phone (€0) are neither.
    const entries = [expense('eating-out', '2026-10-02', 600), expense('shopping', '2026-10-03', 1999)];

    const ids = spendingByCategory(entries, plan, '2026-10').map((r) => r.categoryId);

    expect(ids.sort()).toEqual(['eating-out', 'food', 'rent', 'shopping']);
  });

  it('keeps a category planned at zero when something was spent on it', () => {
    const entries = [expense('going-out', '2026-10-09', 1500), expense('phone', '2026-10-09', 800)];

    const rows = spendingByCategory(entries, plan, '2026-10');

    expect(rows.find((r) => r.categoryId === 'going-out')).toEqual({
      categoryId: 'going-out',
      spentMinor: 1500,
      plannedMinor: 0,
    });
    expect(rows.find((r) => r.categoryId === 'phone')).toEqual({ categoryId: 'phone', spentMinor: 800, plannedMinor: 0 });
  });

  it('sorts by spent, then planned, then the order of the built-in categories', () => {
    const entries = [
      expense('shopping', '2026-10-02', 5000),
      expense('transport', '2026-10-02', 5000),
      expense('eating-out', '2026-10-02', 5000),
      expense('other', '2026-10-02', 5000),
      expense('food', '2026-10-02', 9000),
    ];
    const withOtherPlanned: Plan = {
      ...foodOnly,
      envelopes: [
        { categoryId: 'food', monthlyMinor: 31000 },
        { categoryId: 'eating-out', monthlyMinor: 12400 },
        { categoryId: 'other', monthlyMinor: 12400 },
      ],
    };

    const ids = spendingByCategory(entries, withOtherPlanned, '2026-10').map((r) => r.categoryId);

    // Food spent the most. The other four tie at 5,000: the two with a plan come first, and they tie on
    // 12,400 too, so the built-in order decides (eating-out before other). Transport and shopping have no
    // plan, so the built-in order decides again (transport before shopping).
    expect(ids).toEqual(['food', 'eating-out', 'other', 'transport', 'shopping']);
  });

  it('puts a category with a plan before one without when spending ties', () => {
    const entries = [expense('transport', '2026-10-02', 500), expense('food', '2026-10-02', 500)];
    const plans: Plan = { ...foodOnly, envelopes: [{ categoryId: 'food', monthlyMinor: 100 }] };

    expect(spendingByCategory(entries, plans, '2026-10').map((r) => r.categoryId)).toEqual(['food', 'transport']);
  });

  it('is empty when nothing is spent and nothing is planned', () => {
    const nothing: Plan = { ...plan, fixed: [], envelopes: [] };

    expect(spendingByCategory([income('income-job', '2026-10-01', 40000)], nothing, '2026-10')).toEqual([]);
  });
});

describe('incomeBySource', () => {
  it('counts only income entries', () => {
    const entries = [
      income('income-parents', '2026-10-01', 50000),
      income('income-job', '2026-10-10', 20000),
      expense('food', '2026-10-05', 1000),
      transfer('2026-10-06', 30000),
    ];

    expect(incomeBySource(entries, '2026-10')).toEqual([
      { categoryId: 'income-parents', amountMinor: 50000 },
      { categoryId: 'income-job', amountMinor: 20000 },
    ]);
  });

  it('adds up one source, uses eurMinor and keeps to the month', () => {
    const entries = [
      income('income-job', '2026-10-03', 15000),
      income('income-job', '2026-10-24', 12050),
      income('income-job', '2026-09-30', 99999),
      income('income-job', '2026-11-01', 99999),
      income('income-bafoeg', '2026-10-15', 30000),
    ];

    expect(incomeBySource(entries, '2026-10')).toEqual([
      { categoryId: 'income-bafoeg', amountMinor: 30000 },
      { categoryId: 'income-job', amountMinor: 27050 },
    ]);
  });

  it('sorts by amount, descending, with ties in category order', () => {
    const entries = [
      income('income-scholarship', '2026-10-01', 10000),
      income('income-job', '2026-10-01', 10000),
      income('income-parents', '2026-10-01', 40000),
    ];

    expect(incomeBySource(entries, '2026-10').map((r) => r.categoryId)).toEqual([
      'income-parents',
      'income-job',
      'income-scholarship',
    ]);
  });

  it('is empty for a month without income', () => {
    expect(incomeBySource([income('income-job', '2026-09-01', 10000)], '2026-10')).toEqual([]);
  });
});

describe('categoryHistory', () => {
  it('zero-fills empty months, oldest first, length 6', () => {
    const entries = [
      expense('food', '2026-10-05', 1200),
      expense('food', '2026-10-20', 800),
      expense('food', '2026-08-15', 4000),
    ];

    expect(categoryHistory(entries, 'food', '2026-10')).toEqual([
      { month: '2026-05', spentMinor: 0 },
      { month: '2026-06', spentMinor: 0 },
      { month: '2026-07', spentMinor: 0 },
      { month: '2026-08', spentMinor: 4000 },
      { month: '2026-09', spentMinor: 0 },
      { month: '2026-10', spentMinor: 2000 },
    ]);
  });

  it('crosses a year boundary', () => {
    expect(categoryHistory([], 'food', '2027-02').map((m) => m.month)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('counts only expenses of that category, in euros', () => {
    const entries = [
      expense('food', '2026-10-05', 526, 5000),
      expense('eating-out', '2026-10-05', 9000),
      income('income-job', '2026-10-05', 9000),
      transfer('2026-10-05', 9000),
      // After the end month and before the first one shown.
      expense('food', '2026-11-01', 9000),
      expense('food', '2026-04-30', 9000),
    ];

    expect(categoryHistory(entries, 'food', '2026-10').map((m) => m.spentMinor)).toEqual([0, 0, 0, 0, 0, 526]);
  });

  it('takes the number of months from count', () => {
    expect(categoryHistory([], 'food', '2026-10', 3).map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(categoryHistory([], 'food', '2026-10', 1).map((m) => m.month)).toEqual(['2026-10']);
  });
});
