// Formatters for dates, numbers and lists in a given locale (the phone's, from useT().locale), each built once per
// locale and options: an Intl object is costly to build, and a component re-renders often. Money has its own
// formatter in src/lib/money.ts, which the MCP server loads before the app's imports work.

import { parseISO } from 'date-fns';
import type { IsoDate } from '@/lib/dates';

const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.ListFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.ListFormat>(key: string, make: () => T): T {
  let formatter = formatters.get(key) as T | undefined;
  if (formatter === undefined) {
    formatter = make();
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * "Friday, 16 October", in the language's own way: the entries list's day headings and Home's date line. `parseISO`
 * reads a date-only string as local midnight, so the day never shifts.
 */
export function dayLabel(date: IsoDate, locale: string): string {
  return dateFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(date));
}

/** Dates and times: `dateFormat(locale, { month: 'long' })`. */
export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(`date|${locale}|${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(locale, options));
}

/** Plain numbers and percentages (money: formatMoney). */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return cached(`number|${locale}|${JSON.stringify(options)}`, () => new Intl.NumberFormat(locale, options));
}

/** A list joined with the locale's "and": "a, b and c", "a, b und c". */
export function listFormat(locale: string): Intl.ListFormat {
  return cached(`list|${locale}`, () => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }));
}
