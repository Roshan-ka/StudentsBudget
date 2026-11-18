// A date written in a quick-add line, read on the phone (docs/superpowers/plans/2026-11-18-quick-add-dates.md,
// Roshan's defaults, 18-11-2026): "10 haircut on 27 november 2025", "döner 6 gestern", "am 27.11.", "last friday".
// Pure, so every form is tested in each language; the local provider takes the date out before it reads the amount.
import { getISODay, parseISO } from 'date-fns';
import { readTypedDate } from '@/components/date-input';
import { isIsoDate } from '@/features/recurring/schedule';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { addDays, daysInMonth, type IsoDate } from '@/lib/dates';

/** A date found in a line, and the line without it (its cue word and connectors gone too). */
export type LineDate = { date: IsoDate; rest: string };

/** The word in front of a date: "on 27.11", "am 27.11.", "le 27/11", "el 27/11". */
const CUES: Record<Language, string> = { en: 'on', de: 'am', fr: 'le', es: 'el' };

/** Words between a date's parts: "27th of november", "27 de noviembre de 2025". */
const CONNECTORS: Record<Language, readonly string[]> = { en: ['of'], de: [], fr: [], es: ['de'] };

/** Today, yesterday and the day before, as folded words, longest first. */
const RELATIVE: Record<Language, readonly { words: readonly string[]; daysBack: number }[]> = {
  en: [
    { words: ['the', 'day', 'before', 'yesterday'], daysBack: 2 },
    { words: ['day', 'before', 'yesterday'], daysBack: 2 },
    { words: ['yesterday'], daysBack: 1 },
    { words: ['today'], daysBack: 0 },
  ],
  de: [
    { words: ['vorgestern'], daysBack: 2 },
    { words: ['gestern'], daysBack: 1 },
    { words: ['heute'], daysBack: 0 },
  ],
  fr: [
    { words: ['avant-hier'], daysBack: 2 },
    { words: ['hier'], daysBack: 1 },
    { words: ['aujourdhui'], daysBack: 0 },
  ],
  es: [
    { words: ['antes', 'de', 'ayer'], daysBack: 2 },
    { words: ['anteayer'], daysBack: 2 },
    { words: ['ayer'], daysBack: 1 },
    { words: ['hoy'], daysBack: 0 },
  ],
};

/**
 * The words that make a weekday the one before today (chunk 3): "last friday", "letzten Freitag" in front,
 * "vendredi dernier", "el viernes pasado" after. Without one, a weekday is the most recent such day, today included.
 */
const LAST_BEFORE: Record<Language, readonly string[]> = {
  en: ['last'],
  de: ['letzten', 'letzter', 'vergangenen', 'vergangener'],
  fr: [],
  es: [],
};
const LAST_AFTER: Record<Language, readonly string[]> = { en: [], de: [], fr: ['dernier'], es: ['pasado'] };

const DAY = /^(\d{1,2})(?:st|nd|rd|th|er|e)?$/;
const YEAR = /^20\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE_NUMERIC = /^\d{1,2}[./-]\d{1,2}[./-](?:\d{2}|\d{4})$/;
const SHORT_NUMERIC = /^\d{1,2}[./]\d{1,2}$/;

/** A token as the rules read it: lower case, accents and apostrophes gone, a trailing mark dropped ("Nov.", "27,"). */
function fold(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[.,;:!?]+$/, '');
}

/** The languages a line's date words are read in: the phone's, and English, which students mix in. */
function languagesFor(lang: Language): Language[] {
  return lang === 'en' ? ['en'] : [lang, 'en'];
}

const monthNameCache = new Map<Language, string[]>();

/** The twelve month names in `lang`, folded ("marz", "novembre"), from the platform's own calendar. */
function monthNames(lang: Language): string[] {
  const cached = monthNameCache.get(lang);
  if (cached !== undefined) return cached;
  const format = new Intl.DateTimeFormat(LANGUAGES[lang].locale, { month: 'long', timeZone: 'UTC' });
  const names = Array.from({ length: 12 }, (_, month) => fold(format.format(Date.UTC(2026, month, 1))));
  monthNameCache.set(lang, names);
  return names;
}

