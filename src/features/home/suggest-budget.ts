import type { City, CityRange } from '@/data/cities';
import type { Amount, Entry, Plan } from '@/db/types';
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
 * `rows` (from `startingRows`) split across `budgetMinor` for setup, so that nearly all of a budget is used.
 *
 * Each row has a low end (the bottom of its city range) and a high end (the amount it starts at, the middle of the
 * range); a row without a range has both at its amount. Three cases:
 * - At or above every high end: the amounts as they are, and the rest stays unassigned.
 * - Below every low end: `fitTo`, which scales all of them down in proportion.
 * - In between, every row sits the same share of the way from its low end to its high end, t = (budget - sum of low
 *   ends) / (sum of high ends - sum of low ends). Each amount is rounded down to €5 and the €5 steps that are left go
 *   to the rows with the largest remainders, ties in row order, so the total is the budget rounded down to €5 and no
 *   row leaves its range. Money stays whole numbers: the shares are compared as fractions with a common
 *   denominator, never as floats.
 *
 * It relies on every low and high end being a multiple of €5 (the city ranges are; a test pins it). Home's
 * `suggestBudget` uses it too.
 */
export function splitBudget(rows: Suggestion, budgetMinor: Minor): Suggestion {
  const highs = rows.map((row) => row.amountMinor);
  const lows = rows.map((row) => Math.min(row.range?.minMinor ?? row.amountMinor, row.amountMinor));
  const lowTotal = lows.reduce((total, minor) => total + minor, 0);
  const highTotal = highs.reduce((total, minor) => total + minor, 0);
  if (budgetMinor < lowTotal || budgetMinor >= highTotal) return fitTo(rows, budgetMinor);

  // Row i gets `shares[i] / span` (cents): low + (budget - lowTotal) * (high - low) / span, over the same `span`.
  const span = highTotal - lowTotal;
  const shares = lows.map((low, i) => low * span + (budgetMinor - lowTotal) * (highs[i] - low));
  const stepShare = span * STEP;
  const whole = shares.map((share) => Math.floor(share / stepShare));
  const remainder = shares.map((share, i) => share - whole[i] * stepShare);
  const spare = Math.floor(budgetMinor / STEP) - whole.reduce((total, steps) => total + steps, 0);
  const next = rows
    .map((_, i) => i)
    .sort((a, b) => remainder[b] - remainder[a] || a - b)
    .slice(0, spare);

  return rows.map((row, i) => ({ ...row, amountMinor: (whole[i] + (next.includes(i) ? 1 : 0)) * STEP }));
}

/**
 * What setup suggests for each of the `setupIds` envelopes as the person fills them in, from the everyday budget
 * `budgetMinor`. An envelope is *set* once its amount is above €0, whoever typed it; the rest are not.
 *
 * For one envelope, what the other set envelopes use (any of `envelopes`, including ones outside `setupIds`) is taken
 * off the budget, and the rest is split by `splitBudget` between this envelope and the setup envelopes that are not
 * set. So an envelope's suggestion is the same whether or not it is set itself: typing into it changes the others'
 * suggestions, not its own. Nothing is left to suggest (the others use all of it, or more) at €0, and nothing at all
 * is suggested without a budget (an empty map).
 */
export function liveSuggestions(
  envelopes: Amount[],
  setupIds: readonly string[],
  budgetMinor: Minor,
  city: City,
): Map<string, Minor> {
  const suggested = new Map<string, Minor>();
  if (!(budgetMinor > 0)) return suggested;

  const amountOf = (categoryId: string): Minor =>
    Math.max(0, envelopes.find((a) => a.categoryId === categoryId)?.monthlyMinor ?? 0);
  const setMinor = envelopes.reduce((total, a) => total + Math.max(0, a.monthlyMinor), 0);
  const start = startingRows(city, new Map(), setupIds);

  for (const { categoryId } of start) {
    const othersMinor = setMinor - amountOf(categoryId);
    const group = start.filter((row) => row.categoryId === categoryId || amountOf(row.categoryId) <= 0);
    const split = splitBudget(group, Math.max(0, budgetMinor - othersMinor));
    suggested.set(categoryId, split.find((row) => row.categoryId === categoryId)?.amountMinor ?? 0);
  }
  return suggested;
}

/**
 * A suggested amount for every flexible category, to start the month from: `startingRows` for last month's
 * spending, split by `splitBudget` across `targetMinor`. That is what the plan has available, or the plan's everyday
 * budget when one is set and is less: the budget is what the person wants to spend, and more than is available
 * cannot be suggested.
 *
 * `unallocatedMinor` is what stays free for savings, out of what is available, so it includes what the budget leaves
 * unused. `availableMinor` can be zero or negative.
 */
export function suggestBudget(
  plan: Plan,
  city: City,
  entries: Entry[],
  month: IsoMonth,
): { rows: Suggestion; availableMinor: Minor; targetMinor: Minor; unallocatedMinor: Minor } {
  const { availableMinor } = planSummary(plan, month);
  const budgetMinor = plan.spendingBudgetMinor ?? 0;
  const targetMinor = budgetMinor > 0 ? Math.min(availableMinor, budgetMinor) : availableMinor;
  const lastMonth = spentIn(entries, shiftMonth(month, -1));
  const start = startingRows(city, lastMonth, FLEXIBLE_CATEGORIES.map((c) => c.id));
  const rows = splitBudget(start, targetMinor);

  return { rows, availableMinor, targetMinor, unallocatedMinor: Math.max(0, availableMinor - sum(rows)) };
}

/**
 * Whether Home should lead with the suggestion rather than tuck it behind a link: in the first week of the
 * month, when a plan is made, or whenever the envelopes add up to more than what is available.
 */
export function suggestionIsProminent(plan: Plan, today: IsoDate): boolean {
  const dayOfMonth = Number(today.slice(8, 10));
  return dayOfMonth <= 7 || planSummary(plan, monthOf(today)).overByMinor > 0;
}
