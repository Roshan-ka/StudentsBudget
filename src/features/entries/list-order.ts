import type { Entry } from '@/db/types';
import type { IsoDate } from '@/lib/dates';

/** The entries by day, newest day first, and in a day the newest entry first: the order Entries shows them in. */
export function groupByDate(entries: Entry[]): { date: IsoDate; entries: Entry[] }[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const groups: { date: IsoDate; entries: Entry[] }[] = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    if (last?.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }
  return groups;
}

/**
 * The entry that takes the focus when `id` goes: the one shown after it, else the one shown before, else none (the list
 * takes it). In the order shown (`groupByDate`), never the database's (quick add breakpoints, 18-11-2026: the focus,
 * and the page with it, jumped to an unrelated row).
 */
export function neighbourOf(entries: Entry[], id: string): string | null {
  const shown = groupByDate(entries).flatMap((group) => group.entries);
  const index = shown.findIndex((entry) => entry.id === id);
  if (index === -1) return null;
  return shown[index + 1]?.id ?? shown[index - 1]?.id ?? null;
}
