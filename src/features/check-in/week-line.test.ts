import { describe, expect, it } from 'vitest';
import type { EnvelopeWeek } from '@/lib/budget';
import { weekLine, weekTotalLine } from './week-line';

function week(weekShareMinor: number, spentThisWeekMinor: number, safeMinor = 0): EnvelopeWeek {
  return { categoryId: 'eating-out', weekShareMinor, spentThisWeekMinor, safeMinor };
}

describe('weekLine', () => {
  it('says how much is left of the week when less was spent than planned', () => {
    expect(weekLine(week(7000, 2000))).toBe('€20 of €70 · €50 under');
  });

  it('says how much is over, calmly, when more was spent than planned', () => {
    expect(weekLine(week(7000, 8200))).toBe('€82 of €70 · €12 over');
  });

  it('says on plan when spent equals the week share', () => {
    expect(weekLine(week(7000, 7000))).toBe('€70 of €70 · on plan');
    expect(weekLine(week(0, 0))).toBe('€0 of €0 · on plan');
  });

  it('compares the week with its own share, whatever the safe amount of the row says', () => {
    expect(weekLine(week(7000, 2000, -30000))).toBe('€20 of €70 · €50 under');
    expect(weekLine(week(7000, 8200, 90000))).toBe('€82 of €70 · €12 over');
  });

  it('keeps the cents of a non-zero amount under 50 cents, like the rest of the week lines', () => {
    expect(weekLine(week(40, 0))).toBe('€0 of €0.40 · €0.40 under');
  });

  it('shows the cents of spent and planned when their whole euros read the same, so the line adds up', () => {
    // "€6 of €6 · €0.25 under" would read as a contradiction, as "€6 planned · €6 spent · €0.25 under" did (review,
    // 09-11-2026).
    expect(weekLine(week(625, 600))).toBe('€6.00 of €6.25 · €0.25 under');
    expect(weekLine(week(7000, 6960))).toBe('€69.60 of €70.00 · €0.40 under');
    expect(weekLine(week(7000, 7040))).toBe('€70.40 of €70.00 · €0.40 over');
    // German money has a no-break space before the euro sign.
    expect(weekLine(week(625, 600), false, 'de')).toBe('6,00 € von 6,25 € · 0,25 € unter Plan');
    // Equal amounts stay whole: nothing to add up.
    expect(weekLine(week(7000, 7000))).toBe('€70 of €70 · on plan');
  });

  it('reads spending in an envelope that has no share this week as over', () => {
    expect(weekLine(week(0, 600))).toBe('€6 of €0 · €6 over');
  });

  describe('for an envelope with nothing left this month', () => {
    it('says so instead of "of €0", and what was spent as over', () => {
      expect(weekLine(week(0, 600), true)).toBe('Nothing left this month · €6 spent · €6 over');
      expect(weekLine(week(0, 40), true)).toBe('Nothing left this month · €0.40 spent · €0.40 over');
    });

    it('leaves the over out when nothing was spent', () => {
      expect(weekLine(week(0, 0), true)).toBe('Nothing left this month · €0 spent');
    });
  });
});

describe('weekTotalLine', () => {
  it('says what is left to spend in the week', () => {
    expect(weekTotalLine(14500)).toBe('In total: €145 to spend this week');
    expect(weekTotalLine(0)).toBe('In total: €0 to spend this week');
  });

  it('says plainly when the week is over, without a minus sign', () => {
    expect(weekTotalLine(-3600)).toBe('In total: €36 over this week');
  });

  it('keeps the cents of a non-zero amount under 50 cents, like the other week lines', () => {
    expect(weekTotalLine(40)).toBe('In total: €0.40 to spend this week');
    expect(weekTotalLine(-49)).toBe('In total: €0.49 over this week');
  });
});

describe('in another language', () => {
  it("writes the amounts the language's way", () => {
    expect(weekLine(week(7000, 2000), false, 'de')).toContain('70\u00a0€');
    expect(weekLine(week(0, 600), true, 'de')).toContain('6\u00a0€');
    expect(weekTotalLine(14500, 'de')).toContain('145\u00a0€');
  });
});
