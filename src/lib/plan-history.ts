import type { Amount, OneOff, Plan } from '@/db/types';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

// Plan history (docs/superpowers/plans/2026-11-10-plan-history.md, Roshan's decisions, 10-11-2026): each month keeps
// the plan as it stood at its end, so an edit changes the current month only, and a past month is measured against
// its own plan. Months with no history (everything before it shipped) use the current plan, as before.

/**
 * A month's plan: only its money parts. Lines carry no schedule: watermarks and accounts are today's business, and the
 * poster keeps using the current plan. `createdOn` and `cityId` stay on the plan.
 */
export type PlanMonth = {
  month: IsoMonth;
  incomes: Amount[];
  fixed: Amount[];
  oneOffs: OneOff[];
  envelopes: Amount[];
  spendingBudgetMinor?: Minor;
};

const amountOf = ({ categoryId, monthlyMinor }: Amount): Amount => ({ categoryId, monthlyMinor });

/** `plan`'s money parts, as the row for `month`. */
export function planMonthOf(plan: Plan, month: IsoMonth): PlanMonth {
  return {
    month,
    incomes: plan.incomes.map(amountOf),
    fixed: plan.fixed.map(amountOf),
    oneOffs: plan.oneOffs.map((oneOff) => ({ ...oneOff })),
    envelopes: plan.envelopes.map(amountOf),
    ...(plan.spendingBudgetMinor === undefined ? {} : { spendingBudgetMinor: plan.spendingBudgetMinor }),
  };
}

/** The row a month uses: its own, else the latest one before it; none when no row is at or before it. */
export function planMonthFor(history: readonly PlanMonth[], month: IsoMonth): PlanMonth | undefined {
  let found: PlanMonth | undefined;
  for (const row of history) {
    if (row.month <= month && (found === undefined || row.month > found.month)) found = row;
  }
  return found;
}

/**
 * The plan `month` is measured against. The current month and later use `plan` itself. An earlier month uses the
 * money parts of its row (`planMonthFor`) over `plan`'s other fields; with no row at or before it, `plan` as it is.
 * A month before `plan.createdOn` still has no plan: callers keep their own checks.
 */
export function planForMonth(plan: Plan, history: readonly PlanMonth[], month: IsoMonth, today: IsoDate): Plan {
  if (month >= monthOf(today)) return plan;
  const row = planMonthFor(history, month);
  if (row === undefined) return plan;
  // The month's budget, or none when its row had none: never today's.
  const base: Plan = { ...plan };
  delete base.spendingBudgetMinor;
  return {
    ...base,
    incomes: row.incomes.map(amountOf),
    fixed: row.fixed.map(amountOf),
    oneOffs: row.oneOffs.map((oneOff) => ({ ...oneOff })),
    envelopes: row.envelopes.map(amountOf),
    ...(row.spendingBudgetMinor === undefined ? {} : { spendingBudgetMinor: row.spendingBudgetMinor }),
  };
}
