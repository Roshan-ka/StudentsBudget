import { describe, expect, it } from 'vitest';
import { formatDay, recapLine } from './reveal-text';

describe('formatDay', () => {
  it('gives the day and the short month', () => {
    expect(formatDay('2026-10-16')).toBe('16 Oct');
    expect(formatDay('2026-11-06')).toBe('6 Nov');
  });
});

describe('recapLine', () => {
  it('says what is left over of a month as savings', () => {
    expect(recapLine('2026-11', 1500)).toBe('November 2026: €15 left over → savings');
    expect(recapLine('2026-10', 27400)).toBe('October 2026: €274 left over → savings');
  });

  it('says plainly and calmly when a month went over its plan, or landed on it', () => {
    expect(recapLine('2026-11', -1200)).toBe('November 2026: €12 over plan');
    expect(recapLine('2026-11', 0)).toBe('November 2026: right on plan');
  });

  // Roshan, 2026-11-06: the month of setup counts whole, so its line is like any other month's.
  it('has no "counted from" for the month the plan was set up in', () => {
    expect(recapLine('2026-10', 27400)).not.toContain('counted from');
  });
});

describe('in another language', () => {
  it("writes the month and the amount the language's way", () => {
    const line = recapLine('2026-10', 27400, 'de');
    expect(line).toContain('Oktober 2026');
    expect(line).toContain('274 €');
    expect(formatDay('2026-10-16', 'de-DE')).toBe('16. Okt.');
  });
});
