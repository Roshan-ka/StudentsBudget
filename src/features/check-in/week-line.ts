import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import type { EnvelopeWeek } from '@/lib/budget';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

/**
 * One envelope's week in a line, in `lang`: "€70 planned · €20 spent · €50 under". The week is compared with its own
 * share of what was left of the month when it began, so the line says the same thing the student did this week.
 * Over is said plainly ("€12 over"); equal reads "on plan".
 *
 * An envelope with nothing left of its month (`usedUp`) has no share to compare with, so it says that instead of
 * "€0 planned": "Nothing left this month · €6 spent · €6 over", or "Nothing left this month · €0 spent".
 */
export function weekLine(e: EnvelopeWeek, usedUp = false, lang: Language = 'en'): string {
  const text = MESSAGES[lang].checkIn.line;
  const { locale } = LANGUAGES[lang];
  const planned = formatWeekAmount(e.weekShareMinor, locale).text;
  const spent = formatWeekAmount(e.spentThisWeekMinor, locale).text;
  const difference = e.weekShareMinor - e.spentThisWeekMinor;
  // formatWeekAmount's text is the absolute value, so the sign only decides the word.
  const amount = formatWeekAmount(difference, locale).text;
  if (usedUp) return difference < 0 ? text.usedUpOver(spent, amount) : text.usedUp(spent);
  const verdict = difference === 0 ? text.onPlan : difference > 0 ? text.under(amount) : text.over(amount);
  return text.planned(planned, spent, verdict);
}

/**
 * The week in one number, the "This week" Home shows, in `lang`: "In total: €145 to spend this week", or "In total:
 * €36 over this week" when the month has less left than the week has already spent.
 */
export function weekTotalLine(totalMinor: Minor, lang: Language = 'en'): string {
  const text = MESSAGES[lang].checkIn.total;
  const { text: amount, over } = formatWeekAmount(totalMinor, LANGUAGES[lang].locale);
  return over ? text.over(amount) : text.toSpend(amount);
}
