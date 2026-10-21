import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { weekToSpend } from '@/lib/budget';
import { weekLine } from './week-line';
import { weekRows } from './week-rows';

const plan: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [],
  fixed: [],
  oneOffs: [],
  envelopes: [
    { categoryId: 'food', monthlyMinor: 25000 },
    { categoryId: 'eating-out', monthlyMinor: 8000 },
    { categoryId: 'going-out', monthlyMinor: 0 },
  ],
  createdOn: '2026-10-01',
};

const expense = (categoryId: string, date: string, eurMinor: number): Entry => ({
  id: `${categoryId}-${date}`,
  type: 'expense',
  categoryId,
  date,
  accountId: 'cash',
  amountMinor: eurMinor,
  eurMinor,
  note: '',
  createdAt: `${date}T12:00:00.000Z`,
});

// Wed 21 Oct: two weeks of October are left (19-25 and 26-31).
const rowsOn = (entries: Entry[], p: Plan = plan) => weekRows(p, weekToSpend(p, entries, '2026-10-21').envelopes);

describe('weekRows', () => {
  it('lists each envelope with a monthly amount, and leaves out one at €0 or a category with no envelope and no spending', () => {
    expect(rowsOn([]).map((row) => [row.categoryId, row.weekShareMinor, row.usedUp])).toEqual([
      ['food', 12500, false],
      ['eating-out', 4000, false],
    ]);
  });

  it('keeps an envelope that is used up for the month, though its share of the week is €0', () => {
    // Eating out is €2 over by Tue 6 Oct, and nothing is spent this week.
    const rows = rowsOn([expense('eating-out', '2026-10-06', 8200)]);

    expect(rows.map((row) => [row.categoryId, row.weekShareMinor, row.spentThisWeekMinor, row.usedUp])).toEqual([
      ['food', 12500, 0, false],
      ['eating-out', 0, 0, true],
    ]);
    expect(weekLine(rows[1], rows[1].usedUp)).toBe('Nothing left this month · €0 spent');
  });

  it('says what was spent over in an envelope that is used up, when something is spent this week', () => {
    // The €80 was gone by 6 Oct, so this week's €6 is all over.
    const rows = rowsOn([expense('eating-out', '2026-10-06', 8000), expense('eating-out', '2026-10-20', 600)]);
    const eatingOut = rows.find((row) => row.categoryId === 'eating-out');

    expect(eatingOut).toMatchObject({ weekShareMinor: 0, spentThisWeekMinor: 600, usedUp: true });
    expect(eatingOut && weekLine(eatingOut, eatingOut.usedUp)).toBe('Nothing left this month · €6 spent · €6 over');
  });

  it('lists a category with no envelope, or an envelope at €0, once something was spent on it this week', () => {
    const rows = rowsOn([expense('health', '2026-10-20', 1500), expense('going-out', '2026-10-21', 900)]);

    expect(rows.map((row) => [row.categoryId, row.weekShareMinor, row.spentThisWeekMinor, row.usedUp])).toEqual([
      ['food', 12500, 0, false],
      ['eating-out', 4000, 0, false],
      ['going-out', 0, 900, false],
      ['health', 0, 1500, false],
    ]);
    // Neither has a plan to be used up, so they read as before.
    expect(weekLine(rows[3], rows[3].usedUp)).toBe('€0 planned · €15 spent · €15 over');
  });

  it('is empty for a plan with no amounts in its envelopes and nothing spent', () => {
    const blank: Plan = { ...plan, envelopes: plan.envelopes.map((e) => ({ ...e, monthlyMinor: 0 })) };

    expect(rowsOn([], blank)).toEqual([]);
  });
});
