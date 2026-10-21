import type { EnvelopeWeek } from '@/lib/budget';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

/**
 * One envelope's week in a line: "€70 planned · €20 spent · €50 under". The week is compared with its own
 * share of what was left of the month when it began, so the line says the same thing the student did this week.
 * Over is said plainly ("€12 over"); equal reads "on plan".
 *
 * An envelope with nothing left of its month (`usedUp`) has no share to compare with, so it says that instead of
 * "€0 planned": "Nothing left this month · €6 spent · €6 over", or "Nothing left this month · €0 spent".
 */
export function weekLine(e: EnvelopeWeek, usedUp = false): string {
  const planned = formatWeekAmount(e.weekShareMinor).text;
  const spent = formatWeekAmount(e.spentThisWeekMinor).text;
  const difference = e.weekShareMinor - e.spentThisWeekMinor;
  // formatWeekAmount's text is the absolute value, so the sign only decides the word.
  const { text } = formatWeekAmount(difference);
  const verdict = difference === 0 ? 'on plan' : `${text} ${difference > 0 ? 'under' : 'over'}`;
  if (usedUp) {
    return difference < 0
      ? `Nothing left this month · ${spent} spent · ${text} over`
      : `Nothing left this month · ${spent} spent`;
  }
  return `${planned} planned · ${spent} spent · ${verdict}`;
}

/**
 * The week in one number, the "This week" Home shows: "In total: €145 to spend this week", or "In total: €36 over
 * this week" when the month has less left than the week has already spent.
 */
export function weekTotalLine(totalMinor: Minor): string {
  const { text, over } = formatWeekAmount(totalMinor);
  return over ? `In total: ${text} over this week` : `In total: ${text} to spend this week`;
}
