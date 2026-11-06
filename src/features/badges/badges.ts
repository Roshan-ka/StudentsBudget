import { parseISO } from 'date-fns';
import type { Entry, Plan, Profile, WeekResult } from '@/db/types';
import { semesterWeeksOf } from '@/features/profile/profile';
import { isIsoDate } from '@/features/recurring/schedule';
import { dateFormat } from '@/i18n/format';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES, type Messages } from '@/i18n/messages';
import {
  addDays,
  firstOfMonth,
  formatDate,
  monthOf,
  shiftMonth,
  weekOf,
  type IsoDate,
  type IsoMonth,
} from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { isRecorded, loggedExpenseTest } from './records';

export type Badge = {
  id: 'under-budget-week' | 'logging-streak' | 'ramen-royalty' | 'latte-survivor';
  title: string;
  /** Under-Budget Week only; the other badges have no tiers and are null, earned or not. */
  tier: 'bronze' | 'silver' | 'gold' | null;
  progress: string;
  /** The last day of the week or month that earned it (its current tier, for Under-Budget Week). */
  earnedOn: IsoDate | null;
};

/** One finished calendar month: its eating out in EUR, and how many expenses dated in it count as logged. */
export type MonthSpend = { month: IsoMonth; eatingOutMinor: Minor; handLoggedCount: number };

/** What the badges need besides the recorded weeks. */
export type BadgeHistory = {
  /**
   * The setup day. Ramen Royalty leaves out the week it falls in: a record saved before 2026-11-06 measured that week
   * only from the setup day (unless it was a Monday), and recorded weeks are never rewritten.
   */
  planStart: IsoDate;
  /** Each finished calendar month from the first full month after setup, oldest first. */
  months: MonthSpend[];
  /** A week not recorded yet is marked away: the week still running, or last week while it waits to be recorded. */
  awayNotRecorded: boolean;
};

/** Gold Under-Budget Week until the profile gives the semester's dates: a semester of 26 weeks. */
export const DEFAULT_SEMESTER_WEEKS = 26;
const BRONZE_WEEKS = 4;
const SILVER_WEEKS = 12;
/** Weeks in a row that earn the Logging Streak. */
const STREAK_WEEKS = 4;

/** The dictionary and the locale a badge's words are written with. */
type Words = { t: Messages; locale: string };

/** "November 2026". `parseISO` reads a date-only string as local midnight, so the month never shifts. */
const monthName = (month: IsoMonth, locale: string): string =>
  dateFormat(locale, { month: 'long', year: 'numeric' }).format(parseISO(firstOfMonth(month)));

/** "€62", or "€61.72" when there are cents: a bar to stay under is never rounded. */
const euros = (minor: Minor, locale: string): string =>
  formatMoney(minor, 'EUR', { whole: minor % 100 === 0, locale });

/**
 * The semester that sets gold Under-Budget Week: the weeks of the profile's semester (`semesterWeeksOf`), or
 * `DEFAULT_SEMESTER_WEEKS` without one: no profile, no dates, or dates the profile form would not save.
 */
export function semesterWeeksFor(profile: Pick<Profile, 'semesterStart' | 'semesterEnd'> | null | undefined): number {
  return semesterWeeksOf(profile) ?? DEFAULT_SEMESTER_WEEKS;
}

/** The weeks under budget that earn gold: a semester's weeks, but always more than silver needs. */
export function goldWeeks(semesterWeeks: number): number {
  // At least 13: a short or odd semester range must not make gold trivial, so gold always needs more than silver.
  return Math.max(semesterWeeks, SILVER_WEEKS + 1);
}

/**
 * The rest of what the badges need, from the plan, the entries and the stored rows. Each finished calendar month
 * gets its eating out and its logged expenses (`loggedExpenseTest`, as the weeks count them), both by the day each
 * entry is for, whenever it was typed in. Months come from the entries, not the weekly results, because a month's
 * spending does not depend on the plan. The first full month is the month of setup when setup was on the 1st,
 * otherwise the month after; the month of `today` is still running and is left out.
 */
