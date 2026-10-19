import { describe, expect, it } from 'vitest';
import type { City } from '@/data/cities';
import type { Entry, OneOff, Plan, Schedule } from '@/db/types';
import { monthStatus, planSummary, rangeWarnings, safeToSpend, setAsideMonthly } from './budget';
import { addDays, firstOfMonth, monthOf } from './dates';

const fee: OneOff = {
  id: 'fee',
  name: 'Semester fee',
  amountMinor: 30000,
  createdMonth: '2026-10',
  dueMonth: '2027-03',
};

const plan: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [{ categoryId: 'income-parents', monthlyMinor: 90000 }],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
  oneOffs: [fee],
  envelopes: [
    { categoryId: 'food', monthlyMinor: 31000 },
    { categoryId: 'going-out', monthlyMinor: 15500 },
  ],
  // The 1st, so October is a full month for this plan. The setup-month cases below set their own date.
  createdOn: '2026-10-01',
};

const foodOnly: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }] };

/** The rows for the plan's own envelopes; `safeToSpend` and `monthStatus` add €0 rows for the other flexible categories. */
function ownRows<T extends { categoryId: string }>(p: Plan, rows: T[]): T[] {
  return rows.filter((r) => p.envelopes.some((e) => e.categoryId === r.categoryId));
}

/** The flexible categories `foodOnly` has no envelope for, in category order. */
const MISSING_FROM_FOOD_ONLY = [
  'eating-out',
  'going-out',
  'transport',
  'shopping',
  'health',
  'personal-care',
  'study',
  'household',
  'travel',
  'gifts',
  'other',
];

function schedule(paused?: boolean): Schedule {
  return {
    id: 's1',
    frequency: 'monthly',
    day: 1,
    accountId: 'bank',
    amountMinor: 40000,
    startOn: '2026-10-01',
    postedThrough: '2026-09-30',
    ...(paused === undefined ? {} : { paused }),
  };
}

let nextId = 0;
function expense(categoryId: string, date: string, eurMinor: number, type: 'expense' | 'income' = 'expense'): Entry {
  nextId += 1;
  return {
    id: `e${nextId}`,
    type,
    categoryId,
    date,
    accountId: 'cash',
    amountMinor: eurMinor,
    eurMinor,
    note: '',
    createdAt: `${date}T12:00:00.000Z`,
  };
}

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

describe('setAsideMonthly', () => {
  it('spreads a one-off evenly from the created month up to, not including, the due month', () => {
    expect(setAsideMonthly(fee, '2026-10')).toBe(6000);
    expect(setAsideMonthly(fee, '2027-02')).toBe(6000);
  });

  it('is zero in the due month, before the created month and after the due month', () => {
    expect(setAsideMonthly(fee, '2027-03')).toBe(0);
    expect(setAsideMonthly(fee, '2026-09')).toBe(0);
    expect(setAsideMonthly(fee, '2027-04')).toBe(0);
  });

  it('rounds up so the full amount is always covered', () => {
    const third: OneOff = { ...fee, amountMinor: 10000, createdMonth: '2026-10', dueMonth: '2027-01' };
    expect(setAsideMonthly(third, '2026-10')).toBe(3334);
  });

  it('is zero when the due month is not after the created month', () => {
    const sameMonth: OneOff = { ...fee, createdMonth: '2026-10', dueMonth: '2026-10' };
    expect(setAsideMonthly(sameMonth, '2026-10')).toBe(0);
  });
});

describe('planSummary', () => {
  it('subtracts fixed costs and set-asides from income and reports how far the envelopes overshoot', () => {
    expect(planSummary(plan, '2026-10')).toEqual({
      incomeMinor: 90000,
      fixedMinor: 40000,
      setAsideMinor: 6000,
      availableMinor: 44000,
      envelopesMinor: 46500,
      overByMinor: 2500,
    });
  });

  it('reports no overshoot when the envelopes fit', () => {
    const roomy: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }] };
    expect(planSummary(roomy, '2026-10').overByMinor).toBe(0);
  });

  it('leaves out an income or fixed line whose schedule is paused', () => {
    const paused: Plan = {
      ...plan,
      incomes: [{ categoryId: 'income-parents', monthlyMinor: 90000, schedule: schedule(true) }],
      fixed: [
        { categoryId: 'rent', monthlyMinor: 40000, schedule: schedule(true) },
        { categoryId: 'phone', monthlyMinor: 2500 },
      ],
    };
    expect(planSummary(paused, '2026-10')).toMatchObject({ incomeMinor: 0, fixedMinor: 2500, availableMinor: -8500 });
  });

  it('counts a line whose schedule is running, or has no pause flag', () => {
    const running: Plan = {
      ...plan,
      incomes: [{ categoryId: 'income-parents', monthlyMinor: 90000, schedule: schedule(false) }],
      fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: schedule() }],
    };
    expect(planSummary(running, '2026-10')).toMatchObject({ incomeMinor: 90000, fixedMinor: 40000 });
  });

  it('drops the set-aside once the one-off is due', () => {
    const summary = planSummary(plan, '2027-03');
    expect(summary.setAsideMinor).toBe(0);
    expect(summary.availableMinor).toBe(50000);
  });
});

