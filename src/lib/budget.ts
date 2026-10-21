import type { City } from '@/data/cities';
import { CATEGORIES } from '@/data/categories';
import type { Amount, Entry, OneOff, Plan, PlanLine } from '@/db/types';
import type { IsoDate, IsoMonth } from './dates';
import { addDays, firstOfMonth, monthOf, monthsBetween, weekInMonth, weeksLeftInMonth } from './dates';
import type { Minor } from './money';

const sum = (values: Minor[]): Minor => values.reduce((total, value) => total + value, 0);

/**
 * What to put aside in `month` so a one-off cost is covered by its due month.
 * Spread evenly (rounded up) from the created month up to, not including, the due month.
 */
export function setAsideMonthly(o: OneOff, month: IsoMonth): Minor {
  // 'YYYY-MM' strings sort chronologically, so plain comparison is enough.
  if (month < o.createdMonth || month >= o.dueMonth) return 0;
  const n = Math.max(1, monthsBetween(o.createdMonth, o.dueMonth));
  return Math.ceil(o.amountMinor / n);
}

export type PlanSummary = {
  incomeMinor: Minor;
  fixedMinor: Minor;
  setAsideMinor: Minor;
  availableMinor: Minor;
  envelopesMinor: Minor;
  overByMinor: Minor;
};

/** A line whose schedule is paused is not part of the plan for now. */
const unpaused = (lines: PlanLine[]): PlanLine[] => lines.filter((line) => !line.schedule?.paused);

export function planSummary(plan: Plan, month: IsoMonth): PlanSummary {
  const incomeMinor = sum(unpaused(plan.incomes).map((a) => a.monthlyMinor));
  const fixedMinor = sum(unpaused(plan.fixed).map((a) => a.monthlyMinor));
  const setAsideMinor = sum(plan.oneOffs.map((o) => setAsideMonthly(o, month)));
  const availableMinor = incomeMinor - fixedMinor - setAsideMinor;
  const envelopesMinor = sum(plan.envelopes.map((a) => a.monthlyMinor));
  return {
    incomeMinor,
    fixedMinor,
    setAsideMinor,
    availableMinor,
    envelopesMinor,
    overByMinor: Math.max(0, envelopesMinor - availableMinor),
  };
}

export type EnvelopeWeek = {
  categoryId: string;
  weekShareMinor: Minor;
  spentThisWeekMinor: Minor;
  safeMinor: Minor;
};

/** A week's range, what is left to spend in it in total, and each envelope's share of it. */
export type WeekToSpend = { weekStart: IsoDate; weekEnd: IsoDate; totalMinor: Minor; envelopes: EnvelopeWeek[] };

/** The expenses that count against an envelope: type 'expense' only, in EUR. */
function expensesIn(entries: Entry[], categoryId: string): { date: IsoDate; eurMinor: Minor }[] {
  return entries.flatMap((e) =>
    e.type === 'expense' && e.categoryId === categoryId ? [{ date: e.date, eurMinor: e.eurMinor }] : [],
  );
}

const FLEXIBLE = CATEGORIES.filter((c) => c.kind === 'flexible');

const ORDER = new Map(CATEGORIES.map((c) => [c.id, c.order]));
const orderOf = (categoryId: string): number => ORDER.get(categoryId) ?? Number.MAX_SAFE_INTEGER;

/**
 * The plan's envelopes and a €0 row for each flexible category it has none for, all in category order, so a plan
 * saved with the original six does not list Other before the categories added later. Spending in a category the
 * plan does not know (one added after it was saved) still counts, against nothing.
 */
function envelopesOf(plan: Plan): Amount[] {
  const planned = new Set(plan.envelopes.map((e) => e.categoryId));
  const missing = FLEXIBLE.filter((c) => !planned.has(c.id)).map(
    (c): Amount => ({ categoryId: c.id, monthlyMinor: 0 }),
  );
  return [...plan.envelopes, ...missing].sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId));
}

