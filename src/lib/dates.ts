import {
  addDays as addDaysFns,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  endOfWeek,
  format,
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
