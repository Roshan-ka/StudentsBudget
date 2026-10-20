import type { City } from '@/data/cities';
import { CATEGORIES } from '@/data/categories';
import type { Amount, Entry, OneOff, Plan, PlanLine } from '@/db/types';
import type { IsoDate, IsoMonth } from './dates';
import { addDays, daysBetween, daysInMonth, firstOfMonth, monthOf, monthsBetween, weekInMonth } from './dates';
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
 * The first day the envelopes accrue in `month`: the 1st, except in the month the plan was set up,
 * which starts on the setup day. Days before it have no budget, and spending before it does not count.
 */
function accrualStart(plan: Plan, month: IsoMonth): IsoDate {
  const first = firstOfMonth(month);
  // ISO date strings sort chronologically, so plain comparison is enough.
  return monthOf(plan.createdOn) === month && plan.createdOn > first ? plan.createdOn : first;
}

/**
 * "Safe to spend this week". Each envelope's monthly amount accrues per calendar day, always over
 * the whole month's days, but in the month of setup only from the setup day on. The safe amount is
 * what has accrued up to the end of this week minus everything spent so far this month, so a bad
 * week carries into the next and the amount can go negative.
 */
export function safeToSpend(
  plan: Plan,
  entries: Entry[],
  today: IsoDate,
): { weekStart: IsoDate; weekEnd: IsoDate; totalMinor: Minor; envelopes: EnvelopeWeek[] } {
  const { start: weekStart, end: weekEnd } = weekInMonth(today);
  const month = monthOf(today);
  const days = daysInMonth(month);
  const start = accrualStart(plan, month);
  // The part of this week that has a budget; empty (from > to) for a week that ended before setup.
  const weekFrom = weekStart > start ? weekStart : start;
  const spentBetween = (expenses: { date: IsoDate; eurMinor: Minor }[], from: IsoDate, to: IsoDate) =>
    sum(expenses.filter((x) => x.date >= from && x.date <= to).map((x) => x.eurMinor));

  const envelopes = envelopesOf(plan).map((e): EnvelopeWeek => {
    const expenses = expensesIn(entries, e.categoryId);
    const through = weekEnd < start ? 0 : Math.round((e.monthlyMinor * (daysBetween(start, weekEnd) + 1)) / days);
    const before = weekStart > start ? Math.round((e.monthlyMinor * daysBetween(start, weekStart)) / days) : 0;
    return {
      categoryId: e.categoryId,
      weekShareMinor: through - before,
      spentThisWeekMinor: spentBetween(expenses, weekFrom, weekEnd),
      safeMinor: through - spentBetween(expenses, start, weekEnd),
    };
  });

  return {
    weekStart,
    weekEnd,
    totalMinor: sum(envelopes.map((e) => e.safeMinor)),
    envelopes,
  };
}

/**
 * Planned and spent per envelope for one calendar month: the plan's envelopes in their order, then a €0 row for
 * each other flexible category. In the month of setup only the days from the setup day on are planned and counted.
 */
export function monthStatus(
  plan: Plan,
  entries: Entry[],
  month: IsoMonth,
): { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[] {
  const days = daysInMonth(month);
  const start = accrualStart(plan, month);
  const lastDay = addDays(firstOfMonth(month), days - 1);
  return envelopesOf(plan).map((e) => ({
    categoryId: e.categoryId,
    // A full month is exactly the monthly amount: days / days.
    plannedMinor: Math.round((e.monthlyMinor * (daysBetween(start, lastDay) + 1)) / days),
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
