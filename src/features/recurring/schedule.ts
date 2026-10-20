import { getISODay, isValid, parseISO } from 'date-fns';
import type { Schedule } from '@/db/types';
import { addDays, daysInMonth, firstOfMonth, monthOf, shiftMonth, type IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { newId } from '@/lib/new-id';

type Timing = Pick<Schedule, 'frequency' | 'day'>;

/** Weekly days, 1 = Monday … 7 = Sunday. */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day written as `YYYY-MM-DD`. */
export function isIsoDate(d: string): boolean {
  return ISO_DATE.test(d) && isValid(parseISO(d));
}

/** The later of two days. ISO date strings sort chronologically, so plain comparison is enough. */
export function laterOf(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}

/** The period `d` falls in: its calendar month, or its Monday–Sunday week. */
export function periodOf(s: Pick<Schedule, 'frequency'>, d: IsoDate): { start: IsoDate; end: IsoDate } {
  if (s.frequency === 'monthly') {
    const month = monthOf(d);
    return { start: firstOfMonth(month), end: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` };
  }
  const start = addDays(d, 1 - getISODay(parseISO(d)));
  return { start, end: addDays(start, 6) };
}

function nextPeriodStart(s: Pick<Schedule, 'frequency'>, periodStart: IsoDate): IsoDate {
  return s.frequency === 'monthly' ? firstOfMonth(shiftMonth(monthOf(periodStart), 1)) : addDays(periodStart, 7);
}

/**
 * The day a period's occurrence falls on: the day of the month (the month's last day when it is shorter), or the
 * period's Monday + day − 1.
 */
export function occurrenceIn(s: Timing, periodStart: IsoDate): IsoDate {
  if (s.frequency === 'weekly') return addDays(periodStart, s.day - 1);
  const month = monthOf(periodStart);
  return `${month}-${String(Math.min(s.day, daysInMonth(month))).padStart(2, '0')}`;
}

/** The first day on or after `startOn` that an occurrence falls on. */
export function firstOccurrence(timing: Timing, startOn: IsoDate): IsoDate {
  const { start } = periodOf(timing, startOn);
  const occurrence = occurrenceIn(timing, start);
  return occurrence >= startOn ? occurrence : occurrenceIn(timing, nextPeriodStart(timing, start));
}

/**
 * The day the first automatic entry comes, for a line whose schedule has not started yet. Without a `stored` schedule
 * (a new line, or one turned on) it starts tomorrow, as `newSchedule` does; with `restart` a stored one is added again
 * from tomorrow (`restartSchedule`). The first entry is the first occurrence from the start, or from the day after the
 * watermark when that is later. Null once the schedule has started (its start is today or earlier) and while paused.
 */
export function firstAddedOn(
  timing: Timing,
  stored: Schedule | undefined,
  today: IsoDate,
  restart = false,
): IsoDate | null {
  const s =
    stored === undefined
      ? { startOn: addDays(today, 1), postedThrough: today }
      : restart
        ? restartSchedule(stored, today)
        : stored;
  if (stored?.paused || s.startOn <= today) return null;
  return firstOccurrence(timing, laterOf(s.startOn, addDays(s.postedThrough, 1)));
}

/**
 * The periods whose occurrence is due by `today` and not handled yet, as period starts, oldest first. An occurrence
 * is due when it falls from `startOn` to `today`, in a period that ends after `postedThrough`, and itself after
 * `postedThrough`: every day up to the watermark has been handled, so a change of frequency (a month handled through
 * its last day, then weekly) never posts a day the old schedule already covered. Empty while paused.
 */
export function duePeriods(s: Schedule, today: IsoDate): IsoDate[] {
  if (s.paused) return [];
  // The first day that can hold a due occurrence; every period before the one containing it is out.
  const from = laterOf(s.startOn, addDays(s.postedThrough, 1));
  const due: IsoDate[] = [];
  for (let start = periodOf(s, from).start; start <= today; start = nextPeriodStart(s, start)) {
    const occurrence = occurrenceIn(s, start);
    if (occurrence >= s.startOn && occurrence > s.postedThrough && occurrence <= today) due.push(start);
  }
  return due;
}

/** What a schedule comes to in a month: weekly is 52 weeks over 12 months, rounded to the cent. */
export function monthlyEquivalent(s: Pick<Schedule, 'frequency' | 'amountMinor'>): Minor {
  return s.frequency === 'monthly' ? s.amountMinor : Math.round((s.amountMinor * 52) / 12);
}

/** The amount each occurrence posts for a monthly euro figure; the inverse of `monthlyEquivalent`. */
export function perOccurrence(monthlyMinor: Minor, frequency: Schedule['frequency']): Minor {
  return frequency === 'monthly' ? monthlyMinor : Math.round((monthlyMinor * 12) / 52);
}

/** A new schedule, or one turned on again: it starts tomorrow and counts today as handled, so nothing back-posts. */
export function newSchedule(
  fields: Pick<Schedule, 'frequency' | 'day' | 'accountId' | 'amountMinor'>,
  today: IsoDate,
  id: string = newId(),
): Schedule {
  return { id, ...fields, startOn: addDays(today, 1), postedThrough: today };
}

/**
 * Adds a schedule again from tomorrow: nothing up to today posts, and a later watermark stays. For a line whose
 * account was gone and has been picked again, so the periods it missed are not back-posted. A pause stays.
 */
export function restartSchedule(s: Schedule, today: IsoDate): Schedule {
  return { ...s, startOn: addDays(today, 1), postedThrough: laterOf(s.postedThrough, today) };
}

/** Resumes from tomorrow: the periods it was paused for are skipped, and a later watermark stays. */
export function resumeSchedule(s: Schedule, today: IsoDate): Schedule {
  const resumed = restartSchedule(s, today);
  delete resumed.paused;
  return resumed;
}

/** "Monthly on day 3", "Weekly on Friday". */
export function describeTiming(s: Timing): string {
  return s.frequency === 'monthly' ? `Monthly on day ${s.day}` : `Weekly on ${WEEKDAYS[s.day - 1]}`;
}

/** Whether the poster can work with a schedule. One from a damaged or hand-edited file is left alone. */
export function isUsableSchedule(s: Schedule): boolean {
  const lastDay = s.frequency === 'monthly' ? 31 : s.frequency === 'weekly' ? 7 : 0;
  return (
    Number.isInteger(s.day) &&
    s.day >= 1 &&
    s.day <= lastDay &&
    Number.isSafeInteger(s.amountMinor) &&
    s.amountMinor > 0 &&
    isIsoDate(s.startOn) &&
    isIsoDate(s.postedThrough)
  );
}
