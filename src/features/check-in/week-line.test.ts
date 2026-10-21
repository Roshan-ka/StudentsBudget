import { describe, expect, it } from 'vitest';
import type { EnvelopeWeek } from '@/lib/budget';
import { weekLine } from './week-line';

function week(weekShareMinor: number, spentThisWeekMinor: number, safeMinor = 0): EnvelopeWeek {
  return { categoryId: 'eating-out', weekShareMinor, spentThisWeekMinor, safeMinor };
}

describe('weekLine', () => {
  it('says how much is left of the week when less was spent than planned', () => {
    expect(weekLine(week(7000, 2000))).toBe('€70 planned · €20 spent · €50 under');
  });

  it('says how much is over, calmly, when more was spent than planned', () => {
    expect(weekLine(week(7000, 8200))).toBe('€70 planned · €82 spent · €12 over');
  });

  it('says on plan when spent equals the week share', () => {
    expect(weekLine(week(7000, 7000))).toBe('€70 planned · €70 spent · on plan');
    expect(weekLine(week(0, 0))).toBe('€0 planned · €0 spent · on plan');
  });

  it('compares the week with its own share, whatever the safe amount of the row says', () => {
    expect(weekLine(week(7000, 2000, -30000))).toBe('€70 planned · €20 spent · €50 under');
    expect(weekLine(week(7000, 8200, 90000))).toBe('€70 planned · €82 spent · €12 over');
  });

  it('keeps the cents of a non-zero amount under 50 cents, like the rest of the week lines', () => {
    expect(weekLine(week(7000, 6960))).toBe('€70 planned · €70 spent · €0.40 under');
    expect(weekLine(week(7000, 7040))).toBe('€70 planned · €70 spent · €0.40 over');
    expect(weekLine(week(40, 0))).toBe('€0.40 planned · €0 spent · €0.40 under');
  });

  it('reads spending in an envelope that has no share this week as over', () => {
    expect(weekLine(week(0, 600))).toBe('€0 planned · €6 spent · €6 over');
  });
});
