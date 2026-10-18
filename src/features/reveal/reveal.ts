import { CATEGORIES } from '@/data/categories';
import type { Entry, Guess, Plan } from '@/db/types';
import { shiftMonth } from '@/features/charts/aggregate';
import { monthStatus } from '@/lib/budget';
import { addDays, daysBetween, monthOf, monthsBetween, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';

/** Days of logging before the guesses are compared with what was spent. */
export const REVEAL_MIN_DAYS = 21;

/** What spent so far is scaled to, so a 22-day window and a 40-day window read as the same kind of number. */
const DAYS_PER_MONTH = 30;

const ORDER = new Map(CATEGORIES.map((c) => [c.id, c.order]));

/** Position in the built-in list; a category that is not built in goes last. */
const orderOf = (categoryId: string): number => ORDER.get(categoryId) ?? Number.MAX_SAFE_INTEGER;

const sum = (values: Minor[]): Minor => values.reduce((total, value) => total + value, 0);

/** The first day the guesses can be compared with reality. */
export function unlockOn(startedOn: IsoDate): IsoDate {
  return addDays(startedOn, REVEAL_MIN_DAYS);
}

export type GuessRow = { categoryId: string; guessMinor: Minor; actualMonthlyMinor: Minor; diffMinor: Minor };

/**
 * Each guess next to what was really spent on that category, as a month of 30 days. Spending counts from the
 * setup day to today, both days included, and only expenses (not income or transfers).
 * `diffMinor` is actual minus guess, so positive means more was spent than guessed. Rows are ordered by the size
 * of the difference, biggest first, and ties keep the order of the built-in categories.
 */
export function guessVsReality(
  guesses: Guess[],
  entries: Entry[],
  startedOn: IsoDate,
  today: IsoDate,
): { unlocked: boolean; unlockOn: IsoDate; rows: GuessRow[] } {
  const unlockDate = unlockOn(startedOn);
  // At least one day, so a clock set behind the setup day gives 0 instead of a division by zero or a negative.
  const days = Math.max(1, daysBetween(startedOn, today) + 1);

  const spent = new Map<string, Minor>();
  for (const e of entries) {
    // ISO date strings sort chronologically, so plain comparison is enough.
    if (e.type !== 'expense' || e.date < startedOn || e.date > today) continue;
    spent.set(e.categoryId, (spent.get(e.categoryId) ?? 0) + e.eurMinor);
  }

  const rows = guesses.map((g): GuessRow => {
    const actualMonthlyMinor = Math.round(((spent.get(g.categoryId) ?? 0) * DAYS_PER_MONTH) / days);
    return {
      categoryId: g.categoryId,
      guessMinor: g.monthlyMinor,
      actualMonthlyMinor,
      diffMinor: actualMonthlyMinor - g.monthlyMinor,
    };
  });
  rows.sort((a, b) => Math.abs(b.diffMinor) - Math.abs(a.diffMinor) || orderOf(a.categoryId) - orderOf(b.categoryId));

  return { unlocked: today >= unlockDate, unlockOn: unlockDate, rows };
}

export type RecapRow = { categoryId: string; guessMinor: Minor; plannedMinor: Minor; spentMinor: Minor };

/**
 * How one calendar month went against the envelopes: planned and spent per envelope with the original guess
 * alongside, and what is left over in total (negative when more was spent than planned). It uses `monthStatus`,
 * so in the month of setup both planned and spent start on the setup day.
 */
export function monthRecap(
  guesses: Guess[],
  plan: Plan,
  entries: Entry[],
  month: IsoMonth,
): { rows: RecapRow[]; leftoverMinor: Minor } {
  const guessed = new Map(guesses.map((g) => [g.categoryId, g.monthlyMinor]));
  const rows = monthStatus(plan, entries, month).map(
    (s): RecapRow => ({
      categoryId: s.categoryId,
      guessMinor: guessed.get(s.categoryId) ?? 0,
      plannedMinor: s.plannedMinor,
      spentMinor: s.spentMinor,
    }),
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
