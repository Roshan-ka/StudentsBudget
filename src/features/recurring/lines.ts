import { CATEGORIES } from '@/data/categories';
import type { Account, Category, Plan, PlanLine, Schedule } from '@/db/types';
import { orderOf } from '@/features/entries/categories';
import { planSummary } from '@/lib/budget';
import type { IsoDate, IsoMonth } from '@/lib/dates';
import { formatMoney, type CurrencyCode, type Minor } from '@/lib/money';
import { describeTiming, monthlyEquivalent, newSchedule, resumeSchedule } from './schedule';

/** The categories a plan line can have: fixed costs and income, in category order. */
const LINE_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind === 'fixed' || c.kind === 'income');

const isIncome = (categoryId: string): boolean => CATEGORIES.some((c) => c.id === categoryId && c.kind === 'income');

/** One change to a line from the editor. Without `auto` the line is added by hand and `monthlyMinor` is its plan figure. */
export type LineChange = {
  categoryId: string;
  auto: (Pick<Schedule, 'frequency' | 'day' | 'accountId' | 'amountMinor'> & { currency: CurrencyCode }) | null;
  /**
   * The euro figure for the plan, per month. Ignored for a line added automatically to a euro account: that one is
   * the schedule's amount over a month (`monthlyEquivalent`).
   */
  monthlyMinor: Minor;
};

type Lists = Pick<Plan, 'incomes' | 'fixed'>;

/** Applies `change` to the list the category belongs in; the other list is returned as it was. */
function mapList(plan: Plan, categoryId: string, change: (lines: PlanLine[]) => PlanLine[]): Plan {
  const key: keyof Lists = isIncome(categoryId) ? 'incomes' : 'fixed';
  return { ...plan, [key]: change(plan[key]) };
}

function mapLine(plan: Plan, categoryId: string, change: (line: PlanLine) => PlanLine): Plan {
  return mapList(plan, categoryId, (lines) => lines.map((l) => (l.categoryId === categoryId ? change(l) : l)));
}

/**
 * The plan with one line changed, or added in category order. An existing schedule keeps its id, start, watermark and
 * pause, so a new amount, day, frequency or account applies from the next occurrence. Turning auto-adding on makes a
 * new schedule that starts tomorrow; turning it off drops the schedule.
 */
export function applyLineChange(plan: Plan, change: LineChange, today: IsoDate): Plan {
  return mapList(plan, change.categoryId, (lines) => {
    const current = lines.find((l) => l.categoryId === change.categoryId);
    let next: PlanLine;
    if (change.auto) {
      const { currency, ...fields } = change.auto;
      const schedule = current?.schedule ? { ...current.schedule, ...fields } : newSchedule(fields, today);
      const monthlyMinor = currency === 'EUR' ? monthlyEquivalent(fields) : change.monthlyMinor;
      next = { categoryId: change.categoryId, monthlyMinor, schedule };
    } else {
      next = { categoryId: change.categoryId, monthlyMinor: change.monthlyMinor };
    }
    if (current) return lines.map((l) => (l === current ? next : l));
    return [...lines, next].sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId));
  });
}

/** Pauses a line's schedule, or resumes it from tomorrow so the paused periods are skipped. */
export function setLinePaused(plan: Plan, categoryId: string, paused: boolean, today: IsoDate): Plan {
  return mapLine(plan, categoryId, (line) => {
    if (!line.schedule) return line;
    return { ...line, schedule: paused ? { ...line.schedule, paused: true } : resumeSchedule(line.schedule, today) };
  });
}

export function removeLine(plan: Plan, categoryId: string): Plan {
  return mapList(plan, categoryId, (lines) => lines.filter((l) => l.categoryId !== categoryId));
}

/** The fixed cost and income categories the plan has no line for, in category order. */
export function addableCategories(plan: Plan): Category[] {
  const used = new Set([...plan.incomes, ...plan.fixed].map((l) => l.categoryId));
  return LINE_CATEGORIES.filter((c) => !used.has(c.id));
}

/** "€400.00 · Monthly on day 1 · Local bank", or "€25.00 a month · Not added automatically". */
export function describeLine(line: PlanLine, accounts: Pick<Account, 'id' | 'name' | 'currency'>[]): string {
  const s = line.schedule;
  if (!s) return `${formatMoney(line.monthlyMinor, 'EUR')} a month · Not added automatically`;
  const account = accounts.find((a) => a.id === s.accountId);
  const parts = account
    ? [formatMoney(s.amountMinor, account.currency), describeTiming(s), account.name]
    : [describeTiming(s), 'Pick an account for this'];
  if (s.paused) parts.push('Paused');
  return parts.join(' · ');
}

/** "Your plan is €6 over your income" while the envelopes plan more than is available, in whole euros rounded up. */
export function overBudgetLine(plan: Plan, month: IsoMonth): string | null {
  const { overByMinor } = planSummary(plan, month);
  if (overByMinor <= 0) return null;
  return `Your plan is ${formatMoney(Math.ceil(overByMinor / 100) * 100, 'EUR', { whole: true })} over your income`;
}
