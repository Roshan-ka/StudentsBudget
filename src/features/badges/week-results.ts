import { db } from '@/db/db';
import type { Entry, Plan, WeekResult } from '@/db/types';
import { isIsoDate } from '@/features/recurring/schedule';
import { safeToSpend } from '@/lib/budget';
import { addDays, firstOfMonth, monthOf, weekOf, type IsoDate } from '@/lib/dates';
import { NOT_RECORDED, isRecorded, loggedExpenseTest } from './records';

type Week = { start: IsoDate; end: IsoDate };

/**
 * Days a week waits after its Sunday before it is recorded: what is logged for it on the Monday or the Tuesday after
 * still counts for it. A week is recorded from the Wednesday on.
 */
export const GRACE_DAYS = 2;

/** Whether `week` is ready to be recorded on `today`: more than `GRACE_DAYS` after its Sunday. */
function isDue(week: Week, today: IsoDate): boolean {
  // ISO date strings sort chronologically, so plain comparison is enough.
  return today > addDays(week.end, GRACE_DAYS);
}

/**
 * The Monday–Sunday weeks from the week of setup on that are ready to be recorded by `today`: each from the
 * Wednesday after its Sunday (`GRACE_DAYS`), so spending typed in on Monday or Tuesday for the week before still
 * counts for it. Empty for a plan or a day that is not a date.
 */
export function completedWeeks(plan: Plan, today: IsoDate): Week[] {
  if (!isIsoDate(plan.createdOn) || !isIsoDate(today)) return [];
  const weeks: Week[] = [];
  for (let week = weekOf(plan.createdOn); isDue(week, today); week = weekOf(addDays(week.end, 1))) weeks.push(week);
  return weeks;
}

/**
 * Last week while it waits to be recorded (on the Monday and the Tuesday after it), so it can still be marked as a
 * week away. Null on any other day, when last week ended before setup, and for a plan or a day that is not a date.
 */
export function weekAwaitingRecord(plan: Plan, today: IsoDate): Week | null {
  if (!isIsoDate(plan.createdOn) || !isIsoDate(today)) return null;
  const lastWeek = weekOf(addDays(weekOf(today).start, -1));
  // A week that ended before setup had no plan, so nothing is recorded for it.
  if (isDue(lastWeek, today) || lastWeek.end < plan.createdOn) return null;
  return lastWeek;
}

/**
 * What one week came to, measured the way the check-in measures it: the envelopes only, each envelope's share of
 * the plan against what was spent on it. A week a month boundary splits is the sum of its two parts, each measured
 * against its own month (`safeToSpend` for the part's last day). A part that ends before setup had no budget and is
 * left out, as the check-in leaves it out; in the week of setup, `safeToSpend` counts from the setup day.
 * `handLoggedCount` is the expenses that count as logged (`loggedExpenseTest`) and are dated in the week, whenever
 * they were typed in (a Monday batch for the week before counts for that week): typed in by hand, in a category the
 * envelopes measure, and on or after the setup day. Transfers, income, fixed costs and what a schedule posted are not
 * counted.
 */
export function weekResultOf(plan: Plan, entries: Entry[], week: Week): Omit<WeekResult, 'paused' | 'recordedAt'> {
  const split = monthOf(week.start) !== monthOf(week.end);
  const partEnds = split ? [addDays(firstOfMonth(monthOf(week.end)), -1), week.end] : [week.end];

  let plannedMinor = 0;
  let spentMinor = 0;
  let foodSpentMinor = 0;
  let eatingOutSpentMinor = 0;
  for (const end of partEnds) {
    if (end < plan.createdOn) continue;
    for (const e of safeToSpend(plan, entries, end).envelopes) {
      plannedMinor += e.weekShareMinor;
      spentMinor += e.spentThisWeekMinor;
      if (e.categoryId === 'food') foodSpentMinor += e.spentThisWeekMinor;
      if (e.categoryId === 'eating-out') eatingOutSpentMinor += e.spentThisWeekMinor;
    }
  }

  const isLogged = loggedExpenseTest(plan);
  const handLoggedCount = entries.filter((e) => isLogged(e) && e.date >= week.start && e.date <= week.end).length;

  return {
    weekStart: week.start,
    weekEnd: week.end,
    plannedMinor,
    spentMinor,
    foodSpentMinor,
    eatingOutSpentMinor,
    handLoggedCount,
  };
}

async function record(today: IsoDate): Promise<{ recorded: number }> {
  return db.transaction('rw', db.plan, db.entries, db.weekResults, async () => {
    const plan = await db.plan.get('current');
    if (!plan) return { recorded: 0 };
    const weeks = completedWeeks(plan, today);
    if (weeks.length === 0) return { recorded: 0 };

    const stored = await db.weekResults.bulkGet(weeks.map((w) => w.start));
    // A recorded week is never written again, so a later plan edit or entry leaves it as it was. A week with only
    // the away mark is recorded now, and keeps the mark.
    const open = weeks.flatMap((week, i) => {
      const row = stored[i];
      if (row !== undefined && isRecorded(row)) return [];
      return [{ week, paused: row?.paused ?? false }];
    });
    if (open.length === 0) return { recorded: 0 };

    const entries = await db.entries.toArray();
    const recordedAt = new Date().toISOString();
    await db.weekResults.bulkPut(
      open.map(({ week, paused }): WeekResult => ({ ...weekResultOf(plan, entries, week), paused, recordedAt })),
    );
    return { recorded: open.length };
  });
}

// Runs go one after another, so two calls from the same tab (start-up and a return to the app) never overlap. Two
// tabs each have their own queue; there the one read-write transaction does the same.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Saves each Monday–Sunday week since setup once it is due (see `completedWeeks`), keyed by its Monday, with the plan
 * of the day it is recorded (the first run fills in every week since setup with the current plan). A week already
 * recorded is never written again. The plan, the entries and the results are read and written in one read-write
 * transaction. Resolves with how many weeks were recorded.
 */
export function recordCompletedWeeks(today: IsoDate): Promise<{ recorded: number }> {
  const run = queue.then(() => record(today));
  queue = run.catch(() => undefined);
  return run;
}

/**
 * "I was away", for the Monday–Sunday week containing `day`: the week still running, or last week while it waits to
 * be recorded (`weekAwaitingRecord`). Until the week is recorded, the mark is kept as a row that is not a result yet
 * (no amounts, `recordedAt` empty), and recording the week keeps it. Switching it off before then removes that row.
 * On a week already recorded it changes `paused` and nothing else.
 */
export async function setAway(day: IsoDate, away: boolean): Promise<void> {
  const week = weekOf(day);
  await db.transaction('rw', db.weekResults, async () => {
    const row = await db.weekResults.get(week.start);
    if (row === undefined) {
      if (!away) return;
      await db.weekResults.add({
        weekStart: week.start,
        weekEnd: week.end,
        plannedMinor: 0,
        spentMinor: 0,
        foodSpentMinor: 0,
        eatingOutSpentMinor: 0,
        handLoggedCount: 0,
        paused: true,
        recordedAt: NOT_RECORDED,
      });
    } else if (!isRecorded(row) && !away) {
      await db.weekResults.delete(week.start);
    } else {
      await db.weekResults.update(week.start, { paused: away });
    }
  });
}
