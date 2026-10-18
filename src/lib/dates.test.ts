import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  monthOf,
  monthsBetween,
  shiftMonth,
  todayIso,
  weekInMonth,
} from './dates';

describe('todayIso', () => {
  it('uses local time, never UTC', () => {
    expect(todayIso(new Date(2026, 9, 16, 23, 30))).toBe('2026-10-16');
    expect(todayIso(new Date(2026, 9, 16, 0, 5))).toBe('2026-10-16');
  });

  it('defaults to the current date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('month helpers', () => {
  it('monthOf and firstOfMonth round-trip', () => {
    expect(monthOf('2026-10-16')).toBe('2026-10');
    expect(firstOfMonth('2026-10')).toBe('2026-10-01');
  });

  it('daysInMonth handles leap years', () => {
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2027-02')).toBe(28);
    expect(daysInMonth('2026-10')).toBe(31);
    expect(daysInMonth('2026-11')).toBe(30);
  });

  it('monthsBetween counts b - a across years', () => {
    expect(monthsBetween('2026-10', '2027-03')).toBe(5);
    expect(monthsBetween('2027-03', '2026-10')).toBe(-5);
    expect(monthsBetween('2026-10', '2026-10')).toBe(0);
  });
});

describe('shiftMonth', () => {
  it('moves forward and back across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -10)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });

  it('moves by more than a year, and keeps the month two digits wide', () => {
    expect(shiftMonth('2026-10', 14)).toBe('2027-12');
    expect(shiftMonth('2026-10', -13)).toBe('2025-09');
    expect(shiftMonth('2026-10', 3)).toBe('2027-01');
    expect(shiftMonth('2026-01', 8)).toBe('2026-09');
  });
});

describe('day arithmetic', () => {
  it('addDays moves across month and year ends, forward and back', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-16', 0)).toBe('2026-10-16');
  });

  it('addDays is not shifted by a daylight-saving change', () => {
    // Europe/Berlin switches on 2026-03-29 and 2026-10-25.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('daysBetween is b - a and whole days across a daylight-saving change', () => {
    expect(daysBetween('2026-10-16', '2026-10-18')).toBe(2);
    expect(daysBetween('2026-10-18', '2026-10-16')).toBe(-2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-10-16', '2026-10-16')).toBe(0);
  });
});

describe('weekInMonth', () => {
  it('returns the full Monday-Sunday week inside the month', () => {
    expect(weekInMonth('2026-10-16')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });

  it('clips the end to the last day of the month', () => {
    expect(weekInMonth('2026-10-30')).toEqual({ start: '2026-10-26', end: '2026-10-31' });
  });

  it('clips the start to the first day of the month', () => {
    expect(weekInMonth('2026-11-01')).toEqual({ start: '2026-11-01', end: '2026-11-01' });
    expect(weekInMonth('2026-10-02')).toEqual({ start: '2026-10-01', end: '2026-10-04' });
  });

  it('treats Monday as the first and Sunday as the last day of the week', () => {
    expect(weekInMonth('2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekInMonth('2026-10-18')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
  });
});
