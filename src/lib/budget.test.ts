import { describe, expect, it } from 'vitest';
import type { City } from '@/data/cities';
import type { Entry, OneOff, Plan } from '@/db/types';
import { monthStatus, planSummary, rangeWarnings, safeToSpend, setAsideMonthly } from './budget';

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
  createdOn: '2026-10-01',
};

const foodOnly: Plan = { ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 31000 }] };

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

  it('sums the envelopes and keeps the plan order', () => {
    const s = safeToSpend(plan, [...entries, expense('going-out', '2026-10-15', 1500)], '2026-10-16');
    expect(s.envelopes.map((e) => e.categoryId)).toEqual(['food', 'going-out']);
    // going-out: through = round(15500 × 18 / 31) = 9000, spent 1500
    expect(s.envelopes[1]).toEqual({
      categoryId: 'going-out',
      weekShareMinor: 3500,
      spentThisWeekMinor: 1500,
      safeMinor: 7500,
    });
    expect(s.totalMinor).toBe(11000 + 7500);
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
      expense('shopping', '2026-10-13', 4000),
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
    expect(monthStatus(plan, entries, '2026-10')).toEqual([
      { categoryId: 'food', plannedMinor: 31000, spentMinor: 7000 },
      { categoryId: 'going-out', plannedMinor: 15500, spentMinor: 3000 },
    ]);
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