describe('safeToSpend', () => {
  const entries = [expense('food', '2026-10-05', 5000), expense('food', '2026-10-14', 2000)];

  it('gives the Monday–Sunday week and the safe amount for each envelope', () => {
    const s = safeToSpend(foodOnly, entries, '2026-10-16');
    expect(s.weekStart).toBe('2026-10-12');
    expect(s.weekEnd).toBe('2026-10-18');
    expect(s.envelopes[0]).toEqual({
      categoryId: 'food',
      weekShareMinor: 7000,
      spentThisWeekMinor: 2000,
      safeMinor: 11000,
    });
    expect(s.totalMinor).toBe(11000);
  });

  it('sums the envelopes, in category order', () => {
    const s = safeToSpend(plan, [...entries, expense('going-out', '2026-10-15', 1500)], '2026-10-16');
    expect(ownRows(plan, s.envelopes).map((e) => e.categoryId)).toEqual(['food', 'going-out']);
    // going-out: through = round(15500 × 18 / 31) = 9000, spent 1500
    expect(s.envelopes.find((e) => e.categoryId === 'going-out')).toEqual({
      categoryId: 'going-out',
      weekShareMinor: 3500,
      spentThisWeekMinor: 1500,
      safeMinor: 7500,
    });
    expect(s.totalMinor).toBe(11000 + 7500);
  });

  it('adds a €0 row for each flexible category the plan has no envelope for, so its spending still counts', () => {
    const health = expense('health', '2026-10-14', 1500);
    const s = safeToSpend(foodOnly, [...entries, health], '2026-10-16');

    // Every flexible category, in category order: food is the first of them.
    expect(s.envelopes.map((e) => e.categoryId)).toEqual(['food', ...MISSING_FROM_FOOD_ONLY]);
    expect(s.envelopes.find((e) => e.categoryId === 'health')).toEqual({
      categoryId: 'health',
      weekShareMinor: 0,
      spentThisWeekMinor: 1500,
      safeMinor: -1500,
    });
    expect(s.envelopes.find((e) => e.categoryId === 'gifts')).toEqual({
      categoryId: 'gifts',
      weekShareMinor: 0,
      spentThisWeekMinor: 0,
      safeMinor: 0,
    });
    // 11000 without the health expense.
    expect(s.totalMinor).toBe(11000 - 1500);
  });

  it('adds no row for a fixed category, and no second row for one the plan has at €0', () => {
    const atZero: Plan = { ...foodOnly, envelopes: [...foodOnly.envelopes, { categoryId: 'health', monthlyMinor: 0 }] };
    const s = safeToSpend(atZero, [...entries, expense('gym', '2026-10-14', 3000)], '2026-10-16');

    expect(s.envelopes.map((e) => e.categoryId)).not.toContain('gym');
    expect(s.envelopes.filter((e) => e.categoryId === 'health')).toHaveLength(1);
    expect(s.totalMinor).toBe(11000);
  });

  it("counts only the current month's days in a split week", () => {
    const november: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 30000 }] };
    const s = safeToSpend(november, [expense('food', '2026-10-31', 9999)], '2026-11-01');
    expect(s.weekStart).toBe('2026-11-01');
    expect(s.weekEnd).toBe('2026-11-01');
    expect(s.totalMinor).toBe(1000);
  });

  it('goes negative when overspent', () => {
    const s = safeToSpend(foodOnly, [expense('food', '2026-10-14', 20000)], '2026-10-16');
    expect(s.envelopes[0].safeMinor).toBe(-2000);
    expect(s.totalMinor).toBe(-2000);
  });

  it('ignores transfers and fixed-category expenses', () => {
    const noise = [
      transfer('2026-10-14', 8000),
      expense('rent', '2026-10-01', 40000),
      expense('gym', '2026-10-13', 4000),
    ];
    const s = safeToSpend(foodOnly, [...entries, ...noise], '2026-10-16');
    expect(s.envelopes[0].spentThisWeekMinor).toBe(2000);
    expect(s.totalMinor).toBe(11000);
  });

  it('ignores income entries in an envelope category', () => {
    const refund = expense('food', '2026-10-14', 3000, 'income');
    const s = safeToSpend(foodOnly, [...entries, refund], '2026-10-16');
    expect(s.totalMinor).toBe(11000);
  });

  it('ignores entries dated after the week', () => {
    const s = safeToSpend(foodOnly, [...entries, expense('food', '2026-10-19', 4000)], '2026-10-16');
    expect(s.totalMinor).toBe(11000);
  });

  describe('in the month the plan was set up', () => {
    const setUpOn16th: Plan = {
      ...plan,
      envelopes: [
        { categoryId: 'food', monthlyMinor: 31000 },
        { categoryId: 'eating-out', monthlyMinor: 12400 },
      ],
      createdOn: '2026-10-16',
    };

    it('accrues from the setup day, so the first partial week holds only its own days', () => {
      const s = safeToSpend(setUpOn16th, [], '2026-10-16');
      expect(s.weekStart).toBe('2026-10-12');
      expect(s.weekEnd).toBe('2026-10-18');
      // food: 31000 × 3 / 31 = 3000, eating-out: 12400 × 3 / 31 = 1200. Nothing accrued before the 16th.
      expect(ownRows(setUpOn16th, s.envelopes)).toEqual([
        { categoryId: 'food', weekShareMinor: 3000, spentThisWeekMinor: 0, safeMinor: 3000 },
        { categoryId: 'eating-out', weekShareMinor: 1200, spentThisWeekMinor: 0, safeMinor: 1200 },
      ]);
      expect(s.totalMinor).toBe(4200);
    });

    it('ignores entries dated before the setup day', () => {
      const earlier = [expense('food', '2026-10-10', 9000), expense('food', '2026-10-14', 500)];
      const s = safeToSpend(setUpOn16th, earlier, '2026-10-16');
      expect(s.envelopes[0]).toEqual({
        categoryId: 'food',
        weekShareMinor: 3000,
        spentThisWeekMinor: 0,
        safeMinor: 3000,
      });
      expect(s.totalMinor).toBe(4200);
    });

    it('counts entries from the setup day on', () => {
      const s = safeToSpend(setUpOn16th, [expense('food', '2026-10-16', 1000)], '2026-10-16');
      expect(s.envelopes[0]).toEqual({
        categoryId: 'food',
        weekShareMinor: 3000,
        spentThisWeekMinor: 1000,
        safeMinor: 2000,
      });
    });

    it('is zero for a week that ended before the setup day', () => {
      const s = safeToSpend(setUpOn16th, [], '2026-10-08');
      expect(ownRows(setUpOn16th, s.envelopes).map((e) => [e.weekShareMinor, e.safeMinor])).toEqual([
        [0, 0],
        [0, 0],
      ]);
      expect(s.totalMinor).toBe(0);
    });

    it('gives later weeks their full share, counted from the setup day', () => {
      const s = safeToSpend(setUpOn16th, [], '2026-10-20');
      expect(s.weekStart).toBe('2026-10-19');
      expect(s.weekEnd).toBe('2026-10-25');
      // food through the 25th: 31000 × 10 / 31 = 10000, before the 19th: 31000 × 3 / 31 = 3000.
      expect(s.envelopes[0]).toMatchObject({ categoryId: 'food', weekShareMinor: 7000, safeMinor: 10000 });
    });

    it('leaves the next month untouched', () => {
      const november: Plan = { ...setUpOn16th, envelopes: [{ categoryId: 'food', monthlyMinor: 30000 }] };
      const s = safeToSpend(november, [], '2026-11-02');
      // The 1st is a Sunday, so the week of the 2nd runs 2026-11-02 to 2026-11-08: 30000 × 8 / 30 = 8000.
      expect(s.weekStart).toBe('2026-11-02');
      expect(s.weekEnd).toBe('2026-11-08');
      expect(s.totalMinor).toBe(8000);
    });
  });

  it('adds the weeks of a month up to exactly the monthly amount, without drift', () => {
    const earlier: Plan = {
      ...plan,
      envelopes: [{ categoryId: 'food', monthlyMinor: 10000 }],
      createdOn: '2026-09-15',
    };
    let total = 0;
    let weeks = 0;
    for (let day = firstOfMonth('2026-10'); monthOf(day) === '2026-10'; ) {
      const week = safeToSpend(earlier, [], day);
      total += week.envelopes[0].weekShareMinor;
      weeks += 1;
      day = addDays(week.weekEnd, 1);
    }
    expect(weeks).toBe(5);
    expect(total).toBe(10000);
  });
});

