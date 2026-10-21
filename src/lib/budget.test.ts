import { describe, expect, it } from 'vitest';
import type { City } from '@/data/cities';
import type { Entry, OneOff, Plan, Schedule } from '@/db/types';
import { monthStatus, planSummary, rangeWarnings, setAsideMonthly, weekAllowance, weekToSpend } from './budget';
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

/** The rows for the plan's own envelopes; `weekToSpend` and `monthStatus` add €0 rows for the other flexible categories. */
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

describe('weekToSpend', () => {
  // Envelopes totalling €500. On Wed 21 Oct 2026 two weeks of October are left: Mon 19 – Sun 25 and Mon 26 – Sat 31.
  const envelopes = [
    { categoryId: 'food', monthlyMinor: 25000 },
    { categoryId: 'eating-out', monthlyMinor: 10000 },
    { categoryId: 'going-out', monthlyMinor: 6000 },
    { categoryId: 'transport', monthlyMinor: 5000 },
    { categoryId: 'shopping', monthlyMinor: 4000 },
  ];
  const setUpOn21st: Plan = { ...plan, envelopes, createdOn: '2026-10-21' };
  const setUpOn1st: Plan = { ...setUpOn21st, createdOn: '2026-10-01' };

  /** What Home calls "Left to spend this month". */
  const leftThisMonth = (p: Plan, entries: Entry[], month: string) =>
    monthStatus(p, entries, month).reduce((total, s) => total + s.plannedMinor - s.spentMinor, 0);

  it('splits a month with nothing spent evenly over the weeks left, the week of setup included', () => {
    const s = weekToSpend(setUpOn21st, [], '2026-10-21');
    expect(s.weekStart).toBe('2026-10-19');
    expect(s.weekEnd).toBe('2026-10-25');
    expect(s.totalMinor).toBe(25000);
    expect(ownRows(setUpOn21st, s.envelopes).map((e) => [e.categoryId, e.weekShareMinor, e.safeMinor])).toEqual([
      ['food', 12500, 12500],
      ['eating-out', 5000, 5000],
      ['going-out', 3000, 3000],
      ['transport', 2500, 2500],
      ['shopping', 2000, 2000],
    ]);
  });

  it('takes what was spent this week off this week, and the month off the month', () => {
    const entries = [expense('food', '2026-10-21', 5000)];
    const s = weekToSpend(setUpOn21st, entries, '2026-10-21');
    expect(s.totalMinor).toBe(20000);
    expect(s.envelopes[0]).toEqual({ categoryId: 'food', weekShareMinor: 12500, spentThisWeekMinor: 5000, safeMinor: 7500 });
    expect(leftThisMonth(setUpOn21st, entries, '2026-10')).toBe(45000);
  });

  it('gives the last week of the month what is left of it', () => {
    // Mon 26 Oct: €50 went out earlier, one week is left.
    const entries = [expense('food', '2026-10-21', 5000)];
    const s = weekToSpend(setUpOn21st, entries, '2026-10-26');
    expect(s.weekStart).toBe('2026-10-26');
    expect(s.weekEnd).toBe('2026-10-31');
    expect(s.totalMinor).toBe(45000);
    expect(s.envelopes[0]).toEqual({ categoryId: 'food', weekShareMinor: 20000, spentThisWeekMinor: 0, safeMinor: 20000 });
  });

  it('counts five weeks in a month set up on Thursday the 1st', () => {
    // 1–4, 5–11, 12–18, 19–25 and 26–31 October.
    const s = weekToSpend(setUpOn1st, [], '2026-10-01');
    expect(s.weekStart).toBe('2026-10-01');
    expect(s.weekEnd).toBe('2026-10-04');
    expect(s.totalMinor).toBe(10000);
    expect(s.envelopes[0].weekShareMinor).toBe(5000);
  });

  it('counts a stub week of one day as a week', () => {
    // Mon 31 Aug 2026 is the month's last day and its own week: what is left is this week's.
    const august: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }], createdOn: '2026-08-01' };
    const last = weekToSpend(august, [expense('food', '2026-08-10', 12000)], '2026-08-31');
    expect(last.weekStart).toBe('2026-08-31');
    expect(last.weekEnd).toBe('2026-08-31');
    expect(last.totalMinor).toBe(19000);
  });

  describe('in a month that starts on a Sunday', () => {
    // Sun 1 Nov 2026: its week began on Mon 26 Oct, so six weeks of November are left that day, and five from the Monday.
    const november: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 30000 }], createdOn: '2026-09-01' };

    it('has six weeks on the Sunday, whose week is a stub of one day', () => {
      const s = weekToSpend(november, [expense('food', '2026-10-31', 9999)], '2026-11-01');
      expect(s.weekStart).toBe('2026-11-01');
      expect(s.weekEnd).toBe('2026-11-01');
      expect(s.totalMinor).toBe(5000);
    });

    it('has five weeks from the Monday after, with the Sunday already counted', () => {
      const s = weekToSpend(november, [expense('food', '2026-11-01', 1000)], '2026-11-02');
      expect(s.weekStart).toBe('2026-11-02');
      expect(s.weekEnd).toBe('2026-11-08');
      // (30000 − 1000) / 5
      expect(s.totalMinor).toBe(5800);
    });
  });

  it('measures each part of a week a month boundary cuts against its own month', () => {
    const entries = [expense('food', '2026-10-20', 5000), expense('food', '2026-10-27', 2000), expense('food', '2026-11-01', 800)];
    const food = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }], createdOn: '2026-10-01' };

    // Mon 26 – Sat 31 Oct, as the check-in reads it on Sunday 1 Nov: October's last week.
    const october = weekToSpend(food, entries, '2026-10-31');
    expect(october.weekStart).toBe('2026-10-26');
    expect(october.weekEnd).toBe('2026-10-31');
    expect(october.envelopes[0]).toEqual({ categoryId: 'food', weekShareMinor: 26000, spentThisWeekMinor: 2000, safeMinor: 24000 });

    // Sun 1 Nov: one of November's six weeks left, and none of October's spending.
    const november = weekToSpend(food, entries, '2026-11-01');
    expect(november.envelopes[0]).toEqual({ categoryId: 'food', weekShareMinor: 5167, spentThisWeekMinor: 800, safeMinor: 4367 });
    expect(november.totalMinor).toBe(4367);
  });

  it('gives an envelope that is used up no share, while the total goes on counting what was overspent', () => {
    const two: Plan = {
      ...setUpOn1st,
      envelopes: [
        { categoryId: 'food', monthlyMinor: 20000 },
        { categoryId: 'eating-out', monthlyMinor: 10000 },
      ],
    };
    const entries = [expense('food', '2026-10-05', 25000), expense('eating-out', '2026-10-27', 2000)];

    // Wed 28 Oct: the last week. Food is €50 over its month, so its share is €0 and not −€50.
    const s = weekToSpend(two, entries, '2026-10-28');
    expect(ownRows(two, s.envelopes)).toEqual([
      { categoryId: 'food', weekShareMinor: 0, spentThisWeekMinor: 0, safeMinor: 0 },
      { categoryId: 'eating-out', weekShareMinor: 10000, spentThisWeekMinor: 2000, safeMinor: 8000 },
    ]);
    // (30000 − 25000) − 2000
    expect(s.totalMinor).toBe(3000);

    // More overspent: nothing is left of the month and the total reads negative.
    const worse = weekToSpend(two, [expense('food', '2026-10-05', 35000), entries[1]], '2026-10-28');
    expect(worse.envelopes[0].weekShareMinor).toBe(0);
    expect(worse.totalMinor).toBe(-7000);
  });

  it('goes negative when more is spent this week than the week allows', () => {
    const s = weekToSpend(setUpOn21st, [expense('food', '2026-10-22', 30000)], '2026-10-23');
    expect(s.totalMinor).toBe(-5000);
    expect(s.envelopes[0]).toMatchObject({ weekShareMinor: 12500, spentThisWeekMinor: 30000, safeMinor: -17500 });
  });

  it('does not count spending before the setup day', () => {
    // Set up Wed 21 Oct: the Monday and the Tuesday of that week are before the plan.
    const entries = [
      expense('food', '2026-10-19', 9000),
      expense('food', '2026-10-20', 3000),
      expense('food', '2026-10-21', 1000),
    ];
    const week = weekToSpend(setUpOn21st, entries, '2026-10-21');
    expect(week.totalMinor).toBe(24000);
    expect(week.envelopes[0]).toMatchObject({ weekShareMinor: 12500, spentThisWeekMinor: 1000 });

    // Nor in the weeks after it: only the €10 from the setup day is gone from food.
    const next = weekToSpend(setUpOn21st, entries, '2026-10-26');
    expect(next.envelopes[0].weekShareMinor).toBe(24000);
    expect(next.totalMinor).toBe(49000);
  });

  it('has no budget in a week that ended before the setup day', () => {
    const setUpOn16th: Plan = { ...setUpOn1st, createdOn: '2026-10-16' };
    const s = weekToSpend(setUpOn16th, [expense('food', '2026-10-08', 4000)], '2026-10-08');
    expect(s.totalMinor).toBe(0);
    expect(s.envelopes.every((e) => e.weekShareMinor === 0 && e.spentThisWeekMinor === 0 && e.safeMinor === 0)).toBe(true);
  });

  it('adds a €0 row for each flexible category the plan has no envelope for, so its spending still counts', () => {
    const entries = [
      expense('food', '2026-10-05', 5000),
      expense('food', '2026-10-14', 2000),
      expense('health', '2026-10-14', 1500),
    ];
    const s = weekToSpend(foodOnly, entries, '2026-10-16');

    // Three weeks left (12–18, 19–25, 26–31): food (31000 − 5000) / 3 = 8667.
    expect(s.envelopes.map((e) => e.categoryId)).toEqual(['food', ...MISSING_FROM_FOOD_ONLY]);
    expect(s.envelopes[0]).toEqual({ categoryId: 'food', weekShareMinor: 8667, spentThisWeekMinor: 2000, safeMinor: 6667 });
    expect(s.envelopes.find((e) => e.categoryId === 'health')).toEqual({
      categoryId: 'health',
      weekShareMinor: 0,
      spentThisWeekMinor: 1500,
      safeMinor: -1500,
    });
    expect(s.totalMinor).toBe(8667 - 2000 - 1500);
  });

  it('ignores transfers, income and fixed-category expenses', () => {
    const noise = [
      transfer('2026-10-14', 8000),
      expense('rent', '2026-10-01', 40000),
      expense('gym', '2026-10-13', 4000),
      expense('food', '2026-10-14', 3000, 'income'),
    ];
    expect(weekToSpend(foodOnly, noise, '2026-10-16').totalMinor).toBe(10333);
  });

  it('leaves the next month untouched', () => {
    // Mon 2 Nov: five weeks left, none of October's spending.
    const s = weekToSpend(setUpOn21st, [expense('food', '2026-10-25', 20000)], '2026-11-02');
    expect(s.totalMinor).toBe(10000);
  });

  it('adds the weeks of a month up to exactly the monthly amount when each week spends its share, whatever the rounding', () => {
    const food: Plan = { ...setUpOn1st, envelopes: [{ categoryId: 'food', monthlyMinor: 10001 }] };
    const entries: Entry[] = [];
    const shares: number[] = [];
    for (let day = firstOfMonth('2026-10'); monthOf(day) === '2026-10'; ) {
      const week = weekToSpend(food, entries, day);
      const share = week.envelopes[0].weekShareMinor;
      shares.push(share);
      entries.push(expense('food', week.weekStart, share));
      expect(weekToSpend(food, entries, day).totalMinor).toBe(0);
      day = addDays(week.weekEnd, 1);
    }
    expect(shares).toEqual([2000, 2000, 2000, 2001, 2000]);
    expect(shares.reduce((total, share) => total + share, 0)).toBe(10001);
  });

  it("adds the weeks of a month up to exactly the whole month when each week spends Home's total, across envelopes", () => {
    const several: Plan = {
      ...setUpOn1st,
      envelopes: [
        { categoryId: 'food', monthlyMinor: 10001 },
        { categoryId: 'eating-out', monthlyMinor: 7003 },
        { categoryId: 'going-out', monthlyMinor: 4999 },
      ],
    };
    const entries: Entry[] = [];
    const totals: number[] = [];
    for (let day = firstOfMonth('2026-10'), i = 0; monthOf(day) === '2026-10'; i += 1) {
      const week = weekToSpend(several, entries, day);
      totals.push(week.totalMinor);
      // Each week's total goes on another envelope: one may run over while the month as a whole does not.
      entries.push(expense(several.envelopes[i % several.envelopes.length].categoryId, week.weekStart, week.totalMinor));
      expect(weekToSpend(several, entries, day).totalMinor).toBe(0);
      day = addDays(week.weekEnd, 1);
    }
    expect(totals).toHaveLength(5);
    expect(totals.every((total) => total >= 0)).toBe(true);
    expect(totals.reduce((sum, total) => sum + total, 0)).toBe(10001 + 7003 + 4999);
    expect(leftThisMonth(several, entries, '2026-10')).toBe(0);
  });

  it('keeps a used-up envelope at no share while weeks are left, and spreads what it overspent over those weeks', () => {
    const two: Plan = {
      ...setUpOn1st,
      envelopes: [
        { categoryId: 'food', monthlyMinor: 10000 },
        { categoryId: 'eating-out', monthlyMinor: 8000 },
      ],
    };
    // Food is €50 over by Mon 5 Oct.
    const entries = [expense('food', '2026-10-05', 15000)];

    // Wed 21 Oct: two weeks are left. Food has no share, not −€25, and eating out has half of its €80.
    const s = weekToSpend(two, entries, '2026-10-21');
    expect(ownRows(two, s.envelopes)).toEqual([
      { categoryId: 'food', weekShareMinor: 0, spentThisWeekMinor: 0, safeMinor: 0 },
      { categoryId: 'eating-out', weekShareMinor: 4000, spentThisWeekMinor: 0, safeMinor: 4000 },
    ]);
    // The total still counts the overspending: (10000 − 15000 + 8000) / 2, not the €40 the shares add up to.
    expect(s.totalMinor).toBe(1500);
  });

  it('spreads a month that is already overspent over the weeks left, before this week is spent', () => {
    const food: Plan = { ...setUpOn1st, envelopes: [{ categoryId: 'food', monthlyMinor: 10000 }] };
    const entries = [expense('food', '2026-10-05', 15000)];

    // €50 over with two weeks left: −€25 each.
    expect(weekToSpend(food, entries, '2026-10-21').totalMinor).toBe(-2500);
    // What is spent this week comes off as well.
    expect(weekToSpend(food, [...entries, expense('food', '2026-10-22', 1000)], '2026-10-21').totalMinor).toBe(-3500);
    // The last week has all of it.
    expect(weekToSpend(food, entries, '2026-10-28').totalMinor).toBe(-5000);
  });

  it('reads a total that is a fraction of a cent below zero as 0, not as −0', () => {
    const food: Plan = { ...setUpOn1st, envelopes: [{ categoryId: 'food', monthlyMinor: 10000 }] };
    // One cent over with two weeks left: −0.5 rounds to −0.
    const s = weekToSpend(food, [expense('food', '2026-10-05', 10001)], '2026-10-21');
    expect(s.totalMinor).toBe(0);
  });

  describe('with an expense dated later in the month', () => {
    const going: Plan = { ...setUpOn1st, envelopes: [{ categoryId: 'going-out', monthlyMinor: 10000 }] };

    it('takes it off what is left, so this week is never more than the month has left', () => {
      // €100 for going out and €60 of it dated Fri 30 Oct, looked at on Wed 21 Oct.
      const entries = [expense('going-out', '2026-10-30', 6000)];
      const s = weekToSpend(going, entries, '2026-10-21');

      expect(leftThisMonth(going, entries, '2026-10')).toBe(4000);
      // (10000 − 6000) / 2 weeks left, where it was 5000 before the €60 was counted.
      expect(s.totalMinor).toBe(2000);
      expect(s.totalMinor).toBeLessThanOrEqual(4000);
      expect(ownRows(going, s.envelopes)[0]).toEqual({
        categoryId: 'going-out',
        weekShareMinor: 2000,
        spentThisWeekMinor: 0,
        safeMinor: 2000,
      });
    });

    it('is at or under what the month has left on every day, whenever the month has some left', () => {
      const two: Plan = {
        ...setUpOn1st,
        envelopes: [
          { categoryId: 'food', monthlyMinor: 25000 },
          { categoryId: 'eating-out', monthlyMinor: 10000 },
        ],
      };
      const entries = [
        expense('food', '2026-10-03', 20000),
        expense('eating-out', '2026-10-12', 9000),
        expense('food', '2026-10-29', 3000),
        // No envelope, but a flexible category: it counts against the month too.
        expense('going-out', '2026-10-30', 500),
      ];
      const left = leftThisMonth(two, entries, '2026-10');
      expect(left).toBe(2500);

      for (let day = firstOfMonth('2026-10'); monthOf(day) === '2026-10'; day = addDays(day, 1)) {
        expect(weekToSpend(two, entries, day).totalMinor, day).toBeLessThanOrEqual(left);
      }
    });

    it('counts it in the week it is dated in, and leaves out one dated in a later month', () => {
      const entries = [expense('going-out', '2026-10-23', 6000), expense('going-out', '2026-11-02', 9000)];
      const s = weekToSpend(going, entries, '2026-10-21');
      // Fri 23 Oct is this week (19–25): it comes off this week, not off the share. Mon 2 Nov belongs to November.
      expect(s.envelopes.find((e) => e.categoryId === 'going-out')).toMatchObject({
        weekShareMinor: 5000,
        spentThisWeekMinor: 6000,
      });
      expect(s.totalMinor).toBe(5000 - 6000);
    });
  });
});

