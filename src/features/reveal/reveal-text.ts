import { parseISO } from 'date-fns';
import { dateFormat } from '@/i18n/format';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import type { IsoDate, IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

/** "16 Oct" ("16. Okt." in German). `parseISO` reads a date-only string as local midnight, so the day never shifts. */
export const formatDay = (date: IsoDate, locale = 'en-IE'): string =>
  dateFormat(locale, { day: 'numeric', month: 'short' }).format(parseISO(date));

/** A finished month's name and year, in `lang`: "October 2026", "Oktober 2026". The heading of its recap. */
export function recapMonthLabel(month: IsoMonth, lang: Language = 'en'): string {
  return dateFormat(LANGUAGES[lang].locale, { month: 'long', year: 'numeric' }).format(parseISO(`${month}-01`));
}

/**
 * How a finished month went, in `lang`: "€15 left over → savings", or "€12 over plan". Calm either way. The month the
 * plan was set up in counts whole, its plan and its spending, so its line is like any other month's. It is the recap's
 * big line, under the month's name (the new look, 16-11-2026; before, one line: "October 2026: €15 left over →
 * savings").
 */
export function recapResult(leftoverMinor: Minor, lang: Language = 'en'): string {
  const text = MESSAGES[lang].reveal.recap;
  const amount = formatWeekAmount(leftoverMinor, LANGUAGES[lang].locale).text;
  if (leftoverMinor > 0) return text.savings(amount);
  if (leftoverMinor < 0) return text.over(amount);
  return text.onPlan;
}
