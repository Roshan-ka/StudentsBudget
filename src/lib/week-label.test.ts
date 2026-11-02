import { describe, expect, it } from 'vitest';
import { weekLabel } from './week-label';

describe('weekLabel', () => {
  it('shows a full Monday-to-Sunday week with the month last', () => {
    expect(weekLabel('2026-10-12', '2026-10-18')).toBe('Mon 12 – Sun 18 Oct');
  });

  it('shows a week cut off at the end of the month', () => {
    expect(weekLabel('2026-10-26', '2026-10-31')).toBe('Mon 26 – Sat 31 Oct');
  });

  it('shows a week cut off at the start of the month', () => {
    expect(weekLabel('2026-10-01', '2026-10-04')).toBe('Thu 1 – Sun 4 Oct');
  });

  it('shows a one-day week as a single day', () => {
    // 1 November 2026 is a Sunday: the week is that day alone.
    expect(weekLabel('2026-11-01', '2026-11-01')).toBe('Sun 1 Nov');
  });
});

describe('weekLabel in another language', () => {
  it('uses the locale’s day and month names, with English unchanged by default', () => {
    expect(weekLabel('2026-10-12', '2026-10-18', 'de-DE')).toBe('Mo., 12. – So., 18. Okt.');
    expect(weekLabel('2026-11-01', '2026-11-01', 'fr-FR')).toBe('dim. 1 nov.');
    expect(weekLabel('2026-10-12', '2026-10-18')).toBe('Mon 12 – Sun 18 Oct');
  });
});