describe('monthStatus', () => {
  it('reports planned and spent per envelope for the month only', () => {
    const entries = [
      expense('food', '2026-10-05', 5000),
      expense('food', '2026-10-14', 2000),
      expense('food', '2026-11-01', 999),
      expense('going-out', '2026-10-20', 3000),
      expense('rent', '2026-10-01', 40000),
      transfer('2026-10-10', 8000),
    ];
    expect(ownRows(plan, monthStatus(plan, entries, '2026-10'))).toEqual([
      { categoryId: 'food', plannedMinor: 31000, spentMinor: 7000 },
      { categoryId: 'going-out', plannedMinor: 15500, spentMinor: 3000 },
    ]);
  });

  it('adds a €0 row for each flexible category the plan has no envelope for, so its spending still counts', () => {
    const entries = [expense('health', '2026-10-06', 1800), expense('gym', '2026-10-06', 2500)];
    const rows = monthStatus(foodOnly, entries, '2026-10');

    expect(rows.map((r) => r.categoryId)).toEqual(['food', ...MISSING_FROM_FOOD_ONLY]);
    expect(rows.find((r) => r.categoryId === 'health')).toEqual({
      categoryId: 'health',
      plannedMinor: 0,
      spentMinor: 1800,
    });
    // A fixed category is no envelope.
    expect(rows.map((r) => r.categoryId)).not.toContain('gym');
  });

  it('keeps category order for a plan saved with the original six envelopes: the new €0 rows come before Other', () => {
    const sixEnvelopes: Plan = {
      ...plan,
      envelopes: ['food', 'eating-out', 'going-out', 'transport', 'shopping', 'other'].map((categoryId) => ({
        categoryId,
        monthlyMinor: 5000,
      })),
    };

    expect(monthStatus(sixEnvelopes, [], '2026-10').map((r) => r.categoryId)).toEqual([
      'food',
      'eating-out',
      'going-out',
      'transport',
      'shopping',
      'health',
      'personal-care',
      'study',
      'household',
      'travel',
      'gifts',
      'other',
    ]);
    expect(safeToSpend(sixEnvelopes, [], '2026-10-16').envelopes.at(-1)?.categoryId).toBe('other');
  });

  describe('in the month the plan was set up', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };

    it('plans only the days from the setup day to the end of the month', () => {
      // 31000 × 16 / 31 = 16000
      expect(ownRows(setUpOn16th, monthStatus(setUpOn16th, [], '2026-10'))).toEqual([
        { categoryId: 'food', plannedMinor: 16000, spentMinor: 0 },
      ]);
    });

    it('counts spending from the setup day on', () => {
      const entries = [
        expense('food', '2026-10-10', 9000),
        expense('food', '2026-10-16', 700),
        expense('food', '2026-10-20', 300),
      ];
      expect(ownRows(setUpOn16th, monthStatus(setUpOn16th, entries, '2026-10'))).toEqual([
        { categoryId: 'food', plannedMinor: 16000, spentMinor: 1000 },
      ]);
    });

    it('leaves the next month untouched', () => {
      expect(ownRows(setUpOn16th, monthStatus(setUpOn16th, [expense('food', '2026-11-03', 400)], '2026-11'))).toEqual([
        { categoryId: 'food', plannedMinor: 31000, spentMinor: 400 },
      ]);
    });
  });
});

