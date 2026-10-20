import { parseISO } from 'date-fns';
import type { Entry, Plan, WeekResult } from '@/db/types';
import { isIsoDate } from '@/features/recurring/schedule';
import {
  addDays,
  firstOfMonth,
  formatDate,
  monthOf,
  shiftMonth,
  type IsoDate,
  type IsoMonth,
} from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { isRecorded } from './week-results';

export type Badge = {
  id: 'under-budget-week' | 'logging-streak' | 'ramen-royalty' | 'latte-survivor';
  title: string;
  /** Under-Budget Week only; the other badges have no tiers and are null, earned or not. */
  tier: 'bronze' | 'silver' | 'gold' | null;
  progress: string;
  /** The last day of the week or month that earned it (its current tier, for Under-Budget Week). */
  earnedOn: IsoDate | null;
};

/** One finished calendar month's eating out, in EUR. */
export type MonthSpend = { month: IsoMonth; eatingOutMinor: Minor };

/** What the badges need besides the weekly results. */
export type BadgeHistory = {
  /** The setup day: the week it falls in is only partly planned, unless it is a Monday. */
  planStart: IsoDate;
  /** Each finished calendar month from the first full month after setup, oldest first. */
  months: MonthSpend[];
};

/** Gold Under-Budget Week until the profile gives the semester's dates: a semester of 26 weeks. */
export const DEFAULT_SEMESTER_WEEKS = 26;
const BRONZE_WEEKS = 4;
const SILVER_WEEKS = 12;
/** Weeks in a row that earn the Logging Streak. */
const STREAK_WEEKS = 4;

const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });

/** "November 2026". `parseISO` reads a date-only string as local midnight, so the month never shifts. */
const monthName = (month: IsoMonth): string => monthAndYear.format(parseISO(firstOfMonth(month)));

/** "€62", or "€61.72" when there are cents: a bar to stay under is never rounded. */
const euros = (minor: Minor): string => formatMoney(minor, 'EUR', minor % 100 === 0 ? { whole: true } : undefined);

const weeksText = (n: number): string => `${n} ${n === 1 ? 'week' : 'weeks'}`;

/** The weeks under budget that earn gold: a semester's weeks, but always more than silver needs. */
export function goldWeeks(semesterWeeks: number): number {
  return Math.max(semesterWeeks, SILVER_WEEKS + 1);
}

/**
 * Eating out per finished calendar month, the input for Latte Survivor. It is read from the entries, not the weekly
 * results, because a month's spending does not depend on the plan. The first full month is the month of setup when
 * setup was on the 1st, otherwise the month after; the month of `today` is still running and is left out.
 */
export function badgeHistory(plan: Plan, entries: Entry[], today: IsoDate): BadgeHistory {
  const months: IsoMonth[] = [];
  if (isIsoDate(plan.createdOn) && isIsoDate(today)) {
    const setupMonth = monthOf(plan.createdOn);
    const first = plan.createdOn === firstOfMonth(setupMonth) ? setupMonth : shiftMonth(setupMonth, 1);
    // 'YYYY-MM' strings sort chronologically, so plain comparison is enough.
    for (let month = first; month < monthOf(today); month = shiftMonth(month, 1)) months.push(month);
  }

  const totals = new Map<IsoMonth, Minor>(months.map((m) => [m, 0]));
  for (const e of entries) {
    if (e.type !== 'expense' || e.categoryId !== 'eating-out') continue;
    const total = totals.get(monthOf(e.date));
    if (total !== undefined) totals.set(monthOf(e.date), total + e.eurMinor);
  }
  return { planStart: plan.createdOn, months: months.map((month) => ({ month, eatingOutMinor: totals.get(month) ?? 0 })) };
}

/**
 * Weeks that come in at or under their share of the envelopes. A week with nothing planned has nothing to be under,
 * and a week away does not count. Bronze at 4, silver at 12, gold at a semester.
 */
function underBudgetWeek(weeks: WeekResult[], semesterWeeks: number): Badge {
  const gold = goldWeeks(semesterWeeks);
  const tierAt = (n: number): Badge['tier'] =>
    n >= gold ? 'gold' : n >= SILVER_WEEKS ? 'silver' : n >= BRONZE_WEEKS ? 'bronze' : null;

  let count = 0;
  let tier: Badge['tier'] = null;
  let earnedOn: IsoDate | null = null;
  for (const w of weeks) {
    if (w.paused || w.plannedMinor <= 0 || w.spentMinor > w.plannedMinor) continue;
    count += 1;
    const reached = tierAt(count);
    if (reached !== tier) {
      tier = reached;
      earnedOn = w.weekEnd;
    }
  }

  const goal = tier === null ? BRONZE_WEEKS : tier === 'bronze' ? SILVER_WEEKS : tier === 'silver' ? gold : null;
  return {
    id: 'under-budget-week',
    title: 'Under-Budget Week',
    tier,
    progress: goal === null ? `${count} weeks under budget` : `${count} of ${goal} weeks`,
    earnedOn,
  };
}

