import type { City } from '@/data/cities';
import { CATEGORIES } from '@/data/categories';
import type { Entry, OneOff, Plan } from '@/db/types';
import type { IsoDate, IsoMonth } from './dates';
import { daysBetween, daysInMonth, firstOfMonth, monthOf, monthsBetween, weekInMonth } from './dates';
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

export function planSummary(plan: Plan, month: IsoMonth): PlanSummary {
  const incomeMinor = sum(plan.incomes.map((a) => a.monthlyMinor));
  const fixedMinor = sum(plan.fixed.map((a) => a.monthlyMinor));
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

/**
 * "Safe to spend this week". Each envelope's monthly amount accrues per calendar day. The safe
 * amount is what has accrued up to the end of this week minus everything spent so far this
 * month, so a bad week carries into the next and the amount can go negative.
 */
export function safeToSpend(
  plan: Plan,
  entries: Entry[],
  today: IsoDate,
): { weekStart: IsoDate; weekEnd: IsoDate; totalMinor: Minor; envelopes: EnvelopeWeek[] } {
  const { start, end } = weekInMonth(today);
  const month = monthOf(today);
  const days = daysInMonth(month);
  const first = firstOfMonth(month);
  // ISO date strings sort chronologically, so plain comparison is enough.
  const spentBetween = (expenses: { date: IsoDate; eurMinor: Minor }[], from: IsoDate, to: IsoDate) =>
    sum(expenses.filter((x) => x.date >= from && x.date <= to).map((x) => x.eurMinor));

  const envelopes = plan.envelopes.map((e): EnvelopeWeek => {
    const expenses = expensesIn(entries, e.categoryId);
    const through = Math.round((e.monthlyMinor * (daysBetween(first, end) + 1)) / days);
    const before = Math.round((e.monthlyMinor * daysBetween(first, start)) / days);
    return {
      categoryId: e.categoryId,
      weekShareMinor: through - before,
      spentThisWeekMinor: spentBetween(expenses, start, end),
      safeMinor: through - spentBetween(expenses, first, end),
    };
  });

  return {
    weekStart: start,
    weekEnd: end,
    totalMinor: sum(envelopes.map((e) => e.safeMinor)),
    envelopes,
  };
}

/** Planned and spent per envelope for one calendar month, in the order of `plan.envelopes`. */
export function monthStatus(
  plan: Plan,
  entries: Entry[],
  month: IsoMonth,
): { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[] {
  return plan.envelopes.map((e) => ({
    categoryId: e.categoryId,
    plannedMinor: e.monthlyMinor,
    spentMinor: sum(
      expensesIn(entries, e.categoryId)
        .filter((x) => monthOf(x.date) === month)
        .map((x) => x.eurMinor),
    ),
  }));
}

export type RangeWarning = { categoryId: string; typicalMinMinor: Minor; typicalMaxMinor: Minor };

const FLEXIBLE_IDS = new Set(CATEGORIES.filter((c) => c.kind === 'flexible').map((c) => c.id));

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
