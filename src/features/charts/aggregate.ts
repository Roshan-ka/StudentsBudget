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
 * One row per category that has spending or a planned amount. `plannedMinor` is the envelope for a flexible
 * category (the same prorated amount home shows, so the month of setup is only planned from the setup day on),
 * the plan's monthly amount for a fixed one, and null for a category the plan does not cover. A category
 * planned at €0 and never used is left out. Ties in spending go to the larger plan, then to the order of the
 * built-in categories.
 */
export function spendingByCategory(
  entries: Entry[],
  plan: Plan,
  month: IsoMonth,
): { categoryId: string; spentMinor: Minor; plannedMinor: Minor | null }[] {
  const spent = spentByCategory(entries, month);

  const planned = new Map<string, Minor>();
  for (const f of plan.fixed) planned.set(f.categoryId, f.monthlyMinor);
  // `monthStatus` only counts spending from the setup day on; its planned amount is the one home uses.
  for (const status of monthStatus(plan, entries, month)) planned.set(status.categoryId, status.plannedMinor);

  const ids = new Set<string>([...spent.keys(), ...[...planned].filter(([, minor]) => minor > 0).map(([id]) => id)]);
  return [...ids]
    .map((categoryId) => ({
      categoryId,
      spentMinor: spent.get(categoryId) ?? 0,
      plannedMinor: planned.get(categoryId) ?? null,
    }))
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
