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
 * A suggested amount for every flexible category, to start the month from.
 *
 * A category with a city range starts at the middle of it, to the nearest €5. One without starts at what was spent
 * on it the month before, to the nearest €5, or at €0 when nothing was spent. When that is more than the plan has
 * available, the ranged categories drop to the bottom of their ranges, and when that is still too much every amount
 * is scaled down in proportion and rounded down to €5. With nothing available every amount is €0.
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

  let rows = FLEXIBLE_CATEGORIES.map((category): Suggestion[number] => {
    const range = city.ranges.find((r) => r.categoryId === category.id);
    if (range) {
      return {
        categoryId: category.id,
        amountMinor: roundToStep((range.minMinor + range.maxMinor) / 2),
        basis: 'city',
        range,
      };
    }
    const spent = lastMonth.get(category.id) ?? 0;
    // Any spending keeps the basis, even when it rounds to €0: the row still says where its amount comes from.
    return spent > 0
      ? { categoryId: category.id, amountMinor: roundToStep(spent), basis: 'last-month' }
      : { categoryId: category.id, amountMinor: 0, basis: 'none' };
  });

  if (availableMinor <= 0) {
    rows = rows.map((row) => ({ ...row, amountMinor: 0 }));
  } else if (sum(rows) > availableMinor) {
    rows = rows.map((row) => (row.range ? { ...row, amountMinor: row.range.minMinor } : row));
    const total = sum(rows);
    if (total > availableMinor) {
      // Each share is at most its exact proportion, so the shares together cannot pass what is available.
      rows = rows.map((row) => ({
        ...row,
        amountMinor: Math.floor((row.amountMinor * availableMinor) / (total * STEP)) * STEP,
      }));
    }
  }

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
