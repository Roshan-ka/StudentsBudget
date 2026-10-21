import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { monthStatus } from '@/lib/budget';
import {
  BUCKET_ID,
  categoryOverPeriod,
  defaultOverTimeCategory,
  hasEntriesIn,
  incomeBySource,
  incomeBySourceOver,
  monthsOf,
  savingsByMonth,
  spendingByCategory,
  spendingByCategoryOver,
  topWithBucket,
  type Period,
} from './aggregate';

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

  it('plans a flexible category with its whole envelope in the setup month too, the amount monthStatus gives', () => {
    // Set up on the 16th: the whole 310 is planned, not the part from the 16th.
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };
    const entries = [expense('food', '2026-10-20', 2000)];

    const rows = spendingByCategory(entries, setUpOn16th, '2026-10');

    const fromHome = monthStatus(setUpOn16th, entries, '2026-10')[0];
    expect(rows).toEqual([{ categoryId: 'food', spentMinor: 2000, plannedMinor: 31000 }]);
    expect(rows[0]?.plannedMinor).toBe(fromHome?.plannedMinor);
    // A later month is planned the same.
    expect(spendingByCategory([], setUpOn16th, '2026-11')[0]?.plannedMinor).toBe(31000);
  });

  it('leaves spending before the setup day out of an envelope, as home does, but not out of a fixed or unplanned category', () => {
    // Set up on the 16th: €180 of groceries backdated to the 3rd must not read as "€180 of €310".
    const setUpOn16th: Plan = { ...plan, createdOn: '2026-10-16' };
    const entries = [
      expense('food', '2026-10-03', 18000),
      expense('food', '2026-10-20', 2000),
      expense('rent', '2026-10-01', 40000),
      expense('one-off', '2026-10-03', 500),
    ];

    const rows = spendingByCategory(entries, setUpOn16th, '2026-10');

    const fromHome = monthStatus(setUpOn16th, entries, '2026-10').find((s) => s.categoryId === 'food');
    expect(rows.find((r) => r.categoryId === 'food')).toEqual({ categoryId: 'food', spentMinor: 2000, plannedMinor: 31000 });
    expect(rows.find((r) => r.categoryId === 'food')?.spentMinor).toBe(fromHome?.spentMinor);
    // Rent paid on the 1st still counts against the whole month's amount.
    expect(rows.find((r) => r.categoryId === 'rent')).toEqual({ categoryId: 'rent', spentMinor: 40000, plannedMinor: 40000 });
    expect(rows.find((r) => r.categoryId === 'one-off')).toEqual({
      categoryId: 'one-off',
      spentMinor: 500,
      plannedMinor: null,
    });
  });

  it('keeps an envelope whose only spending was before the setup day, at nothing spent of its plan', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };

    expect(spendingByCategory([expense('food', '2026-10-03', 18000)], setUpOn16th, '2026-10')).toEqual([
      { categoryId: 'food', spentMinor: 0, plannedMinor: 31000 },
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

  it('plans a fixed category with its monthly amount', () => {
    const setUpOn16th: Plan = { ...plan, createdOn: '2026-10-16' };
    const entries = [expense('rent', '2026-10-17', 40000)];

    const rent = spendingByCategory(entries, setUpOn16th, '2026-10').find((r) => r.categoryId === 'rent');

    expect(rent).toEqual({ categoryId: 'rent', spentMinor: 40000, plannedMinor: 40000 });
  });

  it('has a null plan for a category that is neither flexible nor has a fixed amount', () => {
    const entries = [expense('gym', '2026-10-03', 250), expense('one-off', '2026-10-04', 3000)];

    const rows = spendingByCategory(entries, foodOnly, '2026-10');

    expect(rows.find((r) => r.categoryId === 'gym')?.plannedMinor).toBeNull();
    expect(rows.find((r) => r.categoryId === 'one-off')?.plannedMinor).toBeNull();
  });

  it('plans a flexible category without an envelope at €0, as home does', () => {
    const rows = spendingByCategory([expense('transport', '2026-10-03', 250)], foodOnly, '2026-10');

    expect(rows.find((r) => r.categoryId === 'transport')).toEqual({
      categoryId: 'transport',
      spentMinor: 250,
      plannedMinor: 0,
    });
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

describe('defaultOverTimeCategory', () => {
  const row = (categoryId: string, spentMinor: number, plannedMinor: number | null = null) => ({
    categoryId,
    spentMinor,
    plannedMinor,
  });

  it('starts on the top flexible spender, not on rent that was added automatically', () => {
    const spending = [row('rent', 40000, 40000), row('phone', 3000, 3000), row('eating-out', 600, 6400), row('food', 400, 16000)];

    expect(defaultOverTimeCategory(spending)).toBe('eating-out');
  });

  it('with no flexible spending, starts on the flexible row with the largest plan', () => {
    const spending = [row('rent', 40000, 40000), row('food', 0, 16000), row('eating-out', 0, 6400)];

    expect(defaultOverTimeCategory(spending)).toBe('food');
  });

  it('starts on the first flexible category when no flexible row is there', () => {
    expect(defaultOverTimeCategory([row('rent', 40000, 40000)])).toBe('food');
    expect(defaultOverTimeCategory([])).toBe('food');
  });

  describe('with the spending of the months the chart covers', () => {
    // An empty month: the envelopes are planned, nothing is spent, and rent came in on its own.
    const emptyMonth = [row('rent', 0, 40000), row('food', 0, 31000), row('eating-out', 0, 12400)];
    const sixMonths = [row('rent', 240000, 240000), row('eating-out', 3600, 74400), row('food', 1200, 186000)];

    it('falls back to the top flexible spender of those months when the period has no flexible spending', () => {
      expect(defaultOverTimeCategory(emptyMonth, sixMonths)).toBe('eating-out');
      expect(defaultOverTimeCategory([], sixMonths)).toBe('eating-out');
      // Fixed costs do not count: a flat line.
      expect(defaultOverTimeCategory(emptyMonth, [row('rent', 240000, 240000)])).toBe('food');
    });

    it('keeps the top flexible spender of the period itself when it has one', () => {
      const month = [row('food', 900, 31000), row('eating-out', 100, 12400)];

      expect(defaultOverTimeCategory(month, sixMonths)).toBe('food');
    });

    it('keeps the largest plan when neither has flexible spending', () => {
      const unspent = [row('rent', 240000, 240000), row('food', 0, 186000), row('eating-out', 0, 74400)];

      expect(defaultOverTimeCategory(emptyMonth, unspent)).toBe('food');
      expect(defaultOverTimeCategory(emptyMonth, [])).toBe('food');
    });

    it('is the same as without them when they are the period itself', () => {
      expect(defaultOverTimeCategory(emptyMonth, emptyMonth)).toBe(defaultOverTimeCategory(emptyMonth));
    });
  });
});

describe('hasEntriesIn', () => {
  const months = ['2026-09', '2026-10'];

  it('is true when an expense or income is dated in one of the months', () => {
    expect(hasEntriesIn([expense('food', '2026-10-31', 100)], months)).toBe(true);
    expect(hasEntriesIn([income('income-job', '2026-09-01', 100)], months)).toBe(true);
  });

  it('is false for entries in other months, and for no entries', () => {
    expect(hasEntriesIn([expense('food', '2026-08-31', 100), expense('food', '2026-11-01', 100)], months)).toBe(false);
    expect(hasEntriesIn([], months)).toBe(false);
    expect(hasEntriesIn([expense('food', '2026-10-05', 100)], [])).toBe(false);
  });

  it('does not count a transfer', () => {
    expect(hasEntriesIn([transfer('2026-10-05', 5000)], months)).toBe(false);
    expect(hasEntriesIn([transfer('2026-10-05', 5000), expense('food', '2026-10-06', 100)], months)).toBe(true);
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

const period = (endMonth: string, months: Period['months']): Period => ({ endMonth, months });
const PERIOD_LENGTHS: Period['months'][] = [1, 3, 6, 12];

describe('monthsOf', () => {
  it('lists the period month by month, oldest first, ending on endMonth', () => {
    expect(monthsOf(period('2026-10', 1))).toEqual(['2026-10']);
    expect(monthsOf(period('2026-10', 3))).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(monthsOf(period('2026-10', 6))[0]).toBe('2026-05');
    expect(monthsOf(period('2026-10', 12))).toHaveLength(12);
    expect(monthsOf(period('2026-10', 12))[0]).toBe('2025-11');
  });

  it('crosses a year boundary', () => {
    expect(monthsOf(period('2027-02', 6))).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  });
});

describe('spendingByCategoryOver', () => {
  // Set up on 1 Jan 2026, so January to October are planned in full and the two months before it have no plan.
  const fromJanuary: Plan = { ...foodOnly, createdOn: '2026-01-01' };

  it('adds spent and planned over the months of the period, for 1, 3, 6 and 12 months', () => {
    const entries = [
      expense('food', '2026-10-05', 1000),
      expense('food', '2026-09-05', 2000),
      expense('food', '2026-08-05', 4000),
      expense('food', '2026-02-05', 8000),
      expense('food', '2025-12-05', 16000),
    ];

    const food = (months: Period['months']) =>
      spendingByCategoryOver(entries, fromJanuary, period('2026-10', months)).find((r) => r.categoryId === 'food');

    expect(food(1)).toEqual({ categoryId: 'food', spentMinor: 1000, plannedMinor: 31000 });
    expect(food(3)).toEqual({ categoryId: 'food', spentMinor: 7000, plannedMinor: 93000 });
    // May to October: the February spending is out of range.
    expect(food(6)).toEqual({ categoryId: 'food', spentMinor: 7000, plannedMinor: 186000 });
    // November 2025 to October 2026: spending counts in all of it, the plan only from January on (10 months).
    expect(food(12)).toEqual({ categoryId: 'food', spentMinor: 31000, plannedMinor: 310000 });
  });

  it('matches the per-month rows, summed, for every period length', () => {
    const entries = [
      expense('food', '2026-10-05', 1500),
      expense('food', '2026-08-20', 2300),
      expense('rent', '2026-10-01', 40000),
      expense('rent', '2026-09-01', 40000),
      expense('rent', '2026-03-01', 40000),
      expense('gym', '2026-07-11', 2500),
      expense('one-off', '2025-12-24', 9900),
      expense('transport', '2026-05-30', 350),
      income('income-job', '2026-10-02', 99999),
      transfer('2026-10-03', 12345),
    ];
    const setUpEarlier: Plan = { ...plan, createdOn: '2026-03-01' };

    for (const months of PERIOD_LENGTHS) {
      const p = period('2026-10', months);
      const perMonth = new Map<string, { spentMinor: number; plannedMinor: number | null }>();
      for (const month of monthsOf(p)) {
        for (const row of spendingByCategory(entries, setUpEarlier, month)) {
          const soFar = perMonth.get(row.categoryId);
          perMonth.set(row.categoryId, {
            spentMinor: (soFar?.spentMinor ?? 0) + row.spentMinor,
            plannedMinor:
              row.plannedMinor === null && !soFar?.plannedMinor
                ? (soFar?.plannedMinor ?? null)
                : (soFar?.plannedMinor ?? 0) + (row.plannedMinor ?? 0),
          });
        }
      }

      const actual = spendingByCategoryOver(entries, setUpEarlier, p);

      for (const row of actual) {
        expect(row.spentMinor, `${row.categoryId} spent over ${months}`).toBe(perMonth.get(row.categoryId)?.spentMinor);
        expect(row.plannedMinor, `${row.categoryId} planned over ${months}`).toBe(
          perMonth.get(row.categoryId)?.plannedMinor,
        );
      }
      // Every spent euro is in some row, and nothing but spending is.
      const spentInPeriod = entries
        .filter((e) => e.type === 'expense' && monthsOf(p).includes(e.date.slice(0, 7)))
        .reduce((total, e) => total + e.eurMinor, 0);
      expect(actual.reduce((total, row) => total + row.spentMinor, 0)).toBe(spentInPeriod);
    }
  });

  it('ranks by what was spent over the whole period, not by the latest month', () => {
    const entries = [
      expense('shopping', '2026-10-02', 3000),
      expense('shopping', '2026-09-02', 3000),
      expense('transport', '2026-10-02', 5000),
      expense('food', '2026-08-02', 9000),
    ];

    const ids = spendingByCategoryOver(entries, fromJanuary, period('2026-10', 3)).map((r) => r.categoryId);

    // Transport was the larger spend in October, but shopping (3,000 + 3,000) outspent it over the three months.
    expect(ids).toEqual(['food', 'shopping', 'transport']);
  });

  it('counts the setup month from the setup day on, plans it in full, and has no plan before it', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };
    const entries = [
      expense('food', '2026-08-15', 3000),
      expense('food', '2026-09-10', 2000),
      // Before the setup day: not counted against the envelope.
      expense('food', '2026-10-03', 18000),
      expense('food', '2026-10-20', 2000),
    ];

    const rows = spendingByCategoryOver(entries, setUpOn16th, period('2026-10', 3));

    // August and September had no plan; October's is the whole envelope.
    expect(rows).toEqual([{ categoryId: 'food', spentMinor: 7000, plannedMinor: 31000 }]);
  });

  it('leaves the plan null for a period that ends before the plan starts', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };

    expect(spendingByCategoryOver([expense('food', '2026-08-15', 3000)], setUpOn16th, period('2026-09', 3))).toEqual([
      { categoryId: 'food', spentMinor: 3000, plannedMinor: null },
    ]);
  });

  it('plans a fixed category at its monthly amount for every month of the period', () => {
    const entries = [expense('rent', '2026-10-01', 40000), expense('rent', '2026-09-01', 40000)];

    const rent = spendingByCategoryOver(entries, plan, period('2026-10', 1)).find((r) => r.categoryId === 'rent');
    const rent3 = spendingByCategoryOver(entries, { ...plan, createdOn: '2026-01-01' }, period('2026-10', 3)).find(
      (r) => r.categoryId === 'rent',
    );

    expect(rent).toEqual({ categoryId: 'rent', spentMinor: 40000, plannedMinor: 40000 });
    expect(rent3).toEqual({ categoryId: 'rent', spentMinor: 80000, plannedMinor: 120000 });
  });

  it('plans a paused fixed line at nothing, and keeps counting what was spent on it', () => {
    const paused = {
      id: 's1',
      frequency: 'monthly' as const,
      day: 1,
      accountId: 'cash',
      amountMinor: 40000,
      startOn: '2026-01-01',
      postedThrough: '2026-01-01',
      paused: true,
    };
    const pausedRent: Plan = { ...foodOnly, fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: paused }] };
    const unpausedRent: Plan = {
      ...foodOnly,
      fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: { ...paused, paused: false } }],
    };

    // Paused and not spent on: planned at 0 and spent 0, so it is not a row at all.
    expect(spendingByCategoryOver([], pausedRent, period('2026-10', 1)).map((r) => r.categoryId)).toEqual(['food']);
    // Paused but paid anyway: a row, planned at 0.
    expect(
      spendingByCategoryOver([expense('rent', '2026-10-01', 40000)], pausedRent, period('2026-10', 1)).find(
        (r) => r.categoryId === 'rent',
      ),
    ).toEqual({ categoryId: 'rent', spentMinor: 40000, plannedMinor: 0 });
    // The same line, not paused, is planned in full.
    expect(spendingByCategoryOver([], unpausedRent, period('2026-10', 1)).find((r) => r.categoryId === 'rent')).toEqual({
      categoryId: 'rent',
      spentMinor: 0,
      plannedMinor: 40000,
    });
  });

  it('excludes transfers and income, and uses eurMinor', () => {
    const entries = [
      expense('food', '2026-10-05', 526, 5000),
      income('income-job', '2026-10-05', 99999),
      transfer('2026-10-05', 99999),
    ];

    expect(spendingByCategoryOver(entries, foodOnly, period('2026-10', 3))).toEqual([
      { categoryId: 'food', spentMinor: 526, plannedMinor: 31000 },
    ]);
  });
});