describe('rangeWarnings', () => {
  const source = { source: 'Fixture', url: 'https://example.test/', checked: '2026-10-16' };
  const city: City = {
    id: 'regensburg',
    name: 'Regensburg',
    ranges: [
      { categoryId: 'food', minMinor: 20000, maxMinor: 30000, ...source },
      { categoryId: 'rent', minMinor: 30000, maxMinor: 50000, ...source },
    ],
    prices: [],
  };

  it('warns when food is below the city minimum', () => {
    const low: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 15000 }] };
    expect(rangeWarnings(low, city)).toEqual([
      { categoryId: 'food', typicalMinMinor: 20000, typicalMaxMinor: 30000 },
    ]);
  });

  it('does not warn at or above the minimum', () => {
    const ok: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 21000 }] };
    expect(rangeWarnings(ok, city)).toEqual([]);
    const exact: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }] };
    expect(rangeWarnings(exact, city)).toEqual([]);
  });

  it('never warns about rent, however low, and skips envelopes without a city range', () => {
    const cheapRent: Plan = {
      ...plan,
      fixed: [{ categoryId: 'rent', monthlyMinor: 10000 }],
      envelopes: [{ categoryId: 'shopping', monthlyMinor: 100 }],
    };
    expect(rangeWarnings(cheapRent, city)).toEqual([]);
  });
});