export function badgeHistory(plan: Plan, entries: Entry[], results: WeekResult[], today: IsoDate): BadgeHistory {
  const months: IsoMonth[] = [];
  if (isIsoDate(plan.createdOn) && isIsoDate(today)) {
    const setupMonth = monthOf(plan.createdOn);
    const first = plan.createdOn === firstOfMonth(setupMonth) ? setupMonth : shiftMonth(setupMonth, 1);
    // 'YYYY-MM' strings sort chronologically, so plain comparison is enough.
    for (let month = first; month < monthOf(today); month = shiftMonth(month, 1)) months.push(month);
  }

  const byMonth = new Map<IsoMonth, MonthSpend>(
    months.map((month) => [month, { month, eatingOutMinor: 0, handLoggedCount: 0 }]),
  );
  const isLogged = loggedExpenseTest(plan);
  for (const e of entries) {
    const month = byMonth.get(monthOf(e.date));
    if (month === undefined || e.type !== 'expense') continue;
    if (e.categoryId === 'eating-out') month.eatingOutMinor += e.eurMinor;
    if (isLogged(e)) month.handLoggedCount += 1;
  }

  // Last week waits a few days before it is recorded; its away mark counts as much as this week's.
  const thisWeek = isIsoDate(today) ? weekOf(today).start : null;
  const lastWeek = thisWeek === null ? null : addDays(thisWeek, -7);
  return {
    planStart: plan.createdOn,
    months: [...byMonth.values()],
    awayNotRecorded: results.some(
      (r) => !isRecorded(r) && r.paused && (r.weekStart === thisWeek || r.weekStart === lastWeek),
    ),
  };
}

/**
 * Weeks with a logged expense (`loggedExpenseTest`) that came in at or under their share of the envelopes: what was
 * left of them at the start of the week, split over the weeks left in the month (`weekAllowance`). A week with no
 * spending logged says nothing about the budget, a week with nothing planned (a share of 0) has nothing to be under,
 * and a week away does not count. Bronze at 4, silver at 12, gold at a semester.
 */
function underBudgetWeek(weeks: WeekResult[], semesterWeeks: number, { t }: Words): Badge {
  const gold = goldWeeks(semesterWeeks);
  const tierAt = (n: number): Badge['tier'] =>
    n >= gold ? 'gold' : n >= SILVER_WEEKS ? 'silver' : n >= BRONZE_WEEKS ? 'bronze' : null;

  let count = 0;
  let tier: Badge['tier'] = null;
  let earnedOn: IsoDate | null = null;
  for (const w of weeks) {
    if (w.paused || w.handLoggedCount <= 0 || w.plannedMinor <= 0 || w.spentMinor > w.plannedMinor) continue;
    count += 1;
    const reached = tierAt(count);
    if (reached !== tier) {
      tier = reached;
      earnedOn = w.weekEnd;
    }
  }

  const goal = tier === null ? BRONZE_WEEKS : tier === 'bronze' ? SILVER_WEEKS : tier === 'silver' ? gold : null;
  const text = t.badges.progress;
  return {
    id: 'under-budget-week',
    title: t.badges.names['under-budget-week'],
    tier,
    progress: goal === null ? text.underBudgetCount(count) : text.underBudgetOf(count, goal),
    earnedOn,
  };
}

/**
 * Weeks in a row with a logged expense (`loggedExpenseTest`). A week away neither ends the run nor adds to it, and
 * while the latest week (recorded, or one not recorded yet) is marked away the streak reads as paused. Earned at 4.
 */
function loggingStreak(weeks: WeekResult[], awayNotRecorded: boolean, { t }: Words): Badge {
  let run = 0;
  let earnedOn: IsoDate | null = null;
  for (const w of weeks) {
    if (w.paused) continue;
    run = w.handLoggedCount > 0 ? run + 1 : 0;
    if (earnedOn === null && run >= STREAK_WEEKS) earnedOn = w.weekEnd;
  }
  const paused = awayNotRecorded || (weeks.length > 0 && weeks[weeks.length - 1].paused);

  // A streak that was earned and has ended reads as a new one starting, not as if nothing had happened.
  const text = t.badges.progress;
  let progress: string;
  if (run === 0) progress = earnedOn === null ? text.streakStart : text.streakNew;
  else if (paused) progress = text.streakPaused(run);
  else if (earnedOn === null) progress = text.streakOf(run, STREAK_WEEKS);
  else progress = text.streakRun(run);

  return { id: 'logging-streak', title: t.badges.names['logging-streak'], tier: null, progress, earnedOn };
}

