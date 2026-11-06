import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { completedMonths, monthRecap } from './reveal';

let nextId = 0;
function entry(categoryId: string, date: string, eurMinor: number, type: 'expense' | 'income' = 'expense'): Entry {
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

function planOf(createdOn: string, envelopes: { categoryId: string; monthlyMinor: number }[]): Plan {
  return {
    id: 'current',
    cityId: 'regensburg',
    incomes: [],
    fixed: [],
    oneOffs: [],
    envelopes,
    createdOn,
  };
}

describe('monthRecap', () => {
  // `monthStatus` adds a €0 row for each flexible category the plan has no envelope for; these tests look at the others.
  const used = <T extends { plannedMinor: number; spentMinor: number }>(rows: T[]): T[] =>
    rows.filter((r) => r.plannedMinor > 0 || r.spentMinor > 0);

  it('adds up planned minus spent over the envelopes', () => {
    // The plan was made in September, so October is a whole month.
    const plan = planOf('2026-09-01', [
      { categoryId: 'food', monthlyMinor: 31000 },
      { categoryId: 'eating-out', monthlyMinor: 15500 },
    ]);
    const entries = [
      entry('food', '2026-10-03', 15000),
      entry('food', '2026-10-28', 10000),
      entry('eating-out', '2026-10-12', 20000),
    ];
    const recap = monthRecap(plan, entries, '2026-10');
    expect(used(recap.rows)).toEqual([
      { categoryId: 'food', plannedMinor: 31000, spentMinor: 25000 },
      { categoryId: 'eating-out', plannedMinor: 15500, spentMinor: 20000 },
    ]);
    expect(recap.leftoverMinor).toBe(1500);
  });

  it('in the setup month plans the whole month and counts the whole month’s spending', () => {
    const plan = planOf('2026-10-16', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    // The whole 31000, not the part from the 16th. The food bought on the 10th, before the plan, counts too.
    const before = monthRecap(plan, [entry('food', '2026-10-10', 9000)], '2026-10');
    expect(used(before.rows)).toEqual([{ categoryId: 'food', plannedMinor: 31000, spentMinor: 9000 }]);
    expect(before.leftoverMinor).toBe(22000);

    const logged = [entry('food', '2026-10-10', 9000), entry('food', '2026-10-20', 5000)];
    const after = monthRecap(plan, logged, '2026-10');
    expect(after.rows[0].spentMinor).toBe(14000);
    expect(after.leftoverMinor).toBe(17000);
  });

  it('is negative when more was spent than planned', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    const recap = monthRecap(plan, [entry('food', '2026-10-05', 32200)], '2026-10');
    expect(recap.leftoverMinor).toBe(-1200);
  });

  it('counts spending in a category the plan has no envelope for, against nothing', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    const recap = monthRecap(plan, [entry('health', '2026-10-05', 1800)], '2026-10');
    expect(recap.rows.find((r) => r.categoryId === 'health')).toEqual({
      categoryId: 'health',
      plannedMinor: 0,
      spentMinor: 1800,
    });
    expect(recap.leftoverMinor).toBe(31000 - 1800);
  });

  it('ignores other months, income and transfers', () => {
    const plan = planOf('2026-09-01', [{ categoryId: 'food', monthlyMinor: 31000 }]);
    const entries = [
      entry('food', '2026-09-30', 4000),
      entry('food', '2026-11-01', 4000),
      entry('food', '2026-10-10', 4000, 'income'),
      transfer('2026-10-11', 4000),
      entry('food', '2026-10-12', 1000),
    ];
    const recap = monthRecap(plan, entries, '2026-10');
    expect(recap.rows[0].spentMinor).toBe(1000);
    expect(recap.leftoverMinor).toBe(30000);
  });
});

describe('completedMonths', () => {
  it('lists the months from the setup month up to the one before today, newest first', () => {
    expect(completedMonths('2026-10-16', '2026-12-02')).toEqual(['2026-11', '2026-10']);
    expect(completedMonths('2026-10-16', '2027-01-05')).toEqual(['2026-12', '2026-11', '2026-10']);
  });

  it('is empty while the setup month is still running, and when the clock is behind the setup day', () => {
    expect(completedMonths('2026-10-16', '2026-10-16')).toEqual([]);
    expect(completedMonths('2026-10-16', '2026-10-31')).toEqual([]);
    expect(completedMonths('2026-10-16', '2026-09-20')).toEqual([]);
  });

  it('counts a month as completed on its last day plus one', () => {
    expect(completedMonths('2026-10-16', '2026-11-01')).toEqual(['2026-10']);
  });
});
