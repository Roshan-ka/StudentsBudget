import { describe, expect, it } from 'vitest';
import { DATE_CHIPS, DATE_PLACEHOLDER, chipDate, dateText, selectedChip } from './date-field-helpers';

describe('DATE_CHIPS', () => {
  it('offers Today first, then Yesterday', () => {
    expect(DATE_CHIPS.map((chip) => chip.label)).toEqual(['Today', 'Yesterday']);
  });
});

describe('chipDate', () => {
  it('gives today for Today and the day before for Yesterday', () => {
    expect(chipDate('today', '2026-10-16')).toBe('2026-10-16');
    expect(chipDate('yesterday', '2026-10-16')).toBe('2026-10-15');
  });

  it('crosses a month and a year end', () => {
    expect(chipDate('yesterday', '2026-11-01')).toBe('2026-10-31');
    expect(chipDate('yesterday', '2027-01-01')).toBe('2026-12-31');
  });

  it('counts calendar days across a clock change', () => {
    // The clocks go back on 2026-10-25 (Europe/Berlin), so that day has 25 hours.
    expect(chipDate('yesterday', '2026-10-26')).toBe('2026-10-25');
    expect(chipDate('yesterday', '2026-10-25')).toBe('2026-10-24');
  });
});

describe('selectedChip', () => {
  it('marks Today for today', () => {
    expect(selectedChip('2026-10-16', '2026-10-16')).toBe('today');
  });

  it('marks Yesterday for the day before', () => {
    expect(selectedChip('2026-10-15', '2026-10-16')).toBe('yesterday');
    expect(selectedChip('2026-10-31', '2026-11-01')).toBe('yesterday');
  });

  it('marks neither for another date, past or future', () => {
    expect(selectedChip('2026-10-14', '2026-10-16')).toBeNull();
    expect(selectedChip('2026-10-17', '2026-10-16')).toBeNull();
    expect(selectedChip('2025-10-16', '2026-10-16')).toBeNull();
  });

  it('marks neither for a cleared field', () => {
    expect(selectedChip('', '2026-10-16')).toBeNull();
  });

  it('follows today: a date picked yesterday becomes Yesterday after midnight', () => {
    expect(selectedChip('2026-10-16', '2026-10-16')).toBe('today');
    expect(selectedChip('2026-10-16', '2026-10-17')).toBe('yesterday');
    expect(selectedChip('2026-10-16', '2026-10-18')).toBeNull();
  });
});

describe('dateText', () => {
  it('shows an ISO date as DD-MM-YYYY', () => {
    expect(dateText('2026-10-16')).toBe('16-10-2026');
    expect(dateText('2027-01-05')).toBe('05-01-2027');
  });

  it('shows the format itself while the field is empty', () => {
    expect(dateText('')).toBe(DATE_PLACEHOLDER);
    expect(DATE_PLACEHOLDER).toBe('DD-MM-YYYY');
  });
});
