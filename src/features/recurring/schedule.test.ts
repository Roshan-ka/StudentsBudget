import { describe, expect, it } from 'vitest';
import type { Entry, Schedule } from '@/db/types';
import type { IsoDate } from '@/lib/dates';
import {
  describeTiming,
  duePeriods,
  firstAddedOn,
  firstOccurrence,
  holdsAutomaticEntry,
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

type TypedEntry = Exclude<Entry, { type: 'transfer' }>;

/** An entry a schedule posted: an expense in rent's category, unless said otherwise. */
function automatic(date: IsoDate, overrides: Partial<Pick<TypedEntry, 'categoryId' | 'type'>> = {}): TypedEntry {
  return {
    id: `rec:s1:${date}`,
    type: 'expense',
    date,
    accountId: 'a1',
    amountMinor: 40000,
    eurMinor: 40000,
    categoryId: 'rent',
    note: 'Rent',
    createdAt: `${date}T08:00:00.000Z`,
    recurring: { scheduleId: 's1' },
    ...overrides,
  };
}

/** The same entry logged by hand: no schedule posted it. */
const byHand = (date: IsoDate): Entry => ({ ...automatic(date), recurring: undefined });

const RENT = { type: 'expense', categoryId: 'rent' } as const;

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

describe('firstOccurrence', () => {
  it('is next month for a monthly day 1 that starts after the 1st', () => {
    expect(firstOccurrence({ frequency: 'monthly', day: 1 }, '2026-11-02')).toBe('2026-12-01');
    expect(firstOccurrence({ frequency: 'monthly', day: 1 }, '2026-12-31')).toBe('2027-01-01');
  });

  it('is the start itself when an occurrence falls on it', () => {
    expect(firstOccurrence({ frequency: 'monthly', day: 1 }, '2026-11-01')).toBe('2026-11-01');
    expect(firstOccurrence({ frequency: 'monthly', day: 15 }, '2026-11-15')).toBe('2026-11-15');
    expect(firstOccurrence({ frequency: 'weekly', day: 5 }, '2026-10-16')).toBe('2026-10-16');
  });

  it('clips day 31 to the last day of a shorter month, February included', () => {
    expect(firstOccurrence({ frequency: 'monthly', day: 31 }, '2026-11-02')).toBe('2026-11-30');
    expect(firstOccurrence({ frequency: 'monthly', day: 31 }, '2027-02-10')).toBe('2027-02-28');
    expect(firstOccurrence({ frequency: 'monthly', day: 31 }, '2028-02-10')).toBe('2028-02-29');
    expect(firstOccurrence({ frequency: 'monthly', day: 31 }, '2027-01-31')).toBe('2027-01-31');
  });

  it('is this week or next for a weekly day', () => {
    // Saturday 17 October 2026: Friday has passed, Sunday has not.
    expect(firstOccurrence({ frequency: 'weekly', day: 5 }, '2026-10-17')).toBe('2026-10-23');
    expect(firstOccurrence({ frequency: 'weekly', day: 7 }, '2026-10-17')).toBe('2026-10-18');
    expect(firstOccurrence({ frequency: 'weekly', day: 1 }, '2026-12-29')).toBe('2027-01-04');
  });
});

describe('firstAddedOn', () => {
  const rent = { frequency: 'monthly', day: 1 } as const;

  it('starts a new or turned-on line tomorrow: set up on the 1st, the first rent comes next month', () => {
    expect(firstAddedOn(rent, undefined, '2026-11-01')).toBe('2026-12-01');
    expect(firstAddedOn(rent, undefined, '2026-10-31')).toBe('2026-11-01');
  });

  it('follows a stored schedule that has not started yet, such as one resumed today', () => {
    const resumed = resumeSchedule(monthly({ postedThrough: '2026-10-31', paused: true }), '2026-11-02');
    expect(firstAddedOn(rent, resumed, '2026-11-02')).toBe('2026-12-01');
    // A later watermark stays: day 25 was posted for November before the pause.
    const posted = resumeSchedule(monthly({ day: 25, postedThrough: '2026-11-30', paused: true }), '2026-11-12');
    expect(firstAddedOn({ frequency: 'monthly', day: 25 }, posted, '2026-11-12')).toBe('2026-12-25');
  });

  it('starts a repaired line again from tomorrow', () => {
    const orphan = monthly({ startOn: '2026-10-17', postedThrough: '2026-10-31' });
    expect(firstAddedOn(rent, orphan, '2026-11-05', true)).toBe('2026-12-01');
  });

  it('is null once the stored schedule has started, and while it is paused', () => {
    expect(firstAddedOn(rent, monthly(), '2026-10-17')).toBeNull();
    expect(firstAddedOn(rent, monthly(), '2026-11-20')).toBeNull();
    expect(firstAddedOn(rent, monthly({ startOn: '2026-11-03', paused: true }), '2026-11-02')).toBeNull();
  });

  describe('with the entries the line already has', () => {
    const day15 = { frequency: 'monthly', day: 15 } as const;
    const fridays = { frequency: 'weekly', day: 5 } as const;
    const line = (...entries: Entry[]) => ({ ...RENT, entries });

    it('passes over a month the poster would skip: rent posted on 1 Nov, turned off and on with day 15 on 10 Nov', () => {
      // The new schedule is due on 15 Nov, but November already holds an automatic rent entry, so the poster skips it.
      expect(firstAddedOn(day15, undefined, '2026-11-10')).toBe('2026-11-15');
      expect(firstAddedOn(day15, undefined, '2026-11-10', false, line(automatic('2026-11-01')))).toBe('2026-12-15');
    });

    it('passes over a week the poster would skip: Mondays posted through 16 Nov, Fridays from Tue 17 Nov', () => {
      expect(firstAddedOn(fridays, undefined, '2026-11-17')).toBe('2026-11-20');
      expect(firstAddedOn(fridays, undefined, '2026-11-17', false, line(automatic('2026-11-16')))).toBe('2026-11-27');
    });

    it('passes over several periods in a row, and stops at the first without an entry', () => {
      const entries = [automatic('2026-11-01'), automatic('2026-12-01'), automatic('2027-02-01')];
      expect(firstAddedOn(day15, undefined, '2026-11-10', false, line(...entries))).toBe('2027-01-15');
    });

    it('looks at the periods of the new timing: rent posted monthly on 1 Nov, then turned off and on weekly on Fridays', () => {
      const posted = line(automatic('2026-11-01'));

      // Monday 9 Nov: the new schedule starts on the 10th, and the first Friday is the 13th. The entry of 1 Nov is
      // in the week before Mon 2 Nov, so it does not hold a week (and the whole month does not count as held).
      expect(firstAddedOn(fridays, undefined, '2026-11-09', false, posted)).toBe('2026-11-13');
      expect(firstAddedOn(fridays, undefined, '2026-11-09')).toBe('2026-11-13');
      // Even a day after the entry: Friday 6 Nov is in the week of Mon 2 Nov to Sun 8 Nov, which holds nothing.
      expect(firstAddedOn(fridays, undefined, '2026-11-02', false, posted)).toBe('2026-11-06');
    });

    it('looks at the periods of the new timing: Fridays posted through early November, then monthly on day 15', () => {
      const posted = line(automatic('2026-10-30'), automatic('2026-11-06'));

      // Tuesday 10 Nov: day 15 would be due on the 15th, but November already holds an automatic entry (6 Nov).
      expect(firstAddedOn(day15, undefined, '2026-11-10', false, posted)).toBe('2026-12-15');
      expect(firstAddedOn(day15, undefined, '2026-11-10')).toBe('2026-11-15');
      // With the last one in October, November holds none yet.
      expect(firstAddedOn(day15, undefined, '2026-11-02', false, line(automatic('2026-10-30')))).toBe('2026-11-15');
    });

    it('counts an entry on any day of the period, and in a later period than the first occurrence', () => {
      // Posted on the 30th (moved there by hand, say): the same month.
      expect(firstAddedOn(day15, undefined, '2026-11-10', false, line(automatic('2026-11-30')))).toBe('2026-12-15');
      // Sunday 22 Nov is the last day of the week that holds Friday 20 Nov.
      expect(firstAddedOn(fridays, undefined, '2026-11-17', false, line(automatic('2026-11-22')))).toBe('2026-11-27');
    });

    it('is not moved by entries from before the first period, or by ones the poster would not count', () => {
      const first = firstAddedOn(day15, undefined, '2026-11-10');
      const others = [
        automatic('2026-10-01'),
        byHand('2026-11-01'),
        automatic('2026-11-01', { categoryId: 'phone' }),
        automatic('2026-11-01', { type: 'income' }),
        { ...automatic('2026-11-01'), type: 'transfer', toAccountId: 'a2', toAmountMinor: 40000 } as Entry,
      ];
      expect(firstAddedOn(day15, undefined, '2026-11-10', false, line(...others))).toBe(first);
    });

    it('follows a stored schedule that has not started yet, and a repaired line', () => {
      const resumed = resumeSchedule(monthly({ postedThrough: '2026-10-31', paused: true }), '2026-11-02');
      // Resumed on 2 Nov, the rent comes on 1 Dec, unless December holds one already.
      expect(firstAddedOn(rent, resumed, '2026-11-02', false, line(automatic('2026-11-01')))).toBe('2026-12-01');
      expect(firstAddedOn(rent, resumed, '2026-11-02', false, line(automatic('2026-12-01')))).toBe('2027-01-01');
      const orphan = monthly({ startOn: '2026-10-17', postedThrough: '2026-10-31' });
      expect(firstAddedOn(rent, orphan, '2026-11-05', true, line(automatic('2026-12-01')))).toBe('2027-01-01');
    });

    it('stays null once the schedule has started, whatever it holds', () => {
      expect(firstAddedOn(rent, monthly(), '2026-11-20', false, line(automatic('2026-11-01')))).toBeNull();
    });
  });
});

describe('holdsAutomaticEntry', () => {
  const november = { start: '2026-11-01', end: '2026-11-30' } as const;

  it('is true for an automatic entry of the line dated in the period, edges included', () => {
    expect(holdsAutomaticEntry([automatic('2026-11-15')], november, RENT)).toBe(true);
    expect(holdsAutomaticEntry([automatic('2026-11-01')], november, RENT)).toBe(true);
    expect(holdsAutomaticEntry([automatic('2026-11-30')], november, RENT)).toBe(true);
  });

  it('is false outside the period', () => {
    expect(holdsAutomaticEntry([automatic('2026-10-31'), automatic('2026-12-01')], november, RENT)).toBe(false);
    expect(holdsAutomaticEntry([], november, RENT)).toBe(false);
  });

  it('is false for an entry by hand, of another category or type, or a transfer', () => {
    const transfer = { ...automatic('2026-11-15'), type: 'transfer', toAccountId: 'a2', toAmountMinor: 1 } as Entry;
    expect(holdsAutomaticEntry([byHand('2026-11-15')], november, RENT)).toBe(false);
    expect(holdsAutomaticEntry([automatic('2026-11-15', { categoryId: 'phone' })], november, RENT)).toBe(false);
    expect(holdsAutomaticEntry([automatic('2026-11-15', { type: 'income' })], november, RENT)).toBe(false);
    expect(holdsAutomaticEntry([transfer], november, RENT)).toBe(false);
  });

  it('is true for the line with that type and category among other entries', () => {
    const entries = [automatic('2026-11-15', { categoryId: 'phone' }), automatic('2026-11-02')];
    expect(holdsAutomaticEntry(entries, november, RENT)).toBe(true);
    expect(holdsAutomaticEntry(entries, november, { type: 'income', categoryId: 'rent' })).toBe(false);
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