/**
 * The categories `weekToSpend` and `monthStatus` measure: the plan's envelopes and every other flexible category.
 * Rent and the other fixed costs are not among them.
 */
export function envelopeCategoryIds(plan: Plan): Set<string> {
  return new Set(envelopesOf(plan).map((e) => e.categoryId));
}

/**
 * The first day spending counts in `month`: the 1st, except in the month the plan was set up, which starts on the
 * setup day. Spending before it does not count; the monthly amounts themselves are always whole.
 */
function spendingStart(plan: Plan, month: IsoMonth): IsoDate {
  const first = firstOfMonth(month);
  // ISO date strings sort chronologically, so plain comparison is enough.
  return monthOf(plan.createdOn) === month && plan.createdOn > first ? plan.createdOn : first;
}

/** The euro amount of the expenses dated from `from` to `to`, both days included. */
function spentBetween(expenses: { date: IsoDate; eurMinor: Minor }[], from: IsoDate, to: IsoDate): Minor {
  return sum(expenses.filter((x) => x.date >= from && x.date <= to).map((x) => x.eurMinor));
}

/** The euro amount of the expenses dated after `after`, within `month`. */
function spentAfterIn(expenses: { date: IsoDate; eurMinor: Minor }[], after: IsoDate, month: IsoMonth): Minor {
  return sum(expenses.filter((x) => x.date > after && monthOf(x.date) === month).map((x) => x.eurMinor));
}

/** One envelope's whole month as `weekToSpend` and `weekAllowance` read it, for the week containing a day. */
type EnvelopeMonth = {
  categoryId: string;
  monthlyMinor: Minor;
  /** Spent from the first counting day of the month up to the day before the week. */
  spentBeforeMinor: Minor;
  /** Spent in the week itself, from the first counting day on. */
  spentThisWeekMinor: Minor;
  /** Spent after the week, later in the month (an expense dated ahead of today). */
  spentLaterMinor: Minor;
};

/**
 * The week containing `today`, cut at the month's edges, and each envelope's month around it. `budgeted` is false
 * for a week that ended before the setup day: it had no budget. `weeksLeft` is the Monday–Sunday weeks left in the
 * month, this one included.
 */
function monthAround(plan: Plan, entries: Entry[], today: IsoDate) {
  const { start: weekStart, end: weekEnd } = weekInMonth(today);
  const month = monthOf(today);
  const start = spendingStart(plan, month);
  const dayBeforeWeek = addDays(weekStart, -1);
  const weekFrom = weekStart > start ? weekStart : start;

  const rows = envelopesOf(plan).map((e): EnvelopeMonth => {
    const expenses = expensesIn(entries, e.categoryId);
    return {
      categoryId: e.categoryId,
      monthlyMinor: e.monthlyMinor,
      spentBeforeMinor: spentBetween(expenses, start, dayBeforeWeek),
      spentThisWeekMinor: spentBetween(expenses, weekFrom, weekEnd),
      spentLaterMinor: spentAfterIn(expenses, weekEnd, month),
    };
  });
  return { weekStart, weekEnd, budgeted: weekEnd >= start, weeksLeft: weeksLeftInMonth(today), rows };
}

/** An envelope's share of the week: its month's amount less what was spent before the week, split over the weeks left. */
const shareOf = (leftMinor: Minor, weeksLeft: number): Minor => Math.max(0, Math.round(leftMinor / weeksLeft));

/**
 * "This week" on Home, and each envelope's week in the check-in. What is left of the month at the start of the week
 * (the monthly amounts minus what was spent before it) is split evenly over the Monday–Sunday weeks left in the
 * month, this one included (`weeksLeftInMonth`). What was spent this week comes off that, so a bad week lowers the
 * weeks after it and the total can go negative. An expense dated later in the month comes off what is left too, as it
 * does in "Left to spend this month", so this week's total is never more than what the month has left. In the month of
 * setup spending counts from the setup day, and the monthly amounts are whole all the same. An envelope's share never
 * goes below 0, but its `safeMinor` can.
 */
