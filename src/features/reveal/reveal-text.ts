import { parseISO } from 'date-fns';
import { firstOfMonth, monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

const dayAndMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });
const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });

/** "16 Oct". `parseISO` reads a date-only string as local midnight, so the day never shifts. */
export const formatDay = (date: IsoDate): string => dayAndMonth.format(parseISO(date));

/**
 * One finished month of the recap: "October 2026: €15 left over → savings", or "October 2026: €12 over plan". Calm
 * either way. The month the plan was set up in is planned in full, but only spending from the setup day counts, so
 * unless the plan was set up on the 1st its line says "(counted from 16 Oct)" and does not call what is left over
 * savings: part of that month's spending was never counted.
 */
export function recapLine(month: IsoMonth, leftoverMinor: Minor, createdOn: IsoDate): string {
  const partial = month === monthOf(createdOn) && createdOn !== firstOfMonth(month);
  const label = `${monthAndYear.format(parseISO(`${month}-01`))}${partial ? ` (counted from ${formatDay(createdOn)})` : ''}`;
  const { text } = formatWeekAmount(leftoverMinor);
  if (leftoverMinor > 0) return `${label}: ${text} left over${partial ? '' : ' → savings'}`;
  if (leftoverMinor < 0) return `${label}: ${text} over plan`;
  return `${label}: right on plan`;
}
