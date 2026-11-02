import { parseISO } from 'date-fns';
import { dateFormat } from '@/i18n/format';
import type { IsoDate } from './dates';

const ENGLISH = 'en-IE';
const DAY = { weekday: 'short', day: 'numeric', month: 'short' } as const;

/**
 * "Mon 12 – Sun 18 Oct" in English (the default locale), "Mo., 12. – So., 18. Okt." in German. The week is cut off at
 * the month's edges, so it never spans two months and the month can go last. A one-day week (the 1st falling on a
 * Sunday) reads "Sun 1 Nov".
 *
 * English is built from its parts, so it reads the same in every browser engine (the e2e checks it word for word);
 * another locale uses Intl's own range, which puts that language's punctuation in the right places.
 */
export function weekLabel(start: IsoDate, end: IsoDate, locale: string = ENGLISH): string {
  // `parseISO` reads a date-only string as local midnight, so the day never shifts.
  const first = parseISO(start);
  const last = parseISO(end);
  if (locale !== ENGLISH) {
    const days = dateFormat(locale, DAY);
    // Intl puts thin spaces around the dash; the app writes " – " with plain spaces everywhere.
    return start === end ? days.format(last) : days.formatRange(first, last).replaceAll(' ', ' ');
  }
  const weekday = dateFormat(ENGLISH, { weekday: 'short' });
  const dayOfMonth = dateFormat(ENGLISH, { day: 'numeric' });
  const monthShort = dateFormat(ENGLISH, { month: 'short' });
  const lastDay = `${weekday.format(last)} ${dayOfMonth.format(last)}`;
  if (start === end) return `${lastDay} ${monthShort.format(last)}`;
  return `${weekday.format(first)} ${dayOfMonth.format(first)} – ${lastDay} ${monthShort.format(last)}`;
}
