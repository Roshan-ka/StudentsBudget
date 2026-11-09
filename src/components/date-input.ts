// The typed date and the calendar sheet of the date field (docs/superpowers/plans/2026-11-06-date-field.md): what a
// typed text reads as, the separators that fill in while typing, a month's weeks and where a key moves the calendar's
// focus. Pure, so the rules are tested without a browser; the field and the sheet only call them.
import { DEFAULT_REGION, REGIONS, type DatePart, type Region } from '@/i18n/regions';
import { addDays, daysInMonth, monthOf, shiftMonth, weekOf, type IsoDate, type IsoMonth } from '@/lib/dates';

/** What a typed text reads as: a date, nothing at all, or text that is not a date. */
export type TypedDate = { kind: 'date'; date: IsoDate } | { kind: 'empty' } | { kind: 'not-a-date' };

/** Anything people put between a date's parts: the region's own separator, and a comma, slash, dash or space. */
const SEPARATORS = /[.,/\-\s]+/;
const SEPARATOR = /^[.,/\-\s]$/;

/** How many digits each part has when it is typed in full. */
const FULL_WIDTH: Record<DatePart, number> = { day: 2, month: 2, year: 4 };

/** The earliest year a typed date may have: anything before is a slip, not a student's entry. */
const FIRST_YEAR = 1900;

/** Two digits, padded: 6 gives "06". */
function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** The parts' digits, in the region's order, from text that is all digits: "06112026" gives 06, 11, 2026. */
function partsOfDigits(digits: string, order: readonly DatePart[]): string[] | null {
  const widths: Record<number, Record<DatePart, number>> = {
    4: { day: 2, month: 2, year: 0 },
    6: { day: 2, month: 2, year: 2 },
    8: { day: 2, month: 2, year: 4 },
  };
  const width = widths[digits.length];
  if (width === undefined) return null;
  const parts: string[] = [];
  let at = 0;
  for (const part of order) {
    if (width[part] === 0) continue;
    parts.push(digits.slice(at, at + width[part]));
    at += width[part];
  }
  return parts;
}

/**
 * The parts of text with separators: "6.11.2026" gives 6, 11, 2026. A separator at the end is still being typed
 * ("6.11."), and two in a row count as one; one at the start leaves an empty part, so the text is not a date (null).
 */
function partsOfText(text: string): string[] | null {
  const parts = text.replace(/[.,/\-\s]+$/, '').split(SEPARATORS);
  return parts.every((part) => /^\d+$/.test(part)) ? parts : null;
}

/**
 * What `text` reads as, with the parts in the region's order (day, month, year in Germany). It takes `6.11`, `6.11.26`
 * and `06.11.2026`, any of the usual separators, and the same as bare digits (`0611`, `061126`, `06112026`). A date
 * without its year is in this year (`today`'s); a two-digit year is in the 2000s. A day that the month doesn't have
 * (31.02.2026) is not a date.
 */
export function readTypedDate(text: string, today: IsoDate, region: Region = DEFAULT_REGION): TypedDate {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  const order = REGIONS[region].dateOrder;

  const parts = /^\d+$/.test(trimmed) ? partsOfDigits(trimmed, order) : partsOfText(trimmed);
  if (parts === null || parts.length < 2 || parts.length > 3) return { kind: 'not-a-date' };

  // Two parts are the day and the month, in the region's order; three are all of them.
  const named = parts.length === 3 ? order : order.filter((part) => part !== 'year');
  const value: Partial<Record<DatePart, string>> = {};
  named.forEach((part, index) => {
    value[part] = parts[index];
  });

  const { day = '', month = '', year = today.slice(0, 4) } = value;
  if (day.length > 2 || month.length > 2 || (year.length !== 2 && year.length !== 4)) return { kind: 'not-a-date' };
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (fullYear < FIRST_YEAR || monthNumber < 1 || monthNumber > 12) return { kind: 'not-a-date' };
  const isoMonth: IsoMonth = `${fullYear}-${two(monthNumber)}`;
  if (dayNumber < 1 || dayNumber > daysInMonth(isoMonth)) return { kind: 'not-a-date' };
  return { kind: 'date', date: `${isoMonth}-${two(dayNumber)}` };
}

