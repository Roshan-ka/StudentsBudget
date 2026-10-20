import { describe, expect, it } from 'vitest';
import { CITIES } from '@/data/cities';
import type { Profile } from '@/db/types';
import {
  SEMESTER_FEE_NAME,
  monthLabel,
  periodLabel,
  profileProblems,
  semesterFeeDue,
  semesterFeeOffer,
  semesterOn,
  semesterWeeksOf,
  termName,
  toProfile,
  type ProfileDraft,
} from './profile';

const BLANK: ProfileDraft = { name: '', university: '', semesterStart: '', semesterEnd: '' };

const draft = (change: Partial<ProfileDraft>): ProfileDraft => ({ ...BLANK, ...change });
const dates = (semesterStart: Profile['semesterStart'], semesterEnd: Profile['semesterEnd']) => ({
  semesterStart,
  semesterEnd,
});

describe('semesterWeeksOf', () => {
  it('is null without a profile or with a date missing', () => {
    expect(semesterWeeksOf(undefined)).toBeNull();
    expect(semesterWeeksOf(null)).toBeNull();
    expect(semesterWeeksOf(dates('', ''))).toBeNull();
    expect(semesterWeeksOf(dates('2026-10-01', ''))).toBeNull();
    expect(semesterWeeksOf(dates('', '2027-03-31'))).toBeNull();
  });

  it('is null when the end is not after the start', () => {
    expect(semesterWeeksOf(dates('2027-03-31', '2026-10-01'))).toBeNull();
    expect(semesterWeeksOf(dates('2026-10-01', '2026-10-01'))).toBeNull();
  });

  it('is null for dates the form would not save: not a real day, or more than a year', () => {
    expect(semesterWeeksOf(dates('202620-10-01', '2027-03-31'))).toBeNull();
    expect(semesterWeeksOf(dates('2026-10-01', '2027-02-30'))).toBeNull();
    expect(semesterWeeksOf(dates('2026-10-01', '2029-09-30'))).toBeNull();
  });

  it('counts a winter and a summer semester at Universität Regensburg as 26 weeks', () => {
    // 182 days, and 183 days: both round to 26 weeks.
    expect(semesterWeeksOf(dates('2026-10-01', '2027-03-31'))).toBe(26);
    expect(semesterWeeksOf(dates('2027-04-01', '2027-09-30'))).toBe(26);
    // Through 29 February: 183 days.
    expect(semesterWeeksOf(dates('2027-10-01', '2028-03-31'))).toBe(26);
  });

  it('counts the OTH semesters, which split the year in mid-March', () => {
    // 165 days, and 200 days.
    expect(semesterWeeksOf(dates('2026-10-01', '2027-03-14'))).toBe(24);
    expect(semesterWeeksOf(dates('2027-03-15', '2027-09-30'))).toBe(29);
  });

  it('counts dates the person typed in, like a lecture period', () => {
    // 12 Oct 2026 to 5 Feb 2027 is 117 days.
    expect(semesterWeeksOf(dates('2026-10-12', '2027-02-05'))).toBe(17);
    // A semester of a few days is still at least one week.
    expect(semesterWeeksOf(dates('2026-10-01', '2026-10-02'))).toBe(1);
  });
});

