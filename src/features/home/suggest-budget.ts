import type { City, CityRange } from '@/data/cities';
import type { Entry, Plan } from '@/db/types';
import { FLEXIBLE_CATEGORIES } from '@/features/entries/categories';
import { planSummary } from '@/lib/budget';
import { monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/** One suggested envelope: where the amount comes from, and for a city amount the range it sits in. */
export type Suggestion = {
  categoryId: string;
  amountMinor: Minor;
  basis: 'city' | 'last-month' | 'none';
  range?: CityRange;
}[];

/** Every suggested amount is a whole €5: starting amounts round to the nearest, scaled-down ones round down. */
const STEP: Minor = 500;

/** To the nearest €5; exactly halfway goes up. */
const roundToStep = (minor: Minor): Minor => Math.round(minor / STEP) * STEP;

const sum = (rows: Suggestion): Minor => rows.reduce((total, row) => total + row.amountMinor, 0);

/** What each flexible category was spent on in `month`: expenses only, in EUR. */
function spentIn(entries: Entry[], month: IsoMonth): Map<string, Minor> {
  const spent = new Map<string, Minor>();
  for (const entry of entries) {
    if (entry.type !== 'expense' || monthOf(entry.date) !== month) continue;
    spent.set(entry.categoryId, (spent.get(entry.categoryId) ?? 0) + entry.eurMinor);
  }
  return spent;
}

/**
 * The amounts to start from, one row per id in `categoryIds` and in that order.
 *
 * A category with a city range starts at the middle of it, to the nearest €5. One without starts at what was spent
 * on it the month before (`lastMonthSpent`), to the nearest €5, or at €0 when nothing was spent.
 */
export function startingRows(
  city: City,
  lastMonthSpent: ReadonlyMap<string, Minor>,
  categoryIds: readonly string[],
): Suggestion {
  return categoryIds.map((categoryId): Suggestion[number] => {
    const range = city.ranges.find((r) => r.categoryId === categoryId);
    if (range) {
      return { categoryId, amountMinor: roundToStep((range.minMinor + range.maxMinor) / 2), basis: 'city', range };
    }
    const spent = lastMonthSpent.get(categoryId) ?? 0;
    // Any spending keeps the basis, even when it rounds to €0: the row still says where its amount comes from.
    return spent > 0
      ? { categoryId, amountMinor: roundToStep(spent), basis: 'last-month' }
      : { categoryId, amountMinor: 0, basis: 'none' };
  });
}

/**
 * `rows` made to fit `totalMinor`; rows that already fit come back as they are. When they are more than that, the
 * ranged categories drop to the bottom of their ranges, and when that is still too much every amount is scaled down
 * in proportion and rounded down to €5. With nothing to spend (`totalMinor` zero or negative) every amount is €0.
 */
export function fitTo(rows: Suggestion, totalMinor: Minor): Suggestion {
  if (totalMinor <= 0) return rows.map((row) => ({ ...row, amountMinor: 0 }));
  if (sum(rows) <= totalMinor) return rows;

  const minimums = rows.map((row) => (row.range ? { ...row, amountMinor: row.range.minMinor } : row));
  const total = sum(minimums);
  if (total <= totalMinor) return minimums;
  // Each share is at most its exact proportion, so the shares together cannot pass `totalMinor`.
  return minimums.map((row) => ({
    ...row,
    amountMinor: Math.floor((row.amountMinor * totalMinor) / (total * STEP)) * STEP,
  }));
}

/**
 * A suggested amount for every flexible category, to start the month from: `startingRows` for last month's
 * spending, fitted to what the plan has available.
 *
 * `unallocatedMinor` is what stays free for savings. `availableMinor` can be zero or negative.
 */
export function suggestBudget(
  plan: Plan,
  city: City,
  entries: Entry[],
  month: IsoMonth,
): { rows: Suggestion; availableMinor: Minor; unallocatedMinor: Minor } {
  const { availableMinor } = planSummary(plan, month);
  const lastMonth = spentIn(entries, shiftMonth(month, -1));
  const start = startingRows(city, lastMonth, FLEXIBLE_CATEGORIES.map((c) => c.id));
  const rows = fitTo(start, availableMinor);

  return { rows, availableMinor, unallocatedMinor: Math.max(0, availableMinor - sum(rows)) };
}

/**
 * Whether Home should lead with the suggestion rather than tuck it behind a link: in the first week of the
 * month, when a plan is made, or whenever the envelopes add up to more than what is available.
 */
export function suggestionIsProminent(plan: Plan, today: IsoDate): boolean {
  const dayOfMonth = Number(today.slice(8, 10));
  return dayOfMonth <= 7 || planSummary(plan, monthOf(today)).overByMinor > 0;
}