/**
 * The text after a keystroke, with the region's separator filled in: typing digits at the end puts it after a full
 * day and a full month ("0611" becomes "06.11."), since a phone's number pad has no dot. Deleting never adds one, a
 * second separator in a row is dropped, and digits pasted in one go are grouped the same way. Anything else stays as
 * typed; the field reads it when the person leaves it.
 */
export function typedDateText(previous: string, next: string, region: Region = DEFAULT_REGION): string {
  if (next.length <= previous.length) return next;
  const { dateOrder, dateSeparator } = REGIONS[region];
  const widths = dateOrder.map((part) => FULL_WIDTH[part]);

  // All digits, typed or pasted: grouped into the parts, with a separator after each full part but the last.
  if (/^\d+$/.test(next)) {
    const groups: string[] = [];
    let at = 0;
    for (const width of widths) {
      if (at >= next.length) break;
      groups.push(next.slice(at, at + width));
      at += width;
    }
    const last = groups.length - 1;
    const full = groups[last].length === widths[last] && last < widths.length - 1;
    return groups.join(dateSeparator) + (full ? dateSeparator : '') + next.slice(at);
  }

  // One character added at the end of text that already has a separator.
  if (next.length !== previous.length + 1 || !next.startsWith(previous)) return next;
  const added = next.slice(-1);
  if (SEPARATOR.test(added)) return previous === '' || SEPARATOR.test(previous.slice(-1)) ? previous : next;
  if (!/^\d$/.test(added)) return next;
  const parts = next.split(SEPARATORS);
  const index = parts.length - 1;
  const full = index < widths.length - 1 && parts[index].length === widths[index];
  return full ? next + dateSeparator : next;
}

/**
 * The six Monday–Sunday weeks the calendar shows for `month`: the one holding its first day and the five after it.
 * Always six, so the sheet keeps its height and its month buttons stay where the thumb is.
 */
export function monthWeeks(month: IsoMonth): IsoDate[][] {
  const start = weekOf(`${month}-01`).start;
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)));
}

/** The same day `by` months later (earlier, when negative), on the month's last day when it is shorter: 31.01 → 28.02. */
export function shiftDayByMonths(day: IsoDate, by: number): IsoDate {
  const month = shiftMonth(monthOf(day), by);
  return `${month}-${two(Math.min(Number(day.slice(8, 10)), daysInMonth(month)))}`;
}

/** A key that moves the calendar's focus. */
export type CalendarKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

/** Whether `key` is one of them. */
export function isCalendarKey(key: string): key is CalendarKey {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(key);
}

/**
 * Where a key moves the calendar's focus from `day` (the date-picker dialog of the WAI-ARIA practices): a day sideways,
 * a week up or down, the week's Monday or Sunday, a month back or on, and with Shift a year. Sideways follows the
 * reading direction, so it flips in a right-to-left language.
 */
export function movedDay(day: IsoDate, key: CalendarKey, shift = false, rtl = false): IsoDate {
  switch (key) {
    case 'ArrowLeft':
      return addDays(day, rtl ? 1 : -1);
    case 'ArrowRight':
      return addDays(day, rtl ? -1 : 1);
    case 'ArrowUp':
      return addDays(day, -7);
    case 'ArrowDown':
      return addDays(day, 7);
    case 'Home':
      return weekOf(day).start;
    case 'End':
      return weekOf(day).end;
    case 'PageUp':
      return shiftDayByMonths(day, shift ? -12 : -1);
    case 'PageDown':
      return shiftDayByMonths(day, shift ? 12 : 1);
  }
}
