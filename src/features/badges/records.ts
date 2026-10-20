import type { Entry, WeekResult } from '@/db/types';

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
 * Whether an entry is spending the user logged by hand: an expense a schedule did not post. A transfer only moves
 * money and income is not spending, so neither says anything about a budget. The badges count such an entry for
 * the day it is for (`date`), whenever it was typed in.
 */
export function isHandLoggedExpense(entry: Entry): boolean {
  return entry.type === 'expense' && entry.recurring === undefined;
}
