import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  formatDate,
  formatDateTime,
  isSunday,
  monthOf,
  monthsBetween,
  previousMonthTail,
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

describe('formatDate', () => {
  it('shows an ISO date as DD-MM-YYYY', () => {
    expect(formatDate('2026-10-19')).toBe('19-10-2026');
    expect(formatDate('2026-01-05')).toBe('05-01-2026');
    expect(formatDate('2027-12-31')).toBe('31-12-2027');
  });
});

describe('formatDateTime', () => {
  it('shows an ISO timestamp as DD-MM-YYYY, HH:mm in local time', () => {
    expect(formatDateTime('2026-10-19T12:05:00+02:00')).toBe('19-10-2026, 12:05');
    // TZ is Europe/Berlin, UTC+2 until 25 Oct: 23:30 UTC is already the next day.
    expect(formatDateTime('2026-10-19T23:30:00.000Z')).toBe('20-10-2026, 01:30');
    // And UTC+1 after the clocks go back.
    expect(formatDateTime('2026-11-02T09:07:00.000Z')).toBe('02-11-2026, 10:07');
  });

  it('gives back text that is not a timestamp', () => {
    expect(formatDateTime('yesterday')).toBe('yesterday');
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

describe('isSunday', () => {
  it('is true on a Sunday only', () => {
    expect(isSunday('2026-10-18')).toBe(true);
    expect(isSunday('2026-11-01')).toBe(true);
    expect(isSunday('2026-10-17')).toBe(false);
    expect(isSunday('2026-10-19')).toBe(false);
    expect(isSunday('2026-10-16')).toBe(false);
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

describe('previousMonthTail', () => {
  it('on a Sunday whose week starts in the previous month, is the part of that week in the previous month', () => {
    // Sun 1 Nov 2026: the week is Mon 26 Oct - Sun 1 Nov.
    expect(previousMonthTail('2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-10-31' });
    // Sun 6 Dec 2026: only Mon 30 Nov is left of the week before the month.
    expect(previousMonthTail('2026-12-06')).toEqual({ start: '2026-11-30', end: '2026-11-30' });
  });

  it('works across a year end', () => {
    // Sun 3 Jan 2027: the week is Mon 28 Dec - Sun 3 Jan.
    expect(previousMonthTail('2027-01-03')).toEqual({ start: '2026-12-28', end: '2026-12-31' });
  });

  it('works across a short month and a leap day', () => {
    // Sun 1 Mar 2026, Sun 1 Mar 2020 (leap year), Sun 5 Apr 2026.
    expect(previousMonthTail('2026-03-01')).toEqual({ start: '2026-02-23', end: '2026-02-28' });
    expect(previousMonthTail('2020-03-01')).toEqual({ start: '2020-02-24', end: '2020-02-29' });
    expect(previousMonthTail('2026-04-05')).toEqual({ start: '2026-03-30', end: '2026-03-31' });
  });

  it('is null on a Sunday whose week starts in its own month', () => {
    // Sun 18 Oct and Sun 7 Feb 2027 (the week starts on the 1st) and Sun 25 Oct.
    expect(previousMonthTail('2026-10-18')).toBeNull();
    expect(previousMonthTail('2027-02-07')).toBeNull();
    expect(previousMonthTail('2026-10-25')).toBeNull();
  });

  it('is null on any day that is not a Sunday', () => {
    // Mon 2 Nov to Sat 7 Nov: the same week as a Sunday that has a tail, and the days of the first week of a month.
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']) {
      expect(previousMonthTail(day)).toBeNull();
    }
    // Sat 31 Oct: the last day of the month, in a week that has no tail of its own.
    expect(previousMonthTail('2026-10-31')).toBeNull();
    expect(previousMonthTail('2027-01-01')).toBeNull();
  });

  it('is the days that weekInMonth leaves out of a Sunday check-in', () => {
    const sunday = '2026-11-01';
    const tail = previousMonthTail(sunday);
    expect(tail).not.toBeNull();
    // The week the tail belongs to ends on the Sunday: the tail ends the day before the Sunday's month began,
    // and the Sunday's own part starts right after it.
    expect(addDays(tail!.end, 1)).toBe(weekInMonth(sunday).start);
    expect(weekInMonth(tail!.end)).toEqual(tail);
  });
});
