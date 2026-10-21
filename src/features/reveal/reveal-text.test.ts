import { describe, expect, it } from 'vitest';
import { formatDay, recapLine } from './reveal-text';

describe('formatDay', () => {
  it('gives the day and the short month', () => {
    expect(formatDay('2026-10-16')).toBe('16 Oct');
    expect(formatDay('2026-11-06')).toBe('6 Nov');
  });
});

describe('recapLine', () => {
  it('says what is left over of a month that was planned from its first day, as savings', () => {
    expect(recapLine('2026-11', 1500, '2026-10-16')).toBe('November 2026: €15 left over → savings');
    expect(recapLine('2026-10', 27400, '2026-10-01')).toBe('October 2026: €274 left over → savings');
  });

  it('says plainly and calmly when a month went over its plan, or landed on it', () => {
    expect(recapLine('2026-11', -1200, '2026-10-16')).toBe('November 2026: €12 over plan');
    expect(recapLine('2026-11', 0, '2026-10-16')).toBe('November 2026: right on plan');
  });

  describe('for the month the plan was set up in, when that was not the 1st', () => {
    it('says it was counted from the setup day, and does not call what is left over savings', () => {
      expect(recapLine('2026-10', 27400, '2026-10-16')).toBe('October 2026 (counted from 16 Oct): €274 left over');
    });

    it('says the same for a month over its plan or on it', () => {
      expect(recapLine('2026-10', -6600, '2026-10-16')).toBe('October 2026 (counted from 16 Oct): €66 over plan');
      expect(recapLine('2026-10', 0, '2026-10-16')).toBe('October 2026 (counted from 16 Oct): right on plan');
    });

    it('leaves the months after it as they were', () => {
      expect(recapLine('2026-11', 27400, '2026-10-16')).toBe('November 2026: €274 left over → savings');
      expect(recapLine('2026-09', 27400, '2026-10-16')).toBe('September 2026: €274 left over → savings');
    });
  });
});
