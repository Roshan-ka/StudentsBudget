import type { Entry, Plan } from '@/db/types';
import { FLEXIBLE_CATEGORIES, orderOf } from '@/features/entries/categories';
import { monthStatus } from '@/lib/budget';
import { monthOf, shiftMonth, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/** The months every chart looks at: `months` of them, ending on `endMonth`. */
export type Period = { endMonth: IsoMonth; months: 1 | 3 | 6 | 12 };

/** The months of a period, oldest first. */
export function monthsOf(p: Period): IsoMonth[] {
  return Array.from({ length: p.months }, (_, i) => shiftMonth(p.endMonth, i - (p.months - 1)));
}

/** Adds `amountMinor` to the total under `key`. */
function addTo(totals: Map<string, Minor>, key: string, amountMinor: Minor) {
  totals.set(key, (totals.get(key) ?? 0) + amountMinor);
}

/** Total euro spending per category in `month`. Transfers and income never count. */
function spentByCategory(entries: Entry[], month: IsoMonth): Map<string, Minor> {
  const totals = new Map<string, Minor>();
  for (const e of entries) {
    if (e.type === 'expense' && monthOf(e.date) === month) addTo(totals, e.categoryId, e.eurMinor);
  }
  return totals;
}

/** One category's spending against its plan; `plannedMinor` is null for a category with no plan. */
export type SpendingRow = { categoryId: string; spentMinor: Minor; plannedMinor: Minor | null };

/**
 * What each expense category cost in `month`, against what the plan set aside for it. One row for every category
 * that has spending or any plan (a planned amount of 0 included), in no particular order. Which rows are worth
 * showing is for the caller to decide, once the months of a period are added up.
 *
 * Spent and planned are the same as home shows:
 * - A flexible category takes both from `monthStatus`, which gives every flexible category a row: the plan's
 *   envelope, or €0 for one without an envelope. In the month of setup that is the whole envelope against only the
 *   spending from the setup day on, so the two are not like-for-like there; the charts say so in a note.
 * - A fixed category is planned at the plan's monthly amount, not prorated, and counts the whole month's spending
 *   (rent paid on the 1st is still rent). A fixed line whose schedule is paused is planned at 0.
 * - Any other category (a one-off cost, or a fixed one the plan has no line for) has no plan (`plannedMinor`
 *   null) and counts the whole month.
 * - A month before the setup month has no plan at all: `plannedMinor` is null for every category.
 */
function spendingRowsOf(entries: Entry[], plan: Plan, month: IsoMonth): SpendingRow[] {
  const spent = spentByCategory(entries, month);
  const planned = new Map<string, Minor>();

  // 'YYYY-MM' strings sort chronologically, so plain comparison is enough.
  if (month >= monthOf(plan.createdOn)) {
    // `budget.ts` plans every fixed line in full; a paused line is not part of the plan for now.
    for (const f of plan.fixed) planned.set(f.categoryId, f.schedule?.paused ? 0 : f.monthlyMinor);
    for (const status of monthStatus(plan, entries, month)) {
      planned.set(status.categoryId, status.plannedMinor);
      spent.set(status.categoryId, status.spentMinor);
    }
  }

  return [...new Set([...spent.keys(), ...planned.keys()])].map((categoryId) => ({
    categoryId,
    spentMinor: spent.get(categoryId) ?? 0,
    plannedMinor: planned.get(categoryId) ?? null,
  }));
}

/**
 * What each expense category cost over the months of `p`, against what the plan set aside for it, most spent first.
 * Spent and planned are each the sum of the months, every month worked out as `spendingRowsOf` describes: a
 * month before the setup month adds spending but no plan, and a category with no plan in any month of the period
 * keeps `plannedMinor` null. One row per category that has spending or a planned amount over the period; a category
 * planned at €0 and never used is left out.
 *
 * Ties in spending go to the larger plan, then to the order of the built-in categories.
 */
export function spendingByCategoryOver(entries: Entry[], plan: Plan, p: Period): SpendingRow[] {
  const spent = new Map<string, Minor>();
  const planned = new Map<string, Minor | null>();
  for (const month of monthsOf(p)) {
    for (const row of spendingRowsOf(entries, plan, month)) {
      addTo(spent, row.categoryId, row.spentMinor);
      const soFar = planned.get(row.categoryId) ?? null;
      planned.set(row.categoryId, row.plannedMinor === null ? soFar : (soFar ?? 0) + row.plannedMinor);
    }
  }

  return [...spent.keys()]
    .map((categoryId) => ({
      categoryId,
      spentMinor: spent.get(categoryId) ?? 0,
      plannedMinor: planned.get(categoryId) ?? null,
    }))
    .filter((row) => row.spentMinor > 0 || (row.plannedMinor ?? 0) > 0)
    .sort(
      (a, b) =>
        b.spentMinor - a.spentMinor ||
        (b.plannedMinor ?? -1) - (a.plannedMinor ?? -1) ||
        orderOf(a.categoryId) - orderOf(b.categoryId),
    );
}

const FLEXIBLE_IDS = new Set(FLEXIBLE_CATEGORIES.map((c) => c.id));

/**
 * The category the "over time" chart starts on, from `spending` ranked as `spendingByCategoryOver` ranks it: the top
 * flexible spender. With nothing flexible spent in the period, it is the top flexible spender of the chart's own
 * months (`windowSpending`, the same rows when the chart covers the period), so a month with nothing in it still opens
 * on a chart with columns. With nothing flexible spent there either, it is the flexible row with the largest plan, or
 * the first flexible category. A fixed cost such as rent comes in at the same amount every month, so its chart is a
 * flat line.
 */
export function defaultOverTimeCategory(spending: SpendingRow[], windowSpending: SpendingRow[] = spending): string {
  const topFlexible = (rows: SpendingRow[]) => rows.find((row) => FLEXIBLE_IDS.has(row.categoryId));
  const top = topFlexible(spending);
  if (top !== undefined && top.spentMinor > 0) return top.categoryId;
  const windowTop = topFlexible(windowSpending);
  if (windowTop !== undefined && windowTop.spentMinor > 0) return windowTop.categoryId;
  return top?.categoryId ?? FLEXIBLE_CATEGORIES[0].id;
}

/**
 * Whether any income or expense is logged in `months`. A transfer only moves money between accounts, so it is not
 * logged spending or income and does not count.
 */
export function hasEntriesIn(entries: Entry[], months: IsoMonth[]): boolean {
  const wanted = new Set(months);
  return entries.some((e) => e.type !== 'transfer' && wanted.has(monthOf(e.date)));
}

/** `spendingByCategoryOver` for a single month; `spendingRowsOf` has the rules for spent and planned. */
export function spendingByCategory(entries: Entry[], plan: Plan, month: IsoMonth): SpendingRow[] {
  return spendingByCategoryOver(entries, plan, { endMonth: month, months: 1 });
}

/** The income of `month` per source (income category), largest first; ties go to the built-in category order. */
export function incomeBySource(entries: Entry[], month: IsoMonth): { categoryId: string; amountMinor: Minor }[] {
  return incomeBySourceOver(entries, { endMonth: month, months: 1 });
}

/** The income over the months of `p` per source (income category), largest first; ties go to the built-in order. */
export function incomeBySourceOver(entries: Entry[], p: Period): { categoryId: string; amountMinor: Minor }[] {
  const months = new Set(monthsOf(p));
  const totals = new Map<string, Minor>();
  for (const e of entries) {
    if (e.type === 'income' && months.has(monthOf(e.date))) addTo(totals, e.categoryId, e.eurMinor);
  }
  return [...totals]
    .map(([categoryId, amountMinor]) => ({ categoryId, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor || orderOf(a.categoryId) - orderOf(b.categoryId));
}

/**
 * What one category cost in each month of `p`, oldest first. A month with no spending is there with 0, so the
 * columns keep their spacing.
 */
export function categoryOverPeriod(
  entries: Entry[],
  categoryId: string,
  p: Period,
): { month: IsoMonth; spentMinor: Minor }[] {
  const totals = new Map<IsoMonth, Minor>();
  for (const e of entries) {
    if (e.type === 'expense' && e.categoryId === categoryId) addTo(totals, monthOf(e.date), e.eurMinor);
  }
  return monthsOf(p).map((month) => ({ month, spentMinor: totals.get(month) ?? 0 }));
}

/**
 * Income minus expenses in each month of `p`, oldest first, from the euro amounts. A transfer between accounts is
 * neither (money that stays with you), so it is left out; a one-off cost is an expense like any other. A month
 * with nothing in it is there with zeros. `savedMinor` is negative in a month that spent more than it earned.
 */
export function savingsByMonth(
  entries: Entry[],
  p: Period,
): { month: IsoMonth; incomeMinor: Minor; expenseMinor: Minor; savedMinor: Minor }[] {
  const income = new Map<IsoMonth, Minor>();
  const expense = new Map<IsoMonth, Minor>();
  for (const e of entries) {
    if (e.type === 'income') addTo(income, monthOf(e.date), e.eurMinor);
    else if (e.type === 'expense') addTo(expense, monthOf(e.date), e.eurMinor);
  }
  return monthsOf(p).map((month) => {
    const incomeMinor = income.get(month) ?? 0;
    const expenseMinor = expense.get(month) ?? 0;
    return { month, incomeMinor, expenseMinor, savedMinor: incomeMinor - expenseMinor };
  });
}

/** The id of the row `topWithBucket` adds for everything it folds away. */
export const BUCKET_ID = 'everything-else';

/**
 * The `top` rows with the largest value (6 by default), largest first, then one more row, `BUCKET_ID`, that adds up
 * all the others: what a donut can carry. A bucket folds at least two rows: with `top + 1` rows or fewer there is no
 * bucket and the rows come back ranked, since a bucket of one row would only hide its name. The rows must hold
 * numbers (or null, for a number that is missing) next to their `categoryId`; the bucket has the sum of every one of
 * them, with a missing number left missing only when all of the folded rows lack it.
 */
export function topWithBucket<T extends { categoryId: string }>(
  rows: T[],
  valueOf: (r: T) => Minor,
  top = 6,
): T[] {
  // Array.sort is stable, so rows of equal value stay in the order they came in.
  const ranked = [...rows].sort((a, b) => valueOf(b) - valueOf(a));
  if (ranked.length <= top + 1) return ranked;

  const rest = ranked.slice(top);
  const bucket: Record<string, unknown> = { ...rest[0] };
  for (const key of Object.keys(bucket)) {
    const values = rest.map((row) => (row as Record<string, unknown>)[key]);
    if (values.every((v) => typeof v === 'number' || v === null)) {
      const numbers = values.filter((v): v is number => typeof v === 'number');
      bucket[key] = numbers.length === 0 ? null : numbers.reduce((total, v) => total + v, 0);
    }
  }
  bucket.categoryId = BUCKET_ID;
  return [...ranked.slice(0, top), bucket as T];
}
