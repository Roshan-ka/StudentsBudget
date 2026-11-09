import type { Entry } from '@/db/types';
import { daysBetween, type IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';

// "Already in the app" (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md; Roshan, 09-11-2026): a
// statement row is skipped when an entry already stands for it, typed by hand or posted by a schedule. That is what
// makes importing a file twice harmless, and a statement on top of daily logging.
// - By direction, not by type: money out of the account matches an expense on it or a transfer out of it; money in
//   matches an income on it or a transfer into it. So cash typed by hand as a transfer to Cash isn't imported again as
//   an expense, and the other half of a transfer an earlier statement made is found.
// - The same amount in the account's currency, booked within OVERLAP_DAYS of the entry's date (a card payment is
//   booked a day or two after it was made).
// - One to one: each entry covers one row only, the closest dates first. Two real 3,50 € Mensa rows next to one typed
//   entry import one.

/** How many days apart a row and an entry may be and still be the same booking. Tuned after the real try. */
export const OVERLAP_DAYS = 3;

/** What overlap needs of a row: its place, its date, and its signed amount in the account's currency. */
export type OverlapRow = { index: number; date: IsoDate; amountMinor: Minor };

/** What `entry` moves on `accountId`: negative out, positive in, or null when it doesn't touch the account. */
function movementOn(entry: Entry, accountId: string): Minor | null {
  if (entry.type === 'transfer') {
    if (entry.accountId === accountId) return -entry.amountMinor;
    if (entry.toAccountId === accountId) return entry.toAmountMinor;
    return null;
  }
  if (entry.accountId !== accountId) return null;
  return entry.type === 'income' ? entry.amountMinor : -entry.amountMinor;
}

/** The rows an entry already stands for, by the row's index, with that entry's id. */
export function findOverlaps(rows: readonly OverlapRow[], accountId: string, entries: readonly Entry[]): Map<number, string> {
  const candidates: { row: number; entry: string; distance: number }[] = [];
  const onAccount = entries.flatMap((entry) => {
    const movement = movementOn(entry, accountId);
    return movement === null || movement === 0 ? [] : [{ entry, movement }];
  });
  for (const row of rows) {
    if (row.amountMinor === 0) continue;
    for (const { entry, movement } of onAccount) {
      if (movement !== row.amountMinor) continue;
      const distance = Math.abs(daysBetween(entry.date, row.date));
      if (distance <= OVERLAP_DAYS) candidates.push({ row: row.index, entry: entry.id, distance });
    }
  }
  // Closest first; on a tie, the earlier row and then the entry's id, so the result never depends on the input order.
  candidates.sort((a, b) => a.distance - b.distance || a.row - b.row || (a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0));
  const matched = new Map<number, string>();
  const used = new Set<string>();
  for (const { row, entry } of candidates) {
    if (matched.has(row) || used.has(entry)) continue;
    matched.set(row, entry);
    used.add(entry);
  }
  return matched;
}
