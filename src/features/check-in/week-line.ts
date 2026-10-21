import type { EnvelopeWeek } from '@/lib/budget';
import { formatWeekAmount } from '@/lib/week-amount';

/**
 * One envelope's week in a line: "€70 planned · €20 spent · €50 under". The week is compared with its own
 * share of what was left of the month when it began, so the line says the same thing the student did this week.
 * Over is said plainly ("€12 over"); equal reads "on plan".
 */
export function weekLine(e: EnvelopeWeek): string {
  const planned = formatWeekAmount(e.weekShareMinor).text;
  const spent = formatWeekAmount(e.spentThisWeekMinor).text;
  const difference = e.weekShareMinor - e.spentThisWeekMinor;
  // formatWeekAmount's text is the absolute value, so the sign only decides the word.
  const { text } = formatWeekAmount(difference);
  const verdict = difference === 0 ? 'on plan' : `${text} ${difference > 0 ? 'under' : 'over'}`;
  return `${planned} planned · ${spent} spent · ${verdict}`;
}
