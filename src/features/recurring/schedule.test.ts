import { describe, expect, it } from 'vitest';
import type { Schedule } from '@/db/types';
import {
  describeTiming,
  duePeriods,
  isUsableSchedule,
  monthlyEquivalent,
  newSchedule,
  occurrenceIn,
  perOccurrence,
  periodOf,
  resumeSchedule,
} from './schedule';

/** Rent on the 1st, set up on Friday 16 October 2026: nothing before the 17th. */
function monthly(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 's1',
    frequency: 'monthly',
    day: 1,
    accountId: 'a1',
    amountMinor: 40000,
    startOn: '2026-10-17',
    postedThrough: '2026-10-16',
    ...overrides,
  };
}

function weekly(overrides: Partial<Schedule> = {}): Schedule {
  return monthly({ frequency: 'weekly', day: 5, amountMinor: 2500, ...overrides });
}

describe('periodOf', () => {
  it('is the calendar month for a monthly schedule', () => {
    expect(periodOf(monthly(), '2026-11-17')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodOf(monthly(), '2028-02-01')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('is the Monday to Sunday week for a weekly schedule', () => {
    // Friday 1 January 2027 sits in the week that starts on Monday 28 December 2026.
    expect(periodOf(weekly(), '2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
    expect(periodOf(weekly(), '2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(periodOf(weekly(), '2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });
});

describe('occurrenceIn', () => {
  it('uses the day of the month, clipped to the last day', () => {
    expect(occurrenceIn(monthly({ day: 15 }), '2026-11-01')).toBe('2026-11-15');
    expect(occurrenceIn(monthly({ day: 31 }), '2026-11-01')).toBe('2026-11-30');
    expect(occurrenceIn(monthly({ day: 31 }), '2027-02-01')).toBe('2027-02-28');
    expect(occurrenceIn(monthly({ day: 31 }), '2028-02-01')).toBe('2028-02-29');
    expect(occurrenceIn(monthly({ day: 31 }), '2027-01-01')).toBe('2027-01-31');
  });

  it('counts weekly days from Monday', () => {
    expect(occurrenceIn(weekly({ day: 1 }), '2026-12-28')).toBe('2026-12-28');
    expect(occurrenceIn(weekly({ day: 5 }), '2026-12-28')).toBe('2027-01-01');
    expect(occurrenceIn(weekly({ day: 7 }), '2026-12-28')).toBe('2027-01-03');
  });
});

describe('duePeriods', () => {
  it('posts nothing before startOn: no back-posting for the month setup happened in', () => {
    expect(duePeriods(monthly(), '2026-10-16')).toEqual([]);
    expect(duePeriods(monthly(), '2026-10-31')).toEqual([]);
    expect(duePeriods(monthly(), '2026-11-01')).toEqual(['2026-11-01']);
  });

  it('still posts this month when the day comes after setup', () => {
    expect(duePeriods(monthly({ day: 20 }), '2026-10-19')).toEqual([]);
    expect(duePeriods(monthly({ day: 20 }), '2026-10-20')).toEqual(['2026-10-01']);
  });

  it('catches up every period it missed, oldest first', () => {
    expect(duePeriods(monthly(), '2027-01-15')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });

  it('posts nothing at or below the watermark', () => {
    expect(duePeriods(monthly({ postedThrough: '2026-12-31' }), '2027-01-15')).toEqual(['2027-01-01']);
    expect(duePeriods(monthly({ postedThrough: '2027-01-31' }), '2027-01-15')).toEqual([]);
  });

  it('clips day 31 to 28 February 2027 and 29 February 2028', () => {
    expect(duePeriods(monthly({ day: 31, postedThrough: '2027-01-31' }), '2027-02-27')).toEqual([]);
    expect(duePeriods(monthly({ day: 31, postedThrough: '2027-01-31' }), '2027-02-28')).toEqual(['2027-02-01']);
    expect(duePeriods(monthly({ day: 31, postedThrough: '2028-01-31' }), '2028-02-28')).toEqual([]);
    expect(duePeriods(monthly({ day: 31, postedThrough: '2028-01-31' }), '2028-02-29')).toEqual(['2028-02-01']);
  });

  it('runs weekly across the 2026/2027 year end', () => {
    const s = weekly({ startOn: '2026-12-21', postedThrough: '2026-12-20' });
    // Fridays: 25 December, 1 January, 8 January.
    expect(duePeriods(s, '2027-01-09')).toEqual(['2026-12-21', '2026-12-28', '2027-01-04']);
    expect(duePeriods(s, '2026-12-31')).toEqual(['2026-12-21']);
    expect(duePeriods({ ...s, postedThrough: '2026-12-27' }, '2027-01-01')).toEqual(['2026-12-28']);
  });

  it('does not post twice when the day changes mid-month', () => {
    // Rent went out on 1 November, which handled November.
    const handled = monthly({ postedThrough: '2026-11-30' });
    const moved = { ...handled, day: 3 };
    expect(duePeriods(moved, '2026-11-03')).toEqual([]);
    expect(duePeriods(moved, '2026-11-30')).toEqual([]);
    expect(duePeriods(moved, '2026-12-02')).toEqual([]);
    expect(duePeriods(moved, '2026-12-03')).toEqual(['2026-12-01']);
  });

  it('posts the month whose new day has passed when that month was not handled yet', () => {
    // On the 15th, handled through October; moved to the 5th on 10 November.
    const s = monthly({ day: 5, postedThrough: '2026-10-31' });
    expect(duePeriods(s, '2026-11-10')).toEqual(['2026-11-01']);
  });

  it('never posts an occurrence on or before the watermark, even after a change of frequency', () => {
    // Monthly handled through 30 November, then switched to weekly on Mondays: Monday 30 November is covered.
    const s = weekly({ day: 1, postedThrough: '2026-11-30' });
    expect(duePeriods(s, '2026-12-06')).toEqual([]);
    expect(duePeriods(s, '2026-12-07')).toEqual(['2026-12-07']);
  });

  it('posts nothing while paused', () => {
    expect(duePeriods(monthly({ paused: true }), '2027-03-01')).toEqual([]);
  });

  it('skips the paused periods after a resume', () => {
    // Posted 1 November, paused on the 10th, resumed on 15 January.
    const paused = monthly({ postedThrough: '2026-11-30', paused: true });
    const resumed = resumeSchedule(paused, '2027-01-15');
    expect(resumed.paused).toBeUndefined();
    expect(resumed).toMatchObject({ startOn: '2027-01-16', postedThrough: '2027-01-15' });
    expect(duePeriods(resumed, '2027-01-31')).toEqual([]);
    expect(duePeriods(resumed, '2027-02-01')).toEqual(['2027-02-01']);
  });

  it('keeps a watermark that is later than the day of the resume', () => {
    // Paused on 10 November after November was posted, resumed on the 12th: November stays handled.
    const resumed = resumeSchedule(monthly({ postedThrough: '2026-11-30', paused: true }), '2026-11-12');
    expect(resumed).toMatchObject({ startOn: '2026-11-13', postedThrough: '2026-11-30' });
    expect(duePeriods(resumed, '2026-11-20')).toEqual([]);
  });
});

describe('newSchedule', () => {
  it('starts tomorrow with the watermark on today, so nothing back-posts', () => {
    const s = newSchedule({ frequency: 'monthly', day: 1, accountId: 'a1', amountMinor: 40000 }, '2026-10-16');
    expect(s).toMatchObject({ startOn: '2026-10-17', postedThrough: '2026-10-16', accountId: 'a1' });
    expect(s.id).toEqual(expect.any(String));
    expect(s.paused).toBeUndefined();
  });
});

describe('monthlyEquivalent', () => {
  it('is the amount itself for a monthly schedule', () => {
    expect(monthlyEquivalent({ frequency: 'monthly', amountMinor: 40000 })).toBe(40000);
  });

  it('is 52 weeks over 12 months for a weekly one, rounded to the cent', () => {
    expect(monthlyEquivalent({ frequency: 'weekly', amountMinor: 2500 })).toBe(10833);
    expect(monthlyEquivalent({ frequency: 'weekly', amountMinor: 1200 })).toBe(5200);
    expect(monthlyEquivalent({ frequency: 'weekly', amountMinor: 3 })).toBe(13);
  });
});

describe('perOccurrence', () => {
  it('turns a monthly euro amount into what each occurrence posts', () => {
    expect(perOccurrence(40000, 'monthly')).toBe(40000);
    expect(perOccurrence(10000, 'weekly')).toBe(2308);
  });

  it('round-trips with monthlyEquivalent for any weekly amount', () => {
    for (const weeklyMinor of [1, 99, 2500, 2308, 5000, 12345, 99999]) {
      const monthlyMinor = monthlyEquivalent({ frequency: 'weekly', amountMinor: weeklyMinor });
      expect(perOccurrence(monthlyMinor, 'weekly')).toBe(weeklyMinor);
    }
  });
});

describe('describeTiming', () => {
  it('reads like the setup choice', () => {
    expect(describeTiming({ frequency: 'monthly', day: 3 })).toBe('Monthly on day 3');
    expect(describeTiming({ frequency: 'weekly', day: 5 })).toBe('Weekly on Friday');
  });
});

describe('isUsableSchedule', () => {
  it('accepts a sound schedule', () => {
    expect(isUsableSchedule(monthly())).toBe(true);
    expect(isUsableSchedule(weekly({ day: 7 }))).toBe(true);
  });

  it('rejects one that would post nonsense', () => {
    expect(isUsableSchedule(monthly({ day: 0 }))).toBe(false);
    expect(isUsableSchedule(monthly({ day: 32 }))).toBe(false);
    expect(isUsableSchedule(weekly({ day: 8 }))).toBe(false);
    expect(isUsableSchedule(monthly({ day: 1.5 }))).toBe(false);
    expect(isUsableSchedule(monthly({ amountMinor: 0 }))).toBe(false);
    expect(isUsableSchedule(monthly({ amountMinor: Number.NaN }))).toBe(false);
    expect(isUsableSchedule(monthly({ startOn: '' }))).toBe(false);
    expect(isUsableSchedule(monthly({ postedThrough: '2026-02-30' }))).toBe(false);
  });
});
