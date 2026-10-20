import { parseISO } from 'date-fns';
import { SEMESTER_FEES, SEMESTER_PERIODS, type FeePart, type SemesterFee, type SemesterPeriod } from '@/data/semesters';
import type { OneOff, Profile } from '@/db/types';
import { isIsoDate } from '@/features/recurring/schedule';
import { addDays, daysBetween, firstOfMonth, monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';

export type University = Exclude<Profile['university'], ''>;

/** The universities the form offers, in the order shown. */
export const UNIVERSITIES: readonly { id: University; name: string }[] = [
  { id: 'ur', name: 'Universität Regensburg' },
  { id: 'oth', name: 'OTH Regensburg' },
  { id: 'other', name: 'Other' },
];

/** What the form edits: the profile without its key and time stamp. */
export type ProfileDraft = Pick<Profile, 'name' | 'university' | 'semesterStart' | 'semesterEnd'>;

type SemesterDates = Pick<Profile, 'semesterStart' | 'semesterEnd'>;

/** What stops the profile from being saved, and the date field to fix. */
export type ProfileProblem = { field: keyof SemesterDates; message: string };

/** The longest semester the form takes: a year, so a whole degree's dates are not taken for one semester. */
const MAX_SEMESTER_DAYS = 366;

/** Why the profile cannot be saved yet. Empty when it can: every field is optional, but a semester needs both dates. */
export function profileProblems({ semesterStart, semesterEnd }: SemesterDates): ProfileProblem[] {
  if (semesterStart === '' && semesterEnd === '') return [];
  const both = 'Add both semester dates, or leave both empty.';
  if (semesterStart === '') return [{ field: 'semesterStart', message: both }];
  if (semesterEnd === '') return [{ field: 'semesterEnd', message: both }];
  // A desktop date field takes a year of up to six digits.
  const full = 'Enter each semester date as a full date.';
  if (!isIsoDate(semesterStart)) return [{ field: 'semesterStart', message: full }];
  if (!isIsoDate(semesterEnd)) return [{ field: 'semesterEnd', message: full }];
  // ISO date strings sort chronologically, so plain comparison is enough.
  if (semesterEnd <= semesterStart) return [{ field: 'semesterEnd', message: 'Pick an end date after the start date.' }];
  if (daysBetween(semesterStart, semesterEnd) + 1 > MAX_SEMESTER_DAYS) {
    return [{ field: 'semesterEnd', message: 'A semester lasts a year at most. Pick an earlier end date.' }];
  }
  return [];
}

/** The row to store, stamped `now`. */
export function toProfile(draft: ProfileDraft, now: Date): Profile {
  return {
    id: 'current',
    name: draft.name.trim(),
    university: draft.university,
    semesterStart: draft.semesterStart,
    semesterEnd: draft.semesterEnd,
    updatedAt: now.toISOString(),
  };
}

/**
 * How many weeks the saved semester has: its days, first and last included, over 7, rounded to the nearest week and
 * at least 1. A 1 Oct – 31 Mar winter semester (182 days) and a 1 Apr – 30 Sep summer semester (183) are both 26, the
 * badges' default. That can be one more than the whole Monday–Sunday weeks inside it (25 for winter 2026/27).
 * Null without a profile or without semester dates, and for dates the form would not save (`profileProblems`): a date
 * that is not a real day, an end that is not after the start, or more than a year.
 */
export function semesterWeeksOf(profile: SemesterDates | null | undefined): number | null {
  if (!profile || profile.semesterStart === '' || profileProblems(profile).length > 0) return null;
  const days = daysBetween(profile.semesterStart, profile.semesterEnd) + 1;
  return Math.max(1, Math.round(days / 7));
}

function periodOf(university: SemesterPeriod['university'], term: SemesterPeriod['term']): SemesterPeriod {
  const period = SEMESTER_PERIODS.find((p) => p.university === university && p.term === term);
  if (!period) throw new Error(`StudentsBudget: no ${term} semester for ${university}`);
  return period;
}

/** One semester with its dates, and the sourced period they come from. */
export type Semester = { term: SemesterPeriod['term']; start: IsoDate; end: IsoDate; period: SemesterPeriod };

/** The semester of `university` that `date` falls in. */
export function semesterOn(university: SemesterPeriod['university'], date: IsoDate): Semester {
  const year = Number(date.slice(0, 4));
  const summer = periodOf(university, 'summer');
  const summerStart = `${year}-${summer.starts}`;
  const summerEnd = `${year}-${summer.ends}`;
  if (date >= summerStart && date <= summerEnd) {
    return { term: 'summer', start: summerStart, end: summerEnd, period: summer };
  }
  // The periods leave no gap: before this year's summer semester it is the winter semester that began last
  // autumn, after it the one that begins this autumn.
  const winter = periodOf(university, 'winter');
  const startYear = date < summerStart ? year - 1 : year;
  return { term: 'winter', start: `${startYear}-${winter.starts}`, end: `${startYear + 1}-${winter.ends}`, period: winter };
}

/** The semester of `university` that starts right after `semester`. */
function semesterAfter(university: SemesterPeriod['university'], semester: Semester): Semester {
  return semesterOn(university, addDays(semester.end, 1));
}

/** The month before the one `start` is in. */
const monthBefore = (start: IsoDate): IsoMonth => shiftMonth(monthOf(start), -1);

/** The next semester fee: the month it is due, and what `SEMESTER_FEES` states about that semester, if anything. */
type NextFee = { dueMonth: IsoMonth; fee: SemesterFee | undefined };

/**
 * The next semester fee that is still ahead, due after this month so there is a month to set money aside in (a
 * one-off's due month must be). A fee is due in the semester's re-registration month where `SEMESTER_FEES` states one
 * (ruling R12), else in the month before the semester starts. The saved semester itself comes first, for someone who
 * sets up before it starts. At UR and OTH that is the university's own semester the saved start falls in, so lecture
 * dates work as well, followed by the ones after it until one fits. Elsewhere the saved semester is followed by one
 * that starts the day after its end, and nothing is due when neither fits.
 */
function nextFee(profile: Profile | null | undefined, today: IsoDate): NextFee | null {
  if (!profile || semesterWeeksOf(profile) === null) return null;
  const thisMonth = monthOf(today);
  // 'YYYY-MM' strings sort chronologically.
  const { university, semesterStart, semesterEnd } = profile;
  if (university === 'ur' || university === 'oth') {
    for (let next = semesterOn(university, semesterStart); ; next = semesterAfter(university, next)) {
      const fee = SEMESTER_FEES.find((f) => f.university === university && f.starts === next.start);
      const dueMonth = fee?.reRegistration?.month ?? monthBefore(next.start);
      if (dueMonth > thisMonth) return { dueMonth, fee };
    }
  }
  const start = [semesterStart, addDays(semesterEnd, 1)].find((s) => monthBefore(s) > thisMonth);
  return start === undefined ? null : { dueMonth: monthBefore(start), fee: undefined };
}

/** The month the next semester fee is due (see `nextFee`), or null without a semester in the profile. */
export function semesterFeeDue(profile: Profile | null | undefined, today: IsoDate): IsoMonth | null {
  return nextFee(profile, today)?.dueMonth ?? null;
}

export const SEMESTER_FEE_NAME = 'Semester fee';

/** What the one-off costs step offers, and where its numbers come from. */
export type SemesterFeeOffer = {
  /** The one-off row one tap adds. */
  row: Pick<OneOff, 'name' | 'amountMinor' | 'dueMonth'>;
  /** The sourced parts the amount adds up; none when no page states the fee, and the amount is left empty (0). */
  parts: FeePart[];
  /** The stated re-registration month the row is due in, or null when it is the month before the semester. */
  reRegistration: NonNullable<SemesterFee['reRegistration']> | null;
};

/**
 * The "Semester fee" row the one-off costs step offers, due as `semesterFeeDue` says. Its amount is the sum of the
 * parts `SEMESTER_FEES` states for that university and semester (ruling R13), or empty (0) when no page states the
 * fee: it is never guessed. Null without a due month, or while a "Semester fee" row is still ahead (due after this
 * month), whatever its month: that row is the next fee already. One due this month or earlier has been paid.
 */
export function semesterFeeOffer(
  profile: Profile | null | undefined,
  today: IsoDate,
  rows: Pick<OneOff, 'name' | 'dueMonth'>[],
): SemesterFeeOffer | null {
  const next = nextFee(profile, today);
  if (next === null) return null;
  const isFee = (name: string) => name.trim().toLowerCase() === SEMESTER_FEE_NAME.toLowerCase();
  // 'YYYY-MM' strings sort chronologically; an unset month ('') is never ahead.
  if (rows.some((row) => isFee(row.name) && row.dueMonth > monthOf(today))) return null;
  const parts = next.fee?.parts ?? [];
  const amountMinor = parts.reduce((sum, part) => sum + part.minor, 0);
  return {
    row: { name: SEMESTER_FEE_NAME, amountMinor, dueMonth: next.dueMonth },
    parts,
    reRegistration: next.fee?.reRegistration ?? null,
  };
}

const dayAndMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });
const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });

/** "1 Oct – 31 Mar": a short label, so not DD-MM-YYYY. Any year will do; none of the days is 29 February. */
export function periodLabel(period: Pick<SemesterPeriod, 'starts' | 'ends'>): string {
  const day = (monthDay: string) => dayAndMonth.format(parseISO(`2027-${monthDay}`));
  return `${day(period.starts)} – ${day(period.ends)}`;
}

export function termName(term: SemesterPeriod['term']): string {
  return term === 'winter' ? 'Winter semester' : 'Summer semester';
}

/** "March 2027". */
export function monthLabel(month: IsoMonth): string {
  return monthAndYear.format(parseISO(firstOfMonth(month)));
}
