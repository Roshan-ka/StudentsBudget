import { CATEGORIES } from '@/data/categories';
import type { Entry, Plan } from '@/db/types';
import { monthStatus } from '@/lib/budget';
import { monthOf, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

const ORDER = new Map(CATEGORIES.map((c) => [c.id, c.order]));

/** Position in the built-in list; a category that is not built in goes last. */
const orderOf = (categoryId: string): number => ORDER.get(categoryId) ?? Number.MAX_SAFE_INTEGER;

/** The month `by` months after `month` (before, when negative): "2026-12" and 1 give "2027-01". */
export function shiftMonth(month: IsoMonth, by: number): IsoMonth {
  const [year, monthNumber] = month.split('-').map(Number);
  // Counting months from year 0 keeps the arithmetic whole; Math.floor and the modulo handle negatives.
  const index = year * 12 + (monthNumber - 1) + by;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}`;
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

/**
 * What each expense category cost in `month`, against what the plan set aside for it, most spent first.
 * One row per category that has spending or a planned amount; a category planned at €0 and never used is left out.
 *
 * Spent and planned are like-for-like, and the same as home shows:
 * - A flexible category with an envelope takes both from `monthStatus`. In the month of setup that is the envelope
 *   from the setup day on and only the spending from the setup day on; before it nothing is planned or counted.
 * - A fixed category is planned at the plan's monthly amount, not prorated, and counts the whole month's spending
 *   (rent paid on the 1st is still rent).
 * - Any other category has no plan (`plannedMinor` null) and counts the whole month.
 * - A month before the setup month has no plan at all: `plannedMinor` is null for every category.
 *
 * Ties in spending go to the larger plan, then to the order of the built-in categories.
 */
export function spendingByCategory(
  entries: Entry[],
  plan: Plan,
  month: IsoMonth,
): { categoryId: string; spentMinor: Minor; plannedMinor: Minor | null }[] {
  const spent = spentByCategory(entries, month);
  const planned = new Map<string, Minor>();

  // 'YYYY-MM' strings sort chronologically, so plain comparison is enough.
  if (month >= monthOf(plan.createdOn)) {
    for (const f of plan.fixed) planned.set(f.categoryId, f.monthlyMinor);
    for (const status of monthStatus(plan, entries, month)) {
      planned.set(status.categoryId, status.plannedMinor);
      spent.set(status.categoryId, status.spentMinor);
    }
  }

  return [...new Set([...spent.keys(), ...planned.keys()])]
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

/** The income of `month` per source (income category), largest first; ties go to the built-in category order. */
export function incomeBySource(entries: Entry[], month: IsoMonth): { categoryId: string; amountMinor: Minor }[] {
  const totals = new Map<string, Minor>();
  for (const e of entries) {
    if (e.type === 'income' && monthOf(e.date) === month) addTo(totals, e.categoryId, e.eurMinor);
  }
  return [...totals]
    .map(([categoryId, amountMinor]) => ({ categoryId, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor || orderOf(a.categoryId) - orderOf(b.categoryId));
}

/**
 * What one category cost in each of the `count` months up to and including `endMonth`, oldest first.
 * A month with no spending is there with 0, so the bars keep their spacing.
 */
export function categoryHistory(
  entries: Entry[],
  categoryId: string,
  endMonth: IsoMonth,
  count = 6,
): { month: IsoMonth; spentMinor: Minor }[] {
  const totals = new Map<IsoMonth, Minor>();
  for (const e of entries) {
    if (e.type === 'expense' && e.categoryId === categoryId) addTo(totals, monthOf(e.date), e.eurMinor);
  }
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(endMonth, i - (count - 1));
    return { month, spentMinor: totals.get(month) ?? 0 };
  });
}
