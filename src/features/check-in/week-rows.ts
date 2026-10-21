import type { Plan } from '@/db/types';
import type { EnvelopeWeek } from '@/lib/budget';

/** One row of "This week against your plan": an envelope's week, and whether its month has nothing left. */
export type WeekRow = EnvelopeWeek & { usedUp: boolean };

/**
 * The rows the check-in lists: every envelope with a monthly amount above €0, whatever its share of the week. An
 * envelope that is spent up (or over) for the month has a share of €0, and is listed all the same, as "used up", so
 * the page agrees with Home about what is left. A category without an envelope, or an envelope at €0, is listed only
 * when something was spent on it this week.
 */
export function weekRows(plan: Plan, envelopes: EnvelopeWeek[]): WeekRow[] {
  const monthly = new Map(plan.envelopes.map((e) => [e.categoryId, e.monthlyMinor]));
  return envelopes.flatMap((e): WeekRow[] => {
    const planned = (monthly.get(e.categoryId) ?? 0) > 0;
    if (!planned && e.spentThisWeekMinor <= 0) return [];
    return [{ ...e, usedUp: planned && e.weekShareMinor === 0 }];
  });
}
