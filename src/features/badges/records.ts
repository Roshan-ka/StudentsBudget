import type { Entry, Plan, WeekResult } from '@/db/types';
import { envelopeCategoryIds } from '@/lib/budget';

// What the week results and the badges both need to know about rows and entries. No database here: the badges are
// worked out from what they are given.

/**
 * `recordedAt` of a row that only holds the "I was away" mark of a week not recorded yet: the one still running, or
 * last week while it waits to be recorded. Such a row is not a result yet: the week fills it in when it is recorded,
 * and badges leave it out until then.
 */
export const NOT_RECORDED = '';

/** Whether a row is a finished week's result, not just the away mark of a week not recorded yet. */
export function isRecorded(row: WeekResult): boolean {
  return row.recordedAt !== NOT_RECORDED;
}

/**
 * The one test for "logged": whether an entry is spending the user logged for the badges. Both must hold:
 * - It is an expense typed in by hand: a schedule did not post it (`recurring`), and a transfer only moves money and
 *   income is not spending.
 * - Its category is one the weekly badges measure (`envelopeCategoryIds`: the plan's envelopes and the other flexible
 *   categories), so a week counts as logged only when it has spending in `WeekResult.spentMinor`. Rent or another fixed
 *   cost typed in by hand says nothing about the envelopes.
 * Its day does not matter: the whole month counts, the month of setup too, so an expense typed in for a day before
 * setup is logged like any other (Roshan, 2026-11-06). Which weeks have a record is for the week records to say. The
 * badges count such an entry for the day it is for (`date`), whenever it was typed in. The test is made once per
 * plan, so a long list of entries does not work out the categories again for each one.
 */
export function loggedExpenseTest(plan: Plan): (entry: Entry) => boolean {
  const measured = envelopeCategoryIds(plan);
  return (entry) => entry.type === 'expense' && entry.recurring === undefined && measured.has(entry.categoryId);
}
