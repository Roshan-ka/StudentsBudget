import { parseISO } from 'date-fns';
import { dateFormat } from '@/i18n/format';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { firstOfMonth, monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

/** "16 Oct" ("16. Okt." in German). `parseISO` reads a date-only string as local midnight, so the day never shifts. */
export const formatDay = (date: IsoDate, locale = 'en-IE'): string =>
  dateFormat(locale, { day: 'numeric', month: 'short' }).format(parseISO(date));

/**
 * One finished month of the recap, in `lang`: "October 2026: €15 left over → savings", or "October 2026: €12 over
 * plan". Calm either way. The month the plan was set up in is planned in full, but only spending from the setup day
 * counts, so unless the plan was set up on the 1st its line says "(counted from 16 Oct)" and does not call what is
 * left over savings: part of that month's spending was never counted.
 */
export function recapLine(month: IsoMonth, leftoverMinor: Minor, createdOn: IsoDate, lang: Language = 'en'): string {
  const text = MESSAGES[lang].reveal.recap;
  const { locale } = LANGUAGES[lang];
  const partial = month === monthOf(createdOn) && createdOn !== firstOfMonth(month);
  const name = dateFormat(locale, { month: 'long', year: 'numeric' }).format(parseISO(`${month}-01`));
  const label = partial ? text.partial(name, formatDay(createdOn, locale)) : name;
  const amount = formatWeekAmount(leftoverMinor, locale).text;
  if (leftoverMinor > 0) return partial ? text.leftOver(label, amount) : text.savings(label, amount);
  if (leftoverMinor < 0) return text.over(label, amount);
  return text.onPlan(label);
}