const weekdayNameCache = new Map<Language, string[]>();

/** The seven weekday names in `lang`, Monday first, folded ("miercoles", "samedi"), from the platform's calendar. */
function weekdayNames(lang: Language): string[] {
  const cached = weekdayNameCache.get(lang);
  if (cached !== undefined) return cached;
  const format = new Intl.DateTimeFormat(LANGUAGES[lang].locale, { weekday: 'long', timeZone: 'UTC' });
  // 16 November 2026 is a Monday.
  const names = Array.from({ length: 7 }, (_, day) => fold(format.format(Date.UTC(2026, 10, 16 + day))));
  weekdayNameCache.set(lang, names);
  return names;
}

/**
 * The weekday (1 Monday to 7 Sunday) a token names in full: "sun", "sat" and "wed" are words too, so no short forms.
 */
function weekdayOfToken(token: string, langs: readonly Language[]): number | null {
  for (const lang of langs) {
    const index = weekdayNames(lang).indexOf(token);
    if (index !== -1) return index + 1;
  }
  return null;
}

/** The most recent `weekday` up to `today`, or with `before` the one before today (a week back on that weekday). */
function lastWeekday(weekday: number, today: IsoDate, before: boolean): IsoDate {
  const back = (getISODay(parseISO(today)) - weekday + 7) % 7;
  return addDays(today, -(back === 0 && before ? 7 : back));
}