/** Weeks in a row with something typed in. A week away neither ends the run nor adds to it. Earned at 4. */
function loggingStreak(weeks: WeekResult[]): Badge {
  let run = 0;
  let earnedOn: IsoDate | null = null;
  for (const w of weeks) {
    if (w.paused) continue;
    run = w.handLoggedCount > 0 ? run + 1 : 0;
    if (earnedOn === null && run >= STREAK_WEEKS) earnedOn = w.weekEnd;
  }
  const paused = weeks.length > 0 && weeks[weeks.length - 1].paused;

  let progress: string;
  if (run > 0 && paused) progress = `Your streak is paused at ${weeksText(run)}`;
  else if (run === 0) progress = `Log something this week to start a ${earnedOn === null ? '' : 'new '}streak`;
  else if (earnedOn === null) progress = `${run} of ${STREAK_WEEKS} weeks in a row`;
  else progress = `${weeksText(run)} in a row`;

  return { id: 'logging-streak', title: 'Logging Streak', tier: null, progress, earnedOn };
}

/**
 * The cheapest week on food so far, among full weeks with groceries logged and not away. It is earned by the first
 * week that is cheaper than every week before it, so one week alone does not earn it.
 */
function ramenRoyalty(weeks: WeekResult[], planStart: IsoDate): Badge {
  let best: WeekResult | null = null;
  let earnedOn: IsoDate | null = null;
  for (const w of weeks) {
    // ISO date strings sort chronologically: a week that starts before setup had only part of its days planned.
    if (w.paused || w.foodSpentMinor <= 0 || w.weekStart < planStart) continue;
    if (best !== null && w.foodSpentMinor < best.foodSpentMinor) earnedOn ??= w.weekEnd;
    if (best === null || w.foodSpentMinor < best.foodSpentMinor) best = w;
  }

  let progress = 'Your first full week of groceries sets the mark';
  if (best !== null) {
    progress = `Cheapest food week so far: ${euros(best.foodSpentMinor)} (week of ${formatDate(best.weekStart)})`;
    if (earnedOn === null) progress += '. A cheaper week earns it';
  }
  return { id: 'ramen-royalty', title: 'Ramen Royalty', tier: null, progress, earnedOn };
}

/** A month with at most half the eating out of the first full month. */
function latteSurvivor(months: MonthSpend[]): Badge {
  const badge = (progress: string, earnedOn: IsoDate | null = null): Badge => ({
    id: 'latte-survivor',
    title: 'Latte Survivor',
    tier: null,
    progress,
    earnedOn,
  });
  const [first, ...later] = months;
  if (first === undefined) return badge('Your first full month of logging sets the mark');
  if (first.eatingOutMinor <= 0) {
    return badge(`Your first full month, ${monthName(first.month)}, had no eating out to halve`);
  }

  // Doubling keeps it in whole cents: €123.45 halves to €61.725, and €61.72 is the most that is at most half.
  const hit = later.find((m) => m.eatingOutMinor * 2 <= first.eatingOutMinor);
  if (hit === undefined) {
    const most = Math.floor(first.eatingOutMinor / 2);
    return badge(`A month with ${euros(most)} or less on eating out earns it (half of ${monthName(first.month)})`);
  }
  return badge(
    `${monthName(hit.month)}: ${euros(hit.eatingOutMinor)} on eating out, down from ` +
      `${euros(first.eatingOutMinor)} in ${monthName(first.month)}`,
    addDays(firstOfMonth(shiftMonth(hit.month, 1)), -1),
  );
}

/**
 * The four personal badges, from the recorded weeks and the eating out per month. Badges are earned, never bought,
 * never reward spending, and once earned stay earned. Rows that only hold the away note of a week still running are
 * left out. `semesterWeeks` sets gold for Under-Budget Week (`DEFAULT_SEMESTER_WEEKS` until the profile says).
 */
export function badgesFrom(results: WeekResult[], semesterWeeks: number, history: BadgeHistory): Badge[] {
  const weeks = results.filter(isRecorded).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return [
    underBudgetWeek(weeks, semesterWeeks),
    loggingStreak(weeks),
    ramenRoyalty(weeks, history.planStart),
    latteSurvivor(history.months),
  ];
}
