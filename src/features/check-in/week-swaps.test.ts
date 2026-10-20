import { describe, expect, it } from 'vitest';
import { localSuggestions } from '@/features/swaps/suggest';
import type { EnvelopeWeek } from '@/lib/budget';
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
});