describe('semesterOn', () => {
  it('finds the Universität Regensburg semester a day falls in', () => {
    const winter = { term: 'winter', start: '2026-10-01', end: '2027-03-31' };
    expect(semesterOn('ur', '2026-10-01')).toMatchObject(winter);
    expect(semesterOn('ur', '2026-10-20')).toMatchObject(winter);
    expect(semesterOn('ur', '2027-01-15')).toMatchObject(winter);
    expect(semesterOn('ur', '2027-03-31')).toMatchObject(winter);
    expect(semesterOn('ur', '2027-04-01')).toMatchObject({ term: 'summer', start: '2027-04-01', end: '2027-09-30' });
    expect(semesterOn('ur', '2027-09-30')).toMatchObject({ term: 'summer', start: '2027-04-01', end: '2027-09-30' });
  });

  it('finds the OTH Regensburg semester a day falls in', () => {
    expect(semesterOn('oth', '2026-10-20')).toMatchObject({ term: 'winter', start: '2026-10-01', end: '2027-03-14' });
    expect(semesterOn('oth', '2027-03-14')).toMatchObject({ term: 'winter', start: '2026-10-01', end: '2027-03-14' });
    expect(semesterOn('oth', '2027-03-15')).toMatchObject({ term: 'summer', start: '2027-03-15', end: '2027-09-30' });
  });

  it('carries the source of the period it used', () => {
    const { period } = semesterOn('oth', '2026-10-20');
    expect(period).toMatchObject({ university: 'oth', term: 'winter' });
    expect(period.url).toMatch(/^https:\/\//);
  });
});

describe('labels', () => {
  it('names a period by its days and a month by its name', () => {
    expect(periodLabel(semesterOn('ur', '2026-10-20').period)).toBe('1 Oct – 31 Mar');
    expect(periodLabel(semesterOn('oth', '2027-05-01').period)).toMatch(/^15 Mar – 30 Sept?$/);
    expect(termName('winter')).toBe('Winter semester');
    expect(termName('summer')).toBe('Summer semester');
    expect(monthLabel('2027-03')).toBe('March 2027');
  });
});

describe('profileProblems', () => {
  it('has nothing to say about an empty profile or a full one', () => {
    expect(profileProblems(BLANK)).toEqual([]);
    expect(
      profileProblems(draft({ name: 'Roshan', university: 'ur', semesterStart: '2026-10-01', semesterEnd: '2027-03-31' })),
    ).toEqual([]);
  });

  it('asks for both semester dates or neither, at the empty field', () => {
    const message = 'Add both semester dates, or leave both empty.';
    expect(profileProblems(draft({ semesterStart: '2026-10-01' }))).toEqual([{ field: 'semesterEnd', message }]);
    expect(profileProblems(draft({ semesterEnd: '2027-03-31' }))).toEqual([{ field: 'semesterStart', message }]);
  });

  it('asks for an end after the start', () => {
    const later = [{ field: 'semesterEnd', message: 'Pick an end date after the start date.' }];
    expect(profileProblems(draft({ semesterStart: '2027-03-31', semesterEnd: '2026-10-01' }))).toEqual(later);
    expect(profileProblems(draft({ semesterStart: '2026-10-01', semesterEnd: '2026-10-01' }))).toEqual(later);
  });

  it('asks for real days, at the field that has none', () => {
    // A desktop date field takes a six-digit year.
    const message = 'Enter each semester date as a full date.';
    expect(profileProblems(draft({ semesterStart: '202620-10-01', semesterEnd: '2027-03-31' }))).toEqual([
      { field: 'semesterStart', message },
    ]);
    expect(profileProblems(draft({ semesterStart: '2026-10-01', semesterEnd: '2027-02-30' }))).toEqual([
      { field: 'semesterEnd', message },
    ]);
  });

  it('takes a semester of up to a year', () => {
    expect(profileProblems(draft({ semesterStart: '2027-10-01', semesterEnd: '2028-09-30' }))).toEqual([]);
    expect(profileProblems(draft({ semesterStart: '2026-10-01', semesterEnd: '2029-09-30' }))).toEqual([
      { field: 'semesterEnd', message: 'A semester lasts a year at most. Pick an earlier end date.' },
    ]);
  });
});

describe('toProfile', () => {
  it('trims the name and stamps the row', () => {
    const now = new Date('2026-10-20T08:00:00.000Z');
    expect(
      toProfile(draft({ name: '  Roshan ', university: 'oth', semesterStart: '2026-10-01', semesterEnd: '2027-03-14' }), now),
    ).toEqual({
      id: 'current',
      name: 'Roshan',
      university: 'oth',
      semesterStart: '2026-10-01',
      semesterEnd: '2027-03-14',
      updatedAt: '2026-10-20T08:00:00.000Z',
    });
  });
});

describe('semesterFeeDue', () => {
  const TODAY = '2026-10-20';
  const profile = (change: Partial<ProfileDraft>) => toProfile(draft(change), new Date('2026-10-20T08:00:00Z'));

  it('is null without semester dates, or with dates that do not make a semester', () => {
    expect(semesterFeeDue(undefined, TODAY)).toBeNull();
    expect(semesterFeeDue(profile({ university: 'ur' }), TODAY)).toBeNull();
    expect(semesterFeeDue(profile({ university: 'ur', semesterStart: '2026-10-01' }), TODAY)).toBeNull();
    expect(
      semesterFeeDue(profile({ university: 'ur', semesterStart: '2027-03-31', semesterEnd: '2026-10-01' }), TODAY),
    ).toBeNull();
  });

  it('is the month before the next semester starts where no re-registration month is published (UR)', () => {
    const winter = profile({ university: 'ur', semesterStart: '2026-10-01', semesterEnd: '2027-03-31' });
    expect(semesterFeeDue(winter, TODAY)).toBe('2027-03');
    // Lecture dates instead of the semester: the next semester still starts on 1 April.
    const lectures = profile({ university: 'ur', semesterStart: '2026-10-12', semesterEnd: '2027-02-05' });
    expect(semesterFeeDue(lectures, TODAY)).toBe('2027-03');
  });

  it('is the re-registration month where semesters.ts holds one (OTH, summer 2027)', () => {
    const winter = profile({ university: 'oth', semesterStart: '2026-10-01', semesterEnd: '2027-03-14' });
    // Re-registration opens on 7 January 2027, well before the semester starts on 15 March.
    expect(semesterFeeDue(winter, TODAY)).toBe('2027-01');
  });

  it('takes the day after the saved end as the next start at another university', () => {
    const other = profile({ university: 'other', semesterStart: '2026-10-01', semesterEnd: '2027-01-31' });
    expect(semesterFeeDue(other, TODAY)).toBe('2027-01');
    const unset = profile({ semesterStart: '2026-10-01', semesterEnd: '2027-01-31' });
    expect(semesterFeeDue(unset, TODAY)).toBe('2027-01');
  });

  it('moves on to a semester whose fee is still ahead at UR and OTH', () => {
    // Saved last summer: the semester after it has begun, so the one after that is next.
    const lastSummer = profile({ university: 'ur', semesterStart: '2026-04-01', semesterEnd: '2026-09-30' });
    expect(semesterFeeDue(lastSummer, TODAY)).toBe('2027-03');
    // In March the summer fee is due this month, too late to set money aside: the winter one is next.
    const winter = profile({ university: 'ur', semesterStart: '2026-10-01', semesterEnd: '2027-03-31' });
    expect(semesterFeeDue(winter, '2027-03-10')).toBe('2027-09');
  });

  it('offers nothing at another university once the saved semester is too old', () => {
    const lastSummer = profile({ university: 'other', semesterStart: '2026-04-01', semesterEnd: '2026-09-30' });
    expect(semesterFeeDue(lastSummer, TODAY)).toBeNull();
    // The next one would start on 1 November, so its fee is due this month: too late to set money aside.
    const endsThisMonth = profile({ university: 'other', semesterStart: '2026-05-01', semesterEnd: '2026-10-31' });
    expect(semesterFeeDue(endsThisMonth, TODAY)).toBeNull();
  });

  it('wraps into the next year at another university', () => {
    const autumn = profile({ university: 'other', semesterStart: '2026-09-01', semesterEnd: '2026-12-31' });
    expect(semesterFeeDue(autumn, TODAY)).toBe('2026-12');
  });

  it('is the fee for the saved semester itself when that starts later', () => {
    // Set up in August, before the first semester: its fee is due in September.
    const firstWinter = profile({ university: 'ur', semesterStart: '2026-10-01', semesterEnd: '2027-03-31' });
    expect(semesterFeeDue(firstWinter, '2026-08-10')).toBe('2026-09');
    const othSummer = profile({ university: 'oth', semesterStart: '2027-03-15', semesterEnd: '2027-09-30' });
    expect(semesterFeeDue(othSummer, '2026-12-10')).toBe('2027-01');
    const other = profile({ university: 'other', semesterStart: '2026-12-01', semesterEnd: '2027-03-31' });
    expect(semesterFeeDue(other, TODAY)).toBe('2026-11');
  });

  it('moves on at OTH once re-registration for summer has come', () => {
    const winter = profile({ university: 'oth', semesterStart: '2026-10-01', semesterEnd: '2027-03-14' });
    // January is this month: the winter 2027/28 fee is next, with no re-registration month published yet.
    expect(semesterFeeDue(winter, '2027-01-10')).toBe('2027-09');
    expect(semesterFeeDue(winter, '2027-02-10')).toBe('2027-09');
  });

  it('is null for dates the form would not save', () => {
    const typo = profile({ university: 'other', semesterStart: '202620-10-01', semesterEnd: '2027-03-31' });
    expect(semesterFeeDue(typo, TODAY)).toBeNull();
  });
});

describe('semesterFeeOffer', () => {
  const TODAY = '2026-10-20';
  const winter = toProfile(
    draft({ university: 'ur', semesterStart: '2026-10-01', semesterEnd: '2027-03-31' }),
    new Date('2026-10-20T08:00:00Z'),
  );

  const profile = (change: Partial<ProfileDraft>) => toProfile(draft(change), new Date('2026-10-20T08:00:00Z'));
  const minors = (offer: ReturnType<typeof semesterFeeOffer>) => offer?.parts.map((p) => p.minor);

  it('fills the amount from the sourced parts of the fee (UR, summer 2027: €87 + €128)', () => {
    const offer = semesterFeeOffer(winter, TODAY, []);
    expect(offer?.row).toEqual({ name: SEMESTER_FEE_NAME, amountMinor: 21_500, dueMonth: '2027-03' });
    expect(minors(offer)).toEqual([8700, 12800]);
    // UR has not published the re-registration month: the due month is the month before the semester.
    expect(offer?.reRegistration).toBeNull();
    expect(SEMESTER_FEE_NAME).toBe('Semester fee');
  });

  it('takes the due month from the sourced re-registration month (OTH, summer 2027)', () => {
    const oth = profile({ university: 'oth', semesterStart: '2026-10-01', semesterEnd: '2027-03-14' });
    const offer = semesterFeeOffer(oth, TODAY, []);
    expect(offer?.row).toEqual({ name: SEMESTER_FEE_NAME, amountMinor: 21_500, dueMonth: '2027-01' });
    expect(offer?.reRegistration?.month).toBe('2027-01');
  });

  it('fills the winter 2027/28 fee, €92 + €130', () => {
    const summer = profile({ university: 'ur', semesterStart: '2027-04-01', semesterEnd: '2027-09-30' });
    const offer = semesterFeeOffer(summer, '2027-05-03', []);
    expect(offer?.row).toEqual({ name: SEMESTER_FEE_NAME, amountMinor: 22_200, dueMonth: '2027-09' });
    expect(minors(offer)).toEqual([9200, 13000]);
  });

  it('leaves the amount empty where no source states the fee', () => {
    // Summer 2028: no statute yet.
    const winter2728 = profile({ university: 'ur', semesterStart: '2027-10-01', semesterEnd: '2028-03-31' });
    const later = semesterFeeOffer(winter2728, '2027-11-02', []);
    expect(later?.row).toEqual({ name: SEMESTER_FEE_NAME, amountMinor: 0, dueMonth: '2028-03' });
    expect(later?.parts).toEqual([]);
    // Another university: nothing is known about its fee.
    const other = profile({ university: 'other', semesterStart: '2026-10-01', semesterEnd: '2027-01-31' });
    expect(semesterFeeOffer(other, TODAY, [])?.row).toEqual({ name: SEMESTER_FEE_NAME, amountMinor: 0, dueMonth: '2027-01' });
  });

  it('keeps every semester fee in semesters.ts, not in cities.ts', () => {
    // Ruling R13: a fee changes every semester, so it is stored per university and semester in semesters.ts. A
    // semester fee added to cities.ts would never reach the offer: move it to SEMESTER_FEES instead.
    const fees = CITIES.regensburg.prices.filter((p) => /semester/i.test(p.label));
    expect(fees).toEqual([]);
  });

  it('offers nothing without semester dates', () => {
    expect(semesterFeeOffer(undefined, TODAY, [])).toBeNull();
  });

  it('offers nothing while a semester fee row is still ahead, whatever its month', () => {
    expect(semesterFeeOffer(winter, TODAY, [{ name: ' semester FEE ', dueMonth: '2027-03' }])).toBeNull();
    // OTH's next fee is due in January; the plan's own March row is that fee already.
    const oth = profile({ university: 'oth', semesterStart: '2026-10-01', semesterEnd: '2027-03-14' });
    expect(semesterFeeOffer(oth, TODAY, [{ name: 'Semester fee', dueMonth: '2027-03' }])).toBeNull();
  });

  it('offers the next fee once the planned one is due, and ignores rows with other names', () => {
    const row = { name: SEMESTER_FEE_NAME, amountMinor: 21_500, dueMonth: '2027-03' };
    expect(semesterFeeOffer(winter, TODAY, [{ name: 'Semester fee', dueMonth: '2026-09' }])?.row).toEqual(row);
    expect(semesterFeeOffer(winter, TODAY, [{ name: 'Semester fee', dueMonth: '2026-10' }])?.row).toEqual(row);
    expect(semesterFeeOffer(winter, TODAY, [{ name: 'Semester fee', dueMonth: '' }])?.row).toEqual(row);
    expect(semesterFeeOffer(winter, TODAY, [{ name: 'Laptop', dueMonth: '2027-03' }])?.row).toEqual(row);
  });
});
