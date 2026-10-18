import { parseISO } from 'date-fns';
import type { IsoDate } from './dates';

const weekday = new Intl.DateTimeFormat('en-IE', { weekday: 'short' });
const dayOfMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric' });
const monthShort = new Intl.DateTimeFormat('en-IE', { month: 'short' });

/**
 * "Mon 12 – Sun 18 Oct". The week is cut off at the month's edges, so it never spans two months and the
 * month can go last. A one-day week (the 1st falling on a Sunday) reads "Sun 1 Nov".
 */
export function weekLabel(start: IsoDate, end: IsoDate): string {
  // `parseISO` reads a date-only string as local midnight, so the day never shifts.
  const first = parseISO(start);
  const last = parseISO(end);
  const lastDay = `${weekday.format(last)} ${dayOfMonth.format(last)}`;
  if (start === end) return `${lastDay} ${monthShort.format(last)}`;
  return `${weekday.format(first)} ${dayOfMonth.format(first)} – ${lastDay} ${monthShort.format(last)}`;
}