describe('incomeBySourceOver', () => {
  it('adds each source over the period, largest first, using eurMinor', () => {
    const entries = [
      income('income-parents', '2026-10-01', 50000),
      income('income-parents', '2026-09-01', 50000),
      income('income-job', '2026-10-10', 20000),
      income('income-job', '2026-08-10', 15000),
      income('income-bafoeg', '2026-02-10', 99999),
      expense('food', '2026-10-05', 1000),
      transfer('2026-10-06', 30000),
    ];

    expect(incomeBySourceOver(entries, period('2026-10', 1))).toEqual([
      { categoryId: 'income-parents', amountMinor: 50000 },
      { categoryId: 'income-job', amountMinor: 20000 },
    ]);
    expect(incomeBySourceOver(entries, period('2026-10', 3))).toEqual([
      { categoryId: 'income-parents', amountMinor: 100000 },
      { categoryId: 'income-job', amountMinor: 35000 },
    ]);
    expect(incomeBySourceOver(entries, period('2026-10', 12)).map((r) => r.categoryId)).toEqual([
      'income-parents',
      'income-bafoeg',
      'income-job',
    ]);
  });

  it('matches the per-month sums for every period length', () => {
    const entries = [
      income('income-parents', '2026-10-01', 50000),
      income('income-job', '2026-09-12', 12000),
      income('income-job', '2026-05-12', 8000),
      income('income-scholarship', '2025-12-01', 30000),
    ];

    for (const months of PERIOD_LENGTHS) {
      const p = period('2026-10', months);
      const expected = new Map<string, number>();
      for (const month of monthsOf(p)) {
        for (const row of incomeBySource(entries, month)) {
          expected.set(row.categoryId, (expected.get(row.categoryId) ?? 0) + row.amountMinor);
        }
      }

      const actual = incomeBySourceOver(entries, p);

      expect(new Map(actual.map((r) => [r.categoryId, r.amountMinor]))).toEqual(expected);
    }
  });

  it('is empty when the period has no income', () => {
    expect(incomeBySourceOver([income('income-job', '2026-01-01', 10000)], period('2026-10', 3))).toEqual([]);
  });
});

