import {
  addDays as addDaysFns,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Local calendar day, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Local calendar month, `YYYY-MM`. */
export type IsoMonth = string;

const DATE_FORMAT = 'yyyy-MM-dd';
const WEEK = { weekStartsOn: 1 } as const; // Monday

// date-fns parses date-only strings as local midnight, so nothing shifts through UTC.
function toDate(iso: IsoDate | IsoMonth): Date {
  return parseISO(iso);
}

function toIso(date: Date): IsoDate {
  return format(date, DATE_FORMAT);
}

/** Today's date in local time. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(now);
}

/** How a full date is shown: "2026-10-19" gives "19-10-2026". */
export function formatDate(d: IsoDate): string {
  const [year, month, day] = d.split('-');
  return `${day}-${month}-${year}`;
}

/** An ISO timestamp as local date and time: "19-10-2026, 14:05". Text that is not a timestamp comes back as it is. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : format(date, 'dd-MM-yyyy, HH:mm');
}

export function monthOf(d: IsoDate): IsoMonth {
  return d.slice(0, 7);
}

export function firstOfMonth(m: IsoMonth): IsoDate {
  return `${m}-01`;
}

export function daysInMonth(m: IsoMonth): number {
  return getDaysInMonth(toDate(m));
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return toIso(addDaysFns(toDate(d), n));
}

/** Whole calendar days from a to b (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return differenceInCalendarDays(toDate(b), toDate(a));
}

/** Whole calendar months from a to b (b − a). */
export function monthsBetween(a: IsoMonth, b: IsoMonth): number {
  return differenceInCalendarMonths(toDate(b), toDate(a));
}

/** The month `by` months after `month` (before, when negative): "2026-12" and 1 give "2027-01". */
export function shiftMonth(month: IsoMonth, by: number): IsoMonth {
  const [year, monthNumber] = month.split('-').map(Number);
  // Counting months from year 0 keeps the arithmetic whole; Math.floor and the modulo handle negatives.
  const index = year * 12 + (monthNumber - 1) + by;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}`;
}

/** Whether d is a Sunday, the last day of the week and the day of the check-in. */
export function isSunday(d: IsoDate): boolean {
  return getDay(toDate(d)) === 0;
}

/** The Monday–Sunday week containing d, cut off at the first and last day of d's month. */
export function weekInMonth(d: IsoDate): { start: IsoDate; end: IsoDate } {
  const date = toDate(d);
  const weekStart = toIso(startOfWeek(date, WEEK));
  const weekEnd = toIso(endOfWeek(date, WEEK));
  const monthStart = toIso(startOfMonth(date));
  const monthEnd = toIso(endOfMonth(date));
  // ISO date strings sort chronologically, so plain comparison is enough.
  return {
    start: weekStart < monthStart ? monthStart : weekStart,
    end: weekEnd > monthEnd ? monthEnd : weekEnd,
  };
}

/** The whole Monday–Sunday week containing d. Unlike `weekInMonth`, it is not cut off at the month's edges. */
export function weekOf(d: IsoDate): { start: IsoDate; end: IsoDate } {
  const date = toDate(d);
  return { start: toIso(startOfWeek(date, WEEK)), end: toIso(endOfWeek(date, WEEK)) };
}

/**
 * How many Monday–Sunday weeks are left in d's month, d's own week included. A week counts if any of its days is in
 * the month, so a stub week of a single day counts as a whole one.
 */
export function weeksLeftInMonth(d: IsoDate): number {
  const monthEnd = toIso(endOfMonth(toDate(d)));
  return Math.floor(daysBetween(weekOf(d).start, monthEnd) / 7) + 1;
}

/**
 * On a Sunday whose Monday–Sunday week starts in the previous month, the part of that week in the previous
 * month: Sun 1 Nov 2026 gives Mon 26 – Sat 31 Oct. `weekInMonth` cuts a week off at the month's edge, so a
 * Sunday review of that week would never see these days. Null on any other day, and on a Sunday whose week
 * starts in its own month.
 */
export function previousMonthTail(d: IsoDate): { start: IsoDate; end: IsoDate } | null {
  if (!isSunday(d)) return null;
  const weekStart = toIso(startOfWeek(toDate(d), WEEK));
  const monthStart = firstOfMonth(monthOf(d));
  // ISO date strings sort chronologically, so plain comparison is enough.
  if (weekStart >= monthStart) return null;
  return { start: weekStart, end: addDays(monthStart, -1) };
}
