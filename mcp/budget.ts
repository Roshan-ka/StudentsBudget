import type { BackupData } from '@/db/bulk';
import { monthStatus, weekToSpend } from '@/lib/budget';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

// The app's own budget maths, run on a phone's data (a backup now, the account in M2.2). Node loads these `@/` imports
// through ./app-imports.ts, so whoever imports this file registers that first.

export type BudgetFigures = {
  month: IsoMonth;
  /** Planned less spent over the month's envelopes, as Home's "left this month"; below zero when over. */
  leftMinor: Minor;
  envelopes: { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[];
  /** Home's "This week": the week's share of what is left, less this week's spending. */
  week: { start: IsoDate; end: IsoDate; leftMinor: Minor };
};

/** This month's figures on `today`, as Home shows them; null before a plan exists. */
export function budgetFigures(data: BackupData, today: IsoDate): BudgetFigures | null {
  if (data.plan === null) return null;
  const month = monthOf(today);
  const envelopes = monthStatus(data.plan, data.entries, month);
  const week = weekToSpend(data.plan, data.entries, today);
  return {
    month,
    leftMinor: envelopes.reduce((n, e) => n + e.plannedMinor - e.spentMinor, 0),
    envelopes,
    week: { start: week.weekStart, end: week.weekEnd, leftMinor: week.totalMinor },
  };
}
