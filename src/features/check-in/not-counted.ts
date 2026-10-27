import type { Entry } from '@/db/types';
import type { IsoDate } from '@/lib/dates';

/**
 * The line under an entry that the week's figures leave out: an expense dated before the plan started. Spending
 * counts from the setup day on, so an earlier expense is listed with the week it falls in but never
 * counts against an envelope. Income and transfers are in no envelope, so they have nothing to explain.
 */
export function notCountedNote(entry: Entry, planStart: IsoDate): string | null {
  // ISO date strings sort chronologically, so plain comparison is enough.
  return entry.type === 'expense' && entry.date < planStart ? 'Before your plan started, not counted' : null;
}