/** The month (1–12) a token names: three letters or more that start one month's name, and only one month's. */
function monthOfToken(token: string, langs: readonly Language[]): number | null {
  if (!/^\p{L}{3,}$/u.test(token)) return null;
  const months = new Set<number>();
  for (const lang of langs) {
    monthNames(lang).forEach((name, index) => {
      if (name.startsWith(token)) months.add(index + 1);
    });
  }
  return months.size === 1 ? [...months][0] : null;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * The day `day`.`month` of `year`, or with no year the most recent one up to `today` (so "27 Nov" in January is last
 * November). Null for a day the month doesn't have.
 */
function dayOf(day: number, month: number, year: number | null, today: IsoDate): IsoDate | null {
  const thisYear = Number(today.slice(0, 4));
  const tryYear = (y: number) => {
    const iso = `${y}-${two(month)}-${two(day)}`;
    return day >= 1 && day <= daysInMonth(iso.slice(0, 7)) ? iso : null;
  };
  if (year !== null) return tryYear(year);
  const now = tryYear(thisYear);
  return now !== null && now <= today ? now : tryYear(thisYear - 1);
}

/** A typed numeric date, with no year read as the most recent such day. */
function numericDate(token: string, today: IsoDate): IsoDate | null {
  const read = readTypedDate(token, today);
  if (read.kind !== 'date') return null;
  const hasYear = token.split(/[./-]/).length === 3;
  if (hasYear || read.date <= today) return read.date;
  const [, month, day] = read.date.split('-').map(Number);
  return dayOf(day, month, Number(today.slice(0, 4)) - 1, today);
}

/** One date at `i`: its first and last token and the day. */
type Found = { start: number; end: number; date: IsoDate };

function dateAt(folded: string[], i: number, today: IsoDate, langs: readonly Language[]): Found | null {
  const at = (k: number) => folded[k] ?? '';
  const connectors = new Set(langs.flatMap((lang) => CONNECTORS[lang]));
  const isConnector = (k: number) => connectors.has(at(k));

  // Today, yesterday, the day before.
  for (const lang of langs) {
    for (const { words, daysBack } of RELATIVE[lang]) {
      if (words.every((word, k) => at(i + k) === word)) {
        return { start: i, end: i + words.length - 1, date: addDays(today, -daysBack) };
      }
    }
  }

  // Weekdays: "friday", "on friday", "last friday", "letzten Freitag", "vendredi dernier", "el viernes pasado".
  const lastBefore = new Set(langs.flatMap((lang) => LAST_BEFORE[lang]));
  const lastAfter = new Set(langs.flatMap((lang) => LAST_AFTER[lang]));
  if (lastBefore.has(at(i))) {
    const weekday = weekdayOfToken(at(i + 1), langs);
    if (weekday !== null) return { start: i, end: i + 1, date: lastWeekday(weekday, today, true) };
  }
  const weekday = weekdayOfToken(at(i), langs);
  if (weekday !== null) {
    const before = lastAfter.has(at(i + 1));
    return { start: i, end: before ? i + 1 : i, date: lastWeekday(weekday, today, before) };
  }

  // Numbers: "2025-11-27", "27.11.2025", and "on 27.11" (a cue word first, or it is an amount).
  if (ISO.test(at(i)) && isIsoDate(at(i))) return { start: i, end: i, date: at(i) };
  if (WHOLE_NUMERIC.test(at(i))) {
    const date = numericDate(at(i), today);
    if (date !== null) return { start: i, end: i, date };
  }
  const cues = new Set(langs.map((lang) => CUES[lang]));
  if (cues.has(at(i)) && SHORT_NUMERIC.test(at(i + 1))) {
    const date = numericDate(at(i + 1), today);
    if (date !== null) return { start: i, end: i + 1, date };
  }

  // Day first: "27 november 2025", "27th of november", "27 de noviembre de 2025".
  const dayFirst = DAY.exec(at(i));
  if (dayFirst !== null) {
    let k = i + 1;
    if (isConnector(k)) k += 1;
    const month = monthOfToken(at(k), langs);
    if (month !== null) {
      let end = k;
      let year: number | null = null;
      const y = isConnector(k + 1) ? k + 2 : k + 1;
      if (YEAR.test(at(y))) {
        year = Number(at(y));
        end = y;
      }
      // A day number after the month, with no year here, is that month's day ("10 Nov 27, 2025", "haircut 10
      // november 27"): the month-first reading at the next token takes it, and this number stays the amount.
      const dayAfter = year === null && DAY.test(at(k + 1));
      const date = dayAfter ? null : dayOf(Number(dayFirst[1]), month, year, today);
      if (date !== null) return { start: i, end, date };
    }
  }

  // Month first: "Nov 27", "november 27, 2025".
  const month = monthOfToken(at(i), langs);
  const monthFirst = month === null ? null : DAY.exec(at(i + 1));
  if (month !== null && monthFirst !== null) {
    const year = YEAR.test(at(i + 2)) ? Number(at(i + 2)) : null;
    const date = dayOf(Number(monthFirst[1]), month, year, today);
    if (date !== null) return { start: i, end: year === null ? i + 1 : i + 2, date };
  }
  return null;
}

/**
 * Every date written in `text`, in the order it starts, each with the line without it: the phone's language and
 * English (so German "hier" is never French "yesterday"). A cue word in front ("on", "am", "le", "el"; "on the") goes
 * with the date. Quick add takes the first that leaves an amount, so "6 mai döner" keeps its €6.
 */
export function lineDates(text: string, today: IsoDate, lang: Language): LineDate[] {
  const tokens = text.trim() === '' ? [] : text.trim().split(/\s+/);
  const folded = tokens.map(fold);
  const langs = languagesFor(lang);
  const cues = new Set(langs.map((l) => CUES[l]));
  const found: LineDate[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const hit = dateAt(folded, i, today, langs);
    if (hit === null) continue;
    let start = hit.start;
    if (langs.includes('en') && folded[start - 1] === 'the' && cues.has(folded[start - 2] ?? '')) start -= 2;
    else if (cues.has(folded[start - 1] ?? '')) start -= 1;
    const rest = tokens.filter((_, k) => k < start || k > hit.end).join(' ');
    found.push({ date: hit.date, rest });
  }
  return found;
}

/** The first date in `text` (`lineDates`), or null. */
export function readLineDate(text: string, today: IsoDate, lang: Language): LineDate | null {
  return lineDates(text, today, lang)[0] ?? null;
}
