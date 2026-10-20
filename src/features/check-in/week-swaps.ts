import { localSuggestions, type Suggestion } from '@/features/swaps/suggest';
import type { EnvelopeWeek } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';

/**
 * The check-in's swaps, by category: only for a row over its share of the plan for the week, the rows its line
 * calls "€12 over". A week at or under its share has nothing to change, however much of it is gone; the month's
 * early warning (past 90% before the last 7 days) is Home's. `day` is the day the week part is measured on.
 */
export function weekSwaps(rows: EnvelopeWeek[], day: IsoDate): Map<string, Suggestion> {
  const over = rows.filter((e) => e.spentThisWeekMinor > e.weekShareMinor);
  const suggestions = localSuggestions.suggest({
    rows: over.map((e) => ({
      categoryId: e.categoryId,
      plannedMinor: e.weekShareMinor,
      spentMinor: e.spentThisWeekMinor,
    })),
    today: day,
  });
  return new Map(suggestions.map((s) => [s.categoryId, s]));
}
