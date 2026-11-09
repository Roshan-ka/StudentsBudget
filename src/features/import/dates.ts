import { isValid, parseISO } from 'date-fns';
import type { IsoDate } from '@/lib/dates';

// Dates as bank statements write them (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md): day first
// (`31.10.26` at Sparkasse and DKB, `31.10.2026` once a spreadsheet saved the file again), or year first (`2026-10-31`
// at N26, `2026-10-31 14:02:11` at Revolut, whose time is left out). Month first is only for a CSV matched by hand.

export type DateOrder = 'dmy' | 'ymd' | 'mdy';

const DAY_FIRST = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/;
const YEAR_FIRST = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/;

/** The date as an `IsoDate`, or null for text that isn't a real date in that order. A two-digit year is 20YY. */
export function parseStatementDate(text: string, order: DateOrder): IsoDate | null {
  // Revolut's time (and any other) after the date is not needed: entries have a day.
  const value = text.trim().split(/[\sT]/)[0] ?? '';
  let year: string;
  let month: string;
  let day: string;
  if (order === 'ymd') {
    const match = YEAR_FIRST.exec(value);
    if (match === null) return null;
    [, year, month, day] = match;
  } else {
    const match = DAY_FIRST.exec(value);
    if (match === null) return null;
    const [, first, second, y] = match;
    [day, month] = order === 'dmy' ? [first, second] : [second, first];
    year = y.length === 2 ? `20${y}` : y;
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  // parseISO rolls nothing over, so 31.02. is refused here.
  return isValid(parseISO(iso)) ? iso : null;
}

/**
 * The order a column of dates is written in. Year first when every date is; otherwise a first part over 12 means day
 * first and a second part over 12 month first. `prefer` (the profile's, or the region's day first) settles the rest.
 */
export function guessDateOrder(values: readonly string[], prefer: DateOrder = 'dmy'): DateOrder {
  const dates = values.map((value) => value.trim().split(/[\sT]/)[0] ?? '').filter((value) => value !== '');
  if (dates.length === 0) return prefer;
  if (dates.every((value) => YEAR_FIRST.test(value))) return 'ymd';
  let dayFirst = false;
  let monthFirst = false;
  for (const value of dates) {
    const match = DAY_FIRST.exec(value);
    if (match === null) continue;
    if (Number(match[1]) > 12) dayFirst = true;
    if (Number(match[2]) > 12) monthFirst = true;
  }
  if (dayFirst !== monthFirst) return dayFirst ? 'dmy' : 'mdy';
  return prefer === 'ymd' ? 'dmy' : prefer;
}
