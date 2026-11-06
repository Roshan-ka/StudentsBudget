import type { Entry, Plan } from '@/db/types';
import { monthStatus } from '@/lib/budget';
import { monthOf, monthsBetween, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

const sum = (values: Minor[]): Minor => values.reduce((total, value) => total + value, 0);

export type RecapRow = { categoryId: string; plannedMinor: Minor; spentMinor: Minor };

/**
 * How one calendar month went against the envelopes: planned and spent per envelope, and what is left over in total
 * (negative when more was spent than planned). It uses `monthStatus`, so the month of setup counts whole, its plan and
 * its spending.
 */
export function monthRecap(plan: Plan, entries: Entry[], month: IsoMonth): { rows: RecapRow[]; leftoverMinor: Minor } {
  const rows = monthStatus(plan, entries, month).map(
    ({ categoryId, plannedMinor, spentMinor }): RecapRow => ({ categoryId, plannedMinor, spentMinor }),
  );
  return { rows, leftoverMinor: sum(rows.map((r) => r.plannedMinor)) - sum(rows.map((r) => r.spentMinor)) };
}

/**
 * The months that are over, from the month of setup up to the one before today's, newest first.
 * The month of `today` is still running, so it has no recap yet.
 */
export function completedMonths(startedOn: IsoDate, today: IsoDate): IsoMonth[] {
  const current = monthOf(today);
  const count = Math.max(0, monthsBetween(monthOf(startedOn), current));
  return Array.from({ length: count }, (_, i) => shiftMonth(current, -(i + 1)));
}