/**
 * The cheapest week on food so far, among full weeks with groceries logged and not away. It is earned by the first
 * week that is cheaper than every week before it, so one week alone does not earn it.
 */
function ramenRoyalty(weeks: WeekResult[], planStart: IsoDate, { t, locale }: Words): Badge {
  let best: WeekResult | null = null;
  let earnedOn: IsoDate | null = null;
  for (const w of weeks) {
    // ISO date strings sort chronologically: a week that starts before setup had only part of its days planned.
    if (w.paused || w.foodSpentMinor <= 0 || w.weekStart < planStart) continue;
    if (best !== null && w.foodSpentMinor < best.foodSpentMinor) earnedOn ??= w.weekEnd;
    if (best === null || w.foodSpentMinor < best.foodSpentMinor) best = w;
  }

  const text = t.badges.progress;
  const progress =
    best === null
      ? text.ramenFirst
      : text.ramenBest(euros(best.foodSpentMinor, locale), formatDate(best.weekStart), earnedOn !== null);
  return { id: 'ramen-royalty', title: t.badges.names['ramen-royalty'], tier: null, progress, earnedOn };
}

/**
 * A month with at most half the eating out of the first one that had some. Only months with an expense logged by
 * hand count, as for the weeks: a month with no spending logged says nothing about eating out, neither as the mark
 * nor as a month under it.
 */
function latteSurvivor(months: MonthSpend[], { t, locale }: Words): Badge {
  const text = t.badges.progress;
  const badge = (progress: string, earnedOn: IsoDate | null = null): Badge => ({
    id: 'latte-survivor',
    title: t.badges.names['latte-survivor'],
    tier: null,
    progress,
    earnedOn,
  });
  const logged = months.filter((m) => m.handLoggedCount > 0);
  if (logged.length === 0) return badge(text.latteFirstLogging);
  const markAt = logged.findIndex((m) => m.eatingOutMinor > 0);
  if (markAt === -1) return badge(text.latteFirstEatingOut);
  const mark = logged[markAt];

  // Doubling keeps it in whole cents: €123.45 halves to €61.725, and €61.72 is the most that is at most half.
  const hit = logged.slice(markAt + 1).find((m) => m.eatingOutMinor * 2 <= mark.eatingOutMinor);
  if (hit === undefined) {
    const most = Math.floor(mark.eatingOutMinor / 2);
    return badge(text.latteTarget(euros(most, locale), monthName(mark.month, locale)));
  }
  return badge(
    text.latteHit(
      monthName(hit.month, locale),
      euros(hit.eatingOutMinor, locale),
      euros(mark.eatingOutMinor, locale),
      monthName(mark.month, locale),
    ),
    addDays(firstOfMonth(shiftMonth(hit.month, 1)), -1),
  );
}

/**
 * The four personal badges, from the recorded weeks and `badgeHistory`. Badges are earned, never bought, and never
 * reward spending. The three weekly badges come from recorded weeks, which are never rewritten, so their counts stay
 * (only a restore replaces the recorded weeks, with the file's). Latte Survivor is worked out from the entries each
 * time, so editing, adding or deleting an expense of a finished month can change it. Rows that only hold the away
 * mark of a week not recorded yet are left out (the history says whether such a week is marked). `semesterWeeks`
 * (from `semesterWeeksFor`) sets gold for Under-Budget Week and is checked each time, so a longer semester in the
 * profile can take gold back to silver. Their names and progress are in `lang`.
 */
export function badgesFrom(
  results: WeekResult[],
  semesterWeeks: number,
  history: BadgeHistory,
  lang: Language = 'en',
): Badge[] {
  const words: Words = { t: MESSAGES[lang], locale: LANGUAGES[lang].locale };
  const weeks = results.filter(isRecorded).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return [
    underBudgetWeek(weeks, semesterWeeks, words),
    loggingStreak(weeks, history.awayNotRecorded, words),
    ramenRoyalty(weeks, history.planStart, words),
    latteSurvivor(history.months, words),
  ];
}
