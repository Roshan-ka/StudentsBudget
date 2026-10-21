import { describe, expect, it } from 'vitest';
import type { Entry, Plan } from '@/db/types';
import { localSuggestions } from '@/features/swaps/suggest';
import { weekToSpend, type EnvelopeWeek } from '@/lib/budget';
import { weekLine } from './week-line';
import { weekSwaps } from './week-swaps';

function row(categoryId: string, weekShareMinor: number, spentThisWeekMinor: number): EnvelopeWeek {
  return { categoryId, weekShareMinor, spentThisWeekMinor, safeMinor: 0 };
}

const swapIds = (swaps: ReturnType<typeof weekSwaps>) => [...swaps.values()].map((s) => [s.categoryId, s.swap.id]);

describe('weekSwaps', () => {
  it('gives no line to a week that came in under its share, even at 93% early in the month', () => {
    // Sunday 18 October: €26 of the €28 share is 93%, and the month's last 7 days have not begun.
    const eatingOut = row('eating-out', 2800, 2600);
    expect(weekLine(eatingOut)).toBe('€28 planned · €26 spent · €2 under');

    expect(weekSwaps([eatingOut], '2026-10-18').size).toBe(0);
    // Home's month rule would suggest it on that day: the check-in does not.
    const asHomeWouldJudgeIt = { categoryId: 'eating-out', plannedMinor: 2800, spentMinor: 2600 };
    expect(localSuggestions.suggest({ rows: [asHomeWouldJudgeIt], today: '2026-10-18' })).toHaveLength(1);
  });

  it('gives no line to a week spent exactly to its share', () => {
    expect(weekSwaps([row('eating-out', 2800, 2800)], '2026-10-18').size).toBe(0);
  });

  it('suggests a swap for a row over its share, early or late in the month', () => {
    const over = row('eating-out', 2800, 2801);
    expect(swapIds(weekSwaps([over], '2026-10-18'))).toEqual([['eating-out', 'mensa-instead-of-restaurant']]);
    // Sunday 25 October is one of the month's last 7 days: over still counts.
    expect(swapIds(weekSwaps([over], '2026-10-25'))).toEqual([['eating-out', 'mensa-instead-of-restaurant']]);
  });

  it('keeps one line per row that is over, and none for a row over without a swap', () => {
    const rows = [
      row('food', 7000, 9000),
      row('eating-out', 2800, 2700),
      // Planned at €0 this week, with spending: over.
      row('transport', 0, 1500),
      row('going-out', 1000, 1200),
    ];
    expect(swapIds(weekSwaps(rows, '2026-10-18'))).toEqual([
      ['transport', 'deutschlandticket-for-travel-months'],
      ['going-out', 'cinema-student-price'],
    ]);
  });

  it('gives nothing for no rows, or a row planned at €0 with nothing spent', () => {
    expect(weekSwaps([], '2026-10-18').size).toBe(0);
    expect(weekSwaps([row('transport', 0, 0)], '2026-10-18').size).toBe(0);
  });

  describe('on the shares of weekToSpend', () => {
    const plan: Plan = {
      id: 'current',
      cityId: 'regensburg',
      incomes: [],
      fixed: [],
      oneOffs: [],
      envelopes: [
        { categoryId: 'food', monthlyMinor: 25000 },
        { categoryId: 'eating-out', monthlyMinor: 8000 },
        { categoryId: 'transport', monthlyMinor: 5000 },
      ],
      createdOn: '2026-10-01',
    };
    const expense = (id: string, categoryId: string, date: string, eurMinor: number): Entry => ({
      id,
      type: 'expense',
      categoryId,
      date,
      accountId: 'cash',
      amountMinor: eurMinor,
      eurMinor,
      note: '',
      createdAt: `${date}T12:00:00.000Z`,
    });
    // Wed 21 Oct: two weeks of October are left. Eating out is €40 down from the 6th, so its week share is
    // (80 − 40) / 2 = €20, not the €40 an even split of the month would give.
    const day = '2026-10-21';
    // The rows the check-in lists: an envelope with no share and nothing spent is left out.
    const weekRows = (entries: Entry[]) =>
      weekToSpend(plan, entries, day).envelopes.filter((e) => e.weekShareMinor > 0 || e.spentThisWeekMinor > 0);

    it('judges a row against its share of what is left of the month', () => {
      const rows = weekRows([
        expense('a', 'eating-out', '2026-10-06', 4000),
        expense('b', 'eating-out', '2026-10-20', 2500),
        // Food: €100 gone this week of its €125 share, so under it.
        expense('c', 'food', '2026-10-20', 10000),
      ]);
      expect(rows.map((r) => [r.categoryId, r.weekShareMinor, r.spentThisWeekMinor])).toEqual([
        ['food', 12500, 10000],
        ['eating-out', 2000, 2500],
        ['transport', 2500, 0],
      ]);
      // Only eating out is over its €20 share ("€5 over").
      expect(weekLine(rows[1])).toBe('€20 planned · €25 spent · €5 over');
      expect(swapIds(weekSwaps(rows, day))).toEqual([['eating-out', 'mensa-instead-of-restaurant']]);
    });

    it('gives a row whose month is used up no share, so any spending in it is over', () => {
      const rows = weekRows([expense('a', 'transport', '2026-10-03', 5200), expense('b', 'transport', '2026-10-22', 600)]);
      expect(rows[2]).toMatchObject({ categoryId: 'transport', weekShareMinor: 0, spentThisWeekMinor: 600 });
      expect(weekLine(rows[2])).toBe('€0 planned · €6 spent · €6 over');
      expect(swapIds(weekSwaps(rows, day))).toEqual([['transport', 'deutschlandticket-for-travel-months']]);
    });
  });
});
