import { describe, expect, it } from 'vitest';
import type { Plan } from '@/db/types';
import { planForMonth, planMonthFor, planMonthOf, type PlanMonth } from './plan-history';

const SCHEDULE = {
  id: 's1',
  frequency: 'monthly',
  day: 1,
  accountId: 'local',
  amountMinor: 40000,
  startOn: '2026-10-02',
  postedThrough: '2026-11-01',
} as const;

/** Today's plan: rent €400 with its schedule, food €250, a budget of €500. Set up in October 2026. */
const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [{ categoryId: 'income-job', monthlyMinor: 90000 }],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40000, schedule: { ...SCHEDULE } }],
  oneOffs: [{ id: 'fee', name: 'Semester fee', amountMinor: 20800, createdMonth: '2026-10', dueMonth: '2027-01' }],
  envelopes: [{ categoryId: 'food', monthlyMinor: 25000 }],
  spendingBudgetMinor: 50000,
  createdOn: '2026-10-05',
};

/** October's plan: food was €200, and no budget was set then. */
const OCTOBER: PlanMonth = {
  month: '2026-10',
  incomes: [{ categoryId: 'income-job', monthlyMinor: 80000 }],
  fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }],
};

const TODAY = '2026-12-10';

describe('planMonthOf', () => {
  it('keeps the money parts and drops the schedules', () => {
    const row = planMonthOf(PLAN, '2026-12');
    expect(row).toEqual({
      month: '2026-12',
      incomes: [{ categoryId: 'income-job', monthlyMinor: 90000 }],
      fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
      oneOffs: PLAN.oneOffs,
      envelopes: [{ categoryId: 'food', monthlyMinor: 25000 }],
      spendingBudgetMinor: 50000,
    });
    expect('schedule' in row.fixed[0]).toBe(false);
  });

  it('writes no budget for a plan without one', () => {
    const { spendingBudgetMinor, ...withoutBudget } = PLAN;
    expect(spendingBudgetMinor).toBe(50000);
    expect('spendingBudgetMinor' in planMonthOf(withoutBudget, '2026-12')).toBe(false);
  });

  it('copies, so editing the row leaves the plan alone', () => {
    const row = planMonthOf(PLAN, '2026-12');
    row.envelopes[0].monthlyMinor = 1;
    row.oneOffs[0].amountMinor = 1;
    expect(PLAN.envelopes[0].monthlyMinor).toBe(25000);
    expect(PLAN.oneOffs[0].amountMinor).toBe(20800);
  });
});

describe('planMonthFor', () => {
  const NOVEMBER: PlanMonth = { ...OCTOBER, month: '2026-11', envelopes: [{ categoryId: 'food', monthlyMinor: 22000 }] };

  it('takes the month’s own row, else the latest before it, else none', () => {
    const history = [NOVEMBER, OCTOBER];
    expect(planMonthFor(history, '2026-11')).toBe(NOVEMBER);
    expect(planMonthFor(history, '2026-10')).toBe(OCTOBER);
    expect(planMonthFor(history, '2027-02')).toBe(NOVEMBER);
    expect(planMonthFor(history, '2026-09')).toBeUndefined();
    expect(planMonthFor([], '2026-11')).toBeUndefined();
  });
});

describe('planForMonth', () => {
  it('measures the current month and later against the current plan, whatever the history says', () => {
    const history = [{ ...OCTOBER, month: '2026-12' }];
    expect(planForMonth(PLAN, history, '2026-12', TODAY)).toBe(PLAN);
    expect(planForMonth(PLAN, history, '2027-01', TODAY)).toBe(PLAN);
  });

  it('measures a past month against its own row, keeping the plan’s other fields', () => {
    const october = planForMonth(PLAN, [OCTOBER], '2026-10', TODAY);
    expect(october.envelopes).toEqual([{ categoryId: 'food', monthlyMinor: 20000 }]);
    expect(october.incomes).toEqual([{ categoryId: 'income-job', monthlyMinor: 80000 }]);
    expect(october.oneOffs).toEqual([]);
    expect(october.createdOn).toBe(PLAN.createdOn);
    expect(october.cityId).toBe(PLAN.cityId);
    // The month's budget, or none: never today's.
    expect('spendingBudgetMinor' in october).toBe(false);
  });

  it('measures a month with no row of its own against the latest row before it', () => {
    expect(planForMonth(PLAN, [OCTOBER], '2026-11', TODAY).envelopes).toEqual(OCTOBER.envelopes);
  });

  it('measures a month with no row at or before it against the current plan, as before plan history', () => {
    expect(planForMonth(PLAN, [OCTOBER], '2026-09', TODAY)).toBe(PLAN);
    expect(planForMonth(PLAN, [], '2026-11', TODAY)).toBe(PLAN);
  });

  it('leaves the plan and the row as they were', () => {
    const november = planForMonth(PLAN, [OCTOBER], '2026-11', TODAY);
    november.envelopes[0].monthlyMinor = 1;
    expect(OCTOBER.envelopes[0].monthlyMinor).toBe(20000);
    expect(PLAN.spendingBudgetMinor).toBe(50000);
  });
});
