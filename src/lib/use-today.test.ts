import { describe, expect, it } from 'vitest';
import { msUntilNextMidnight } from './use-today';

const HOUR = 60 * 60 * 1000;

// The tests run in Europe/Berlin (vitest.config.ts), where the clocks go back on 2026-10-25 at 03:00.
describe('msUntilNextMidnight', () => {
  it('counts to the end of the local day', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 16, 12, 0, 0))).toBe(12 * HOUR);
    expect(msUntilNextMidnight(new Date(2026, 9, 18, 23, 59, 59, 500))).toBe(500);
  });

  it('is a whole day at midnight itself', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 16, 0, 0, 0))).toBe(24 * HOUR);
  });

  it('follows the local clock through a clock change', () => {
    // The day the clocks go back has 25 hours; the extra one comes before noon.
    expect(msUntilNextMidnight(new Date(2026, 9, 25, 0, 0, 0))).toBe(25 * HOUR);
    expect(msUntilNextMidnight(new Date(2026, 9, 25, 12, 0, 0))).toBe(12 * HOUR);
    // The day they go forward (2026-03-29) has 23.
    expect(msUntilNextMidnight(new Date(2026, 2, 29, 0, 0, 0))).toBe(23 * HOUR);
  });

  it('crosses a month and a year end', () => {
    expect(msUntilNextMidnight(new Date(2026, 9, 31, 18, 0, 0))).toBe(6 * HOUR);
    expect(msUntilNextMidnight(new Date(2026, 11, 31, 23, 0, 0))).toBe(HOUR);
  });
});
