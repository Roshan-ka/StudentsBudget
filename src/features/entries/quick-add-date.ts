// A date written in a quick-add line, read on the phone (docs/superpowers/plans/2026-11-18-quick-add-dates.md,
// Roshan's defaults, 18-11-2026): "10 haircut on 27 november 2025", "döner 6 gestern", "am 27.11.", "last friday".
// Pure, so every form is tested in each language; the local provider takes the date out before it reads the amount.
import { getISODay, parseISO } from 'date-fns';
import { readTypedDate } from '@/components/date-input';
import { isIsoDate } from '@/features/recurring/schedule';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { addDays, daysBetween, daysInMonth, monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';

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

/**
 * The words that make a weekday the coming one, after today (quick add breakpoints, 18-11-2026): "next friday",
 * "nächsten Freitag", "el próximo viernes" in front, "vendredi prochain" after. Quick add then refuses it as still to
 * come; before, "next friday" saved last Friday.
 */
const NEXT_BEFORE: Record<Language, readonly string[]> = {
  en: ['next'],
  de: ['nachsten', 'nachster', 'kommenden', 'kommender'],
  fr: [],
  es: ['proximo'],
};
const NEXT_AFTER: Record<Language, readonly string[]> = { en: [], de: [], fr: ['prochain'], es: [] };

/** Tomorrow, which quick add refuses as still to come (breakpoints): before, it saved today with the word in the note. */
const TOMORROW: Record<Language, readonly string[]> = { en: ['tomorrow'], de: ['morgen'], fr: ['demain'], es: ['manana'] };

/** The words before "morgen" or "mañana" that make it the morning: "am Morgen", "heute morgen", "esta mañana". */
const MORNING_AFTER: Record<Language, readonly string[]> = {
  en: [],
  de: ['am', 'heute', 'gestern', 'vorgestern'],
  fr: [],
  es: ['esta', 'la', 'por'],
};

/**
 * The words after which a month or weekday name is a person's name or a thing, not a date (breakpoints): "2 döner with
 * Jan 7", "Kino mit Jan", "cena con Domingo", "chocolat avec Mars", "tickets for friday". Nothing that starts right
 * after one of them is a date.
 */
const COMPANIONS: Record<Language, readonly string[]> = {
  en: ['with', 'for'],
  de: ['mit', 'fur'],
  fr: ['avec', 'pour'],
  es: ['con', 'para'],
};

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

/** The coming `weekday` after `today` (a week ahead on that weekday). */
function nextWeekday(weekday: number, today: IsoDate): IsoDate {
  const ahead = (weekday - getISODay(parseISO(today)) + 7) % 7;
  return addDays(today, ahead === 0 ? 7 : ahead);
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

/** How far ahead a date with no year still means the coming one (quick add breakpoints, 18-11-2026). */
const FUTURE_DAYS = 31;

/**
 * The day `day` with no year: in `month`, or with no month in this month or the last that has it ("am 17.", "am 31."
 * in November is 31 October). The coming one when it is at most `FUTURE_DAYS` ahead, so quick add refuses it ("am
 * 5.12" in November is 5 December, still to come; "am 25." on the 18th the 25th), else the most recent one up to
 * `today` ("27 Nov" in January is last November, "5. März" in November this March). A bare day never reaches into next
 * month: "am 17." on the 18th is yesterday. Null for a day no such month has. Before 18-11-2026 it was always the most
 * recent, a year back unsaid.
 */
export function noYearDay(day: number, month: number | null, today: IsoDate): IsoDate | null {
  const inMonth = (m: IsoMonth): IsoDate | null => (day >= 1 && day <= daysInMonth(m) ? `${m}-${two(day)}` : null);
  const thisYear = Number(today.slice(0, 4));
  // In order, earliest first: this month and the two before it, or `month` last year, this year and next.
  const months: IsoMonth[] =
    month === null
      ? [-2, -1, 0].map((by) => shiftMonth(monthOf(today), by))
      : [thisYear - 1, thisYear, thisYear + 1].map((y) => `${y}-${two(month)}`);
  const days = months.map(inMonth).filter((d): d is IsoDate => d !== null);
  const coming = days.find((d) => d > today && daysBetween(today, d) <= FUTURE_DAYS);
  if (coming !== undefined) return coming;
  return days.filter((d) => d <= today).pop() ?? null;
}

/** The day `day`.`month` of `year`, or with no year as `noYearDay` reads it. Null for a day the month doesn't have. */
function dayOf(day: number, month: number, year: number | null, today: IsoDate): IsoDate | null {
  if (year === null) return noYearDay(day, month, today);
  const iso = `${year}-${two(month)}-${two(day)}`;
  return day >= 1 && day <= daysInMonth(iso.slice(0, 7)) ? iso : null;
}

/** A typed numeric date, with no year read as `noYearDay` reads it. */
function numericDate(token: string, today: IsoDate): IsoDate | null {
  const read = readTypedDate(token, today);
  if (read.kind !== 'date') return null;
  const hasYear = token.split(/[./-]/).length === 3;
  if (hasYear) return read.date;
  const [, month, day] = read.date.split('-').map(Number);
  return noYearDay(day, month, today);
}

/** One date at `i`: its first and last token and the day. */
type Found = { start: number; end: number; date: IsoDate };

function dateAt(
  folded: string[],
  i: number,
  today: IsoDate,
  langs: readonly Language[],
  raw: readonly string[],
): Found | null {
  const at = (k: number) => folded[k] ?? '';
  const connectors = new Set(langs.flatMap((lang) => CONNECTORS[lang]));
  const isConnector = (k: number) => connectors.has(at(k));
  const among = (words: Record<Language, readonly string[]>, k: number) => langs.some((lang) => words[lang].includes(at(k)));

  // "with Jan", "con Domingo": a name, not a date (quick add breakpoints, 18-11-2026).
  if (among(COMPANIONS, i - 1)) return null;

  // Tomorrow, unless it is the morning ("am Morgen", "esta mañana").
  if (among(TOMORROW, i)) return among(MORNING_AFTER, i - 1) ? null : { start: i, end: i, date: addDays(today, 1) };

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
  if (among(NEXT_BEFORE, i)) {
    const weekday = weekdayOfToken(at(i + 1), langs);
    if (weekday !== null) return { start: i, end: i + 1, date: nextWeekday(weekday, today) };
  }
  const weekday = weekdayOfToken(at(i), langs);
  if (weekday !== null) {
    if (among(NEXT_AFTER, i + 1)) return { start: i, end: i + 1, date: nextWeekday(weekday, today) };
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

  // A bare day after a cue word: "am 17.", "on 17", "on the 17th", "le 17", "el 17" (quick add breakpoints,
  // 18-11-2026: it was read as the amount). Never when a month name follows: that is the day-first form's, valid or not.
  const bareDay = DAY.exec(at(i));
  const cueBefore = cues.has(at(i - 1)) || (langs.includes('en') && at(i - 1) === 'the' && cues.has(at(i - 2)));
  const monthAfter = monthOfToken(at(i + 1), langs) !== null || (isConnector(i + 1) && monthOfToken(at(i + 2), langs) !== null);
  // Only at the end of the line, with an ordinal mark ("17.", "17th") or before a number: "on 2 beers" is a count
  // (final review, 18-11-2026).
  const dayOnly =
    i + 1 >= folded.length || /\.$/.test(raw[i] ?? '') || /\d(?:st|nd|rd|th|er|e)$/.test(at(i)) || /^\d/.test(at(i + 1));
  if (bareDay !== null && cueBefore && !monthAfter && dayOnly) {
    const date = noYearDay(Number(bareDay[1]), null, today);
    if (date !== null) return { start: i, end: i, date };
  }
  return null;
}

/**
 * The tokens of `text` (split at spaces) that a date owns and that are never the amount: a year (`YEAR`) after a month
 * name, a connector between them allowed ("November 2025", "noviembre de 2025"), and that date's day number
 * ("10 november 2025", "Nov 27, 2025"). Quick add passes them to `readQuickAdd` when it reads the line without a date
 * (quick add breakpoints, 18-11-2026: "Miete 400 November 2025" saved €2,025).
 */
export function dateNumberTokens(text: string, lang: Language): Set<number> {
  const folded = (text.trim() === '' ? [] : text.trim().split(/\s+/)).map(fold);
  const langs = languagesFor(lang);
  const connectors = new Set(langs.flatMap((l) => CONNECTORS[l]));
  const at = (k: number) => folded[k] ?? '';
  const owned = new Set<number>();
  folded.forEach((token, i) => {
    if (!YEAR.test(token)) return;
    // Day first: "[day] [of|de] month [de] year".
    const monthAt = connectors.has(at(i - 1)) ? i - 2 : i - 1;
    if (monthOfToken(at(monthAt), langs) !== null) {
      owned.add(i);
      const dayAt = connectors.has(at(monthAt - 1)) ? monthAt - 2 : monthAt - 1;
      if (DAY.test(at(dayAt))) owned.add(dayAt);
      return;
    }
    // Month first: "Nov 27, 2025".
    if (DAY.test(at(i - 1)) && monthOfToken(at(i - 2), langs) !== null) {
      owned.add(i);
      owned.add(i - 1);
    }
  });
  return owned;
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
    const hit = dateAt(folded, i, today, langs, tokens);
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
