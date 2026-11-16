import { describe, expect, it } from 'vitest';
import { formatDay, recapMonthLabel, recapResult } from './reveal-text';

describe('formatDay', () => {
  it('gives the day and the short month', () => {
    expect(formatDay('2026-10-16')).toBe('16 Oct');
    expect(formatDay('2026-11-06')).toBe('6 Nov');
  });
});

describe('recapMonthLabel', () => {
  it('names the month with its year', () => {
    expect(recapMonthLabel('2026-10')).toBe('October 2026');
    expect(recapMonthLabel('2026-11')).toBe('November 2026');
  });
});

describe('recapResult', () => {
  it('says what is left over of a month as savings', () => {
    expect(recapResult(1500)).toBe('€15 left over → savings');
    expect(recapResult(27400)).toBe('€274 left over → savings');
  });

  it('says plainly and calmly when a month went over its plan, or landed on it', () => {
    expect(recapResult(-1200)).toBe('€12 over plan');
    expect(recapResult(0)).toBe('Right on plan');
  });

  // Roshan, 2026-11-06: the month of setup counts whole, so its line is like any other month's.
  it('has no "counted from" for the month the plan was set up in', () => {
    expect(recapResult(27400)).not.toContain('counted from');
  });
});

describe('in another language', () => {
  it("writes the month and the amount the language's way", () => {
    expect(recapMonthLabel('2026-10', 'de')).toBe('Oktober 2026');
    expect(recapResult(27400, 'de')).toContain('274 €');
    expect(formatDay('2026-10-16', 'de-DE')).toBe('16. Okt.');
  });
});