describe('weekAllowance', () => {
  const food: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }], createdOn: '2026-10-01' };

  it('is what the week had to spend when it began: what "This week" shows before anything is spent in it', () => {
    const entries = [expense('food', '2026-10-05', 3000)];
    // Wed 21 Oct, two weeks left: (20000 − 3000) / 2.
    expect(weekAllowance(food, entries, '2026-10-21')).toBe(8500);
    expect(weekToSpend(food, entries, '2026-10-21').totalMinor).toBe(8500);
  });

  it('is the same on every day of the week', () => {
    const entries = [expense('food', '2026-10-05', 3000)];
    for (const day of ['2026-10-19', '2026-10-20', '2026-10-23', '2026-10-25']) {
      expect(weekAllowance(food, entries, day), day).toBe(8500);
    }
  });

  it('does not change with what is spent in the week or after it', () => {
    const entries = [
      expense('food', '2026-10-05', 3000),
      expense('food', '2026-10-22', 4000),
      expense('food', '2026-10-30', 2000),
    ];
    expect(weekAllowance(food, entries, '2026-10-21')).toBe(8500);
    // "This week" does come off both: (20000 − 3000 − 2000) / 2 − 4000.
    expect(weekToSpend(food, entries, '2026-10-21').totalMinor).toBe(3500);
  });

  it('is negative when the month was already overspent', () => {
    const entries = [expense('food', '2026-10-05', 25000)];
    // (20000 − 25000) / 2
    expect(weekAllowance(food, entries, '2026-10-21')).toBe(-2500);
  });

  it('gives the last week what is left of the month, and a month that starts mid-week its own count of weeks', () => {
    const entries = [expense('food', '2026-10-05', 3000)];
    expect(weekAllowance(food, entries, '2026-10-28')).toBe(17000);
    // Sun 1 Nov: six weeks of November are left, the first of them a stub week of one day.
    expect(weekAllowance(food, entries, '2026-11-01')).toBe(3333);
  });

  it('counts spending from the setup day in the month of setup, against the whole monthly amount', () => {
    const setUp: Plan = { ...food, createdOn: '2026-10-21' };
    // Mon 19 is before the setup day: its €90 does not count. Two weeks left: 20000 / 2.
    expect(weekAllowance(setUp, [expense('food', '2026-10-19', 9000)], '2026-10-21')).toBe(10000);
    // The next week: what was spent from the setup day on is gone. (20000 − 4000) / 1.
    expect(weekAllowance(setUp, [expense('food', '2026-10-22', 4000)], '2026-10-28')).toBe(16000);
  });

  it('is 0 for a week that ended before the setup day', () => {
    const setUp: Plan = { ...food, createdOn: '2026-10-16' };
    expect(weekAllowance(setUp, [expense('food', '2026-10-08', 4000)], '2026-10-08')).toBe(0);
  });

  it('counts the flexible categories without an envelope, which only take away', () => {
    expect(weekAllowance(food, [expense('health', '2026-10-05', 4000)], '2026-10-21')).toBe(8000);
  });

  it('ignores transfers, income and fixed-category expenses', () => {
    const noise = [
      transfer('2026-10-14', 8000),
      expense('rent', '2026-10-01', 40000),
      expense('food', '2026-10-14', 3000, 'income'),
    ];
    expect(weekAllowance(food, noise, '2026-10-21')).toBe(10000);
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
    expect(weekToSpend(sixEnvelopes, [], '2026-10-16').envelopes.at(-1)?.categoryId).toBe('other');
  });

  describe('in the month the plan was set up', () => {
    const setUpOn16th: Plan = { ...foodOnly, createdOn: '2026-10-16' };

    it('plans the whole monthly amount, with no share left out for the days before the setup day', () => {
      expect(ownRows(setUpOn16th, monthStatus(setUpOn16th, [], '2026-10'))).toEqual([
        { categoryId: 'food', plannedMinor: 31000, spentMinor: 0 },
      ]);
    });

    it('counts spending from the setup day on', () => {
      const entries = [
        expense('food', '2026-10-10', 9000),
        expense('food', '2026-10-16', 700),
        expense('food', '2026-10-20', 300),
      ];
      expect(ownRows(setUpOn16th, monthStatus(setUpOn16th, entries, '2026-10'))).toEqual([
        { categoryId: 'food', plannedMinor: 31000, spentMinor: 1000 },
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
