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

/**
 * One finished month of the recap, in `lang`: "October 2026: €15 left over → savings", or "October 2026: €12 over
 * plan". Calm either way. The month the plan was set up in counts whole, its plan and its spending, so its line is
 * like any other month's.
 */
export function recapLine(month: IsoMonth, leftoverMinor: Minor, lang: Language = 'en'): string {
  const text = MESSAGES[lang].reveal.recap;
  const { locale } = LANGUAGES[lang];
  const name = dateFormat(locale, { month: 'long', year: 'numeric' }).format(parseISO(`${month}-01`));
  const amount = formatWeekAmount(leftoverMinor, locale).text;
  if (leftoverMinor > 0) return text.savings(name, amount);
  if (leftoverMinor < 0) return text.over(name, amount);
  return text.onPlan(name);
}
