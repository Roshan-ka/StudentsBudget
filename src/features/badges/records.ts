import type { Entry, WeekResult } from '@/db/types';
import { todayIso, type IsoDate } from '@/lib/dates';

// What the week results and the badges both need to know about rows and entries. No database here: the badges are
// worked out from what they are given.

/**
 * `recordedAt` of a row that only holds the "I was away this week" mark for a week still running. Such a row is not a
 * result yet: the week fills it in when it is recorded, and badges leave it out until then.
 */
export const NOT_RECORDED = '';

/** Whether a row is a finished week's result, not just the away mark of a week still running. */
export function isRecorded(row: WeekResult): boolean {
  return row.recordedAt !== NOT_RECORDED;
}

/**
 * The local day an entry was typed in, whatever day it is for. Null for an entry a schedule posted (nobody typed it)
 * and for a `createdAt` that is not a time.
 */
export function handLoggedOn(entry: Entry): IsoDate | null {
  if (entry.type !== 'transfer' && entry.recurring !== undefined) return null;
  const created = new Date(entry.createdAt);
  return Number.isNaN(created.getTime()) ? null : todayIso(created);
}