export function weekToSpend(plan: Plan, entries: Entry[], today: IsoDate): WeekToSpend {
  const { weekStart, weekEnd, budgeted, weeksLeft, rows } = monthAround(plan, entries, today);

  const envelopes = rows.map((row): EnvelopeWeek => {
    const weekShareMinor = budgeted
      ? shareOf(row.monthlyMinor - row.spentBeforeMinor - row.spentLaterMinor, weeksLeft)
      : 0;
    return {
      categoryId: row.categoryId,
      weekShareMinor,
      spentThisWeekMinor: row.spentThisWeekMinor,
      safeMinor: weekShareMinor - row.spentThisWeekMinor,
    };
  });

  // The total is worked out from the whole month's amounts, not added up from the shares: an envelope that is used
  // up has a share of 0, but its overspending still comes off what is left.
  const leftMinor = sum(rows.map((row) => row.monthlyMinor - row.spentBeforeMinor - row.spentLaterMinor));
  const spentThisWeekMinor = sum(rows.map((row) => row.spentThisWeekMinor));
  const totalMinor = budgeted ? Math.round(leftMinor / weeksLeft) - spentThisWeekMinor : 0;
  return {
    weekStart,
    weekEnd,
    // A small negative amount rounds to -0, which would read as a negative zero.
    totalMinor: totalMinor === 0 ? 0 : totalMinor,
    envelopes,
  };
}

/**
 * What the week containing `day` had to spend when it began: what was left of the month then (the monthly amounts
 * minus what was spent before the week, from the setup day in the month of setup), split over the weeks left. It is
 * the "This week" number Home showed on the Monday, before anything was spent in the week. It reads only spending
 * before the week, so an expense dated later does not change it. It is negative when the month was already
 * overspent, and 0 for a week that ended before the setup day. The badges' week records are measured against it.
 */
export function weekAllowance(plan: Plan, entries: Entry[], day: IsoDate): Minor {
  const { budgeted, weeksLeft, rows } = monthAround(plan, entries, day);
  if (!budgeted) return 0;
  const allowance = Math.round(sum(rows.map((row) => row.monthlyMinor - row.spentBeforeMinor)) / weeksLeft);
  return allowance === 0 ? 0 : allowance;
}

/**
 * Planned and spent per envelope for one calendar month: the plan's envelopes in their order, then a €0 row for
 * each other flexible category. Planned is the whole monthly amount, in the month of setup too; spending counts from
 * the setup day on in that month.
 */
export function monthStatus(
  plan: Plan,
  entries: Entry[],
  month: IsoMonth,
): { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[] {
  const start = spendingStart(plan, month);
  return envelopesOf(plan).map((e) => ({
    categoryId: e.categoryId,
    plannedMinor: e.monthlyMinor,
    spentMinor: sum(
      expensesIn(entries, e.categoryId)
        .filter((x) => monthOf(x.date) === month && x.date >= start)
        .map((x) => x.eurMinor),
    ),
  }));
}

export type RangeWarning = { categoryId: string; typicalMinMinor: Minor; typicalMaxMinor: Minor };

const FLEXIBLE_IDS = new Set(FLEXIBLE.map((c) => c.id));

/**
 * Flexible envelopes planned below what the city's students typically spend.
 * The rent range is information for setup step 1 and never produces a warning.
 */
export function rangeWarnings(plan: Plan, city: City): RangeWarning[] {
  return plan.envelopes.flatMap((e) => {
    if (!FLEXIBLE_IDS.has(e.categoryId)) return [];
    const range = city.ranges.find((r) => r.categoryId === e.categoryId);
    if (!range || e.monthlyMinor >= range.minMinor) return [];
    return [{ categoryId: e.categoryId, typicalMinMinor: range.minMinor, typicalMaxMinor: range.maxMinor }];
  });
}