describe('categoryOverPeriod', () => {
  it('has one entry per month of the period, oldest first, with 0 for a month without spending', () => {
    const entries = [
      expense('food', '2026-10-05', 1200),
      expense('food', '2026-10-20', 800),
      expense('food', '2026-08-15', 4000),
      expense('food', '2026-01-15', 700),
    ];

    expect(categoryOverPeriod(entries, 'food', period('2026-10', 3))).toEqual([
      { month: '2026-08', spentMinor: 4000 },
      { month: '2026-09', spentMinor: 0 },
      { month: '2026-10', spentMinor: 2000 },
    ]);
    expect(categoryOverPeriod(entries, 'food', period('2026-10', 1))).toEqual([{ month: '2026-10', spentMinor: 2000 }]);
    for (const months of PERIOD_LENGTHS) {
      expect(categoryOverPeriod(entries, 'food', period('2026-10', months))).toHaveLength(months);
    }
    expect(categoryOverPeriod(entries, 'food', period('2026-10', 12))[9]).toEqual({ month: '2026-08', spentMinor: 4000 });
  });

  it('crosses a year boundary', () => {
    expect(categoryOverPeriod([], 'food', period('2027-02', 6)).map((m) => m.month)).toEqual([
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

    expect(categoryOverPeriod(entries, 'food', period('2026-10', 6)).map((m) => m.spentMinor)).toEqual([
      0, 0, 0, 0, 0, 526,
    ]);
  });
});

describe('savingsByMonth', () => {
  it('is income minus expenses per month, oldest first, with a month of nothing at 0', () => {
    const entries = [
      income('income-parents', '2026-10-01', 90000),
      income('income-job', '2026-10-12', 10000),
      expense('rent', '2026-10-01', 40000),
      expense('food', '2026-10-09', 20000),
      income('income-parents', '2026-08-01', 90000),
      expense('food', '2026-08-09', 25000),
    ];

    expect(savingsByMonth(entries, period('2026-10', 3))).toEqual([
      { month: '2026-08', incomeMinor: 90000, expenseMinor: 25000, savedMinor: 65000 },
      { month: '2026-09', incomeMinor: 0, expenseMinor: 0, savedMinor: 0 },
      { month: '2026-10', incomeMinor: 100000, expenseMinor: 60000, savedMinor: 40000 },
    ]);
  });

  it('ignores a transfer between accounts, in either direction and in another currency', () => {
    const inrToEur: Entry = {
      id: 't-inr-eur',
      type: 'transfer',
      date: '2026-10-07',
      accountId: 'home-bank',
      toAccountId: 'local-bank',
      amountMinor: 950000, // paise
      toAmountMinor: 10000,
      eurMinor: 10000,
      note: '',
      createdAt: '2026-10-07T12:00:00.000Z',
    };
    const eurToInr: Entry = {
      ...inrToEur,
      id: 't-eur-inr',
      accountId: 'local-bank',
      toAccountId: 'home-bank',
      amountMinor: 10000,
      toAmountMinor: 950000,
    };
    const entries = [
      income('income-parents', '2026-10-01', 50000),
      expense('food', '2026-10-02', 2000),
      inrToEur,
      eurToInr,
    ];

    expect(savingsByMonth(entries, period('2026-10', 1))).toEqual([
      { month: '2026-10', incomeMinor: 50000, expenseMinor: 2000, savedMinor: 48000 },
    ]);
  });

  it('counts a one-off cost as an expense, and uses eurMinor rather than the account amount', () => {
    const entries = [
      income('income-job', '2026-10-01', 526),
      entry('income', 'income-parents', '2026-10-02', 10000, 950000),
      expense('one-off', '2026-10-03', 30000),
      expense('food', '2026-10-04', 526, 5000),
    ];

    expect(savingsByMonth(entries, period('2026-10', 1))).toEqual([
      { month: '2026-10', incomeMinor: 10526, expenseMinor: 30526, savedMinor: -20000 },
    ]);
  });

  it('goes negative in a month that spent more than it earned', () => {
    const entries = [income('income-job', '2026-10-01', 1000), expense('food', '2026-10-02', 5000)];

    expect(savingsByMonth(entries, period('2026-10', 1))[0]?.savedMinor).toBe(-4000);
  });

  it('keeps to the months of the period', () => {
    const entries = [
      income('income-job', '2026-09-30', 1000),
      income('income-job', '2026-10-01', 2000),
      income('income-job', '2026-11-01', 4000),
    ];

    expect(savingsByMonth(entries, period('2026-10', 1)).map((m) => m.incomeMinor)).toEqual([2000]);
    expect(savingsByMonth(entries, period('2026-10', 12))).toHaveLength(12);
  });
});

describe('topWithBucket', () => {
  type Row = { categoryId: string; spentMinor: number; plannedMinor: number | null };
  const rowsOf = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({
      categoryId: `c${i}`,
      spentMinor: (n - i) * 100,
      plannedMinor: i % 2 === 0 ? 1000 : null,
    }));
  const spent = (r: Row) => r.spentMinor;

  it('keeps the top 6 and folds the rest into one bucket whose value is their sum', () => {
    const result = topWithBucket(rowsOf(9), spent);

    expect(result).toHaveLength(7);
    expect(result.slice(0, 6).map((r) => r.categoryId)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
    // c6, c7 and c8 are worth 300, 200 and 100.
    expect(result[6]?.categoryId).toBe(BUCKET_ID);
    expect(result[6]?.spentMinor).toBe(600);
  });

  it('sums every number of the folded rows, and leaves a plan missing only when all of them lack one', () => {
    const result = topWithBucket(rowsOf(9), spent);

    // c6 (planned 1000), c7 (none) and c8 (planned 1000).
    expect(result[6]?.plannedMinor).toBe(2000);
    const noPlans = rowsOf(9).map((r) => ({ ...r, plannedMinor: null }));
    expect(topWithBucket(noPlans, spent)[6]?.plannedMinor).toBeNull();
  });

  it('shows a seventh row as itself: a bucket of one category would only hide its name', () => {
    const result = topWithBucket(rowsOf(7), spent);

    expect(result).toEqual(rowsOf(7));
    expect(result.map((r) => r.categoryId)).not.toContain(BUCKET_ID);
  });

  it('has no bucket when there are 6 rows or fewer, and gives them back as they are', () => {
    expect(topWithBucket(rowsOf(6), spent)).toEqual(rowsOf(6));
    expect(topWithBucket(rowsOf(3), spent)).toEqual(rowsOf(3));
    expect(topWithBucket([], spent)).toEqual([]);
  });

  it('keeps the largest by the value it is given, whatever order the rows come in', () => {
    const shuffled = [...rowsOf(8)].reverse();

    const result = topWithBucket(shuffled, spent);

    expect(result.map((r) => r.categoryId)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', BUCKET_ID]);
    expect(result[6]?.spentMinor).toBe(300);
  });

  it('takes the number to keep from `top`', () => {
    const result = topWithBucket(rowsOf(5), spent, 2);

    expect(result.map((r) => r.categoryId)).toEqual(['c0', 'c1', BUCKET_ID]);
    expect(result[2]?.spentMinor).toBe(300 + 200 + 100);
  });

  it('does not change the rows it is given', () => {
    const rows = rowsOf(9);

    topWithBucket(rows, spent);

    expect(rows).toEqual(rowsOf(9));
  });

  it('works on rows with a single amount', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ categoryId: `c${i}`, amountMinor: (8 - i) * 10 }));

    expect(topWithBucket(rows, (r) => r.amountMinor)[6]).toEqual({ categoryId: BUCKET_ID, amountMinor: 30 });
  });
});
