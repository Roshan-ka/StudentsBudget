import { SWAPS, type Swap } from '@/data/swaps';
import { daysInMonth, monthOf, type IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';

/** One envelope against its plan: for Home the month, for the check-in the week's share. */
export type SuggestionRow = { categoryId: string; plannedMinor: Minor; spentMinor: Minor };

export type Suggestion = { categoryId: string; swap: Swap; savingPerUseMinor: Minor };

/**
 * Where a suggestion comes from. The rules below fill it from the seeded swaps; the AI phase fills it too,
 * and every suggestion it makes must keep citing a source.
 */
export interface SuggestionProvider {
  suggest(ctx: { rows: SuggestionRow[]; today: IsoDate }): Suggestion[];
}

/** The last 7 days of a month: from day length - 6 to the end. */
const LAST_DAYS = 7;

/**
 * A row qualifies when it is over plan, or when more than 90% of the plan is gone and the last 7 days of the
 * month have not begun, so there is still time to change course. Whole cents, so no rounding decides it.
 * A row planned at €0 with nothing spent is neither.
 */
function qualifies(row: SuggestionRow, today: IsoDate): boolean {
  if (row.spentMinor > row.plannedMinor) return true;
  const dayOfMonth = Number(today.slice(8, 10));
  const beforeLastDays = dayOfMonth <= daysInMonth(monthOf(today)) - LAST_DAYS;
  return beforeLastDays && row.spentMinor * 10 > row.plannedMinor * 9;
}

/** The swap that saves the most per use; the one written first wins a tie. */
function bestSwap(swaps: readonly Swap[], categoryId: string): Swap | null {
  let best: Swap | null = null;
  for (const swap of swaps) {
    if (swap.categoryId !== categoryId) continue;
    if (best === null || swap.fromMinor - swap.toMinor > best.fromMinor - best.toMinor) best = swap;
  }
  return best;
}

/** A provider for these swaps: at most one suggestion per row, in the order of the rows. */
export function createSuggestionProvider(swaps: readonly Swap[]): SuggestionProvider {
  return {
    suggest({ rows, today }) {
      return rows.flatMap((row): Suggestion[] => {
        if (!qualifies(row, today)) return [];
        const swap = bestSwap(swaps, row.categoryId);
        if (swap === null) return [];
        return [{ categoryId: row.categoryId, swap, savingPerUseMinor: swap.fromMinor - swap.toMinor }];
      });
    },
  };
}

/** The rule-based provider over the seeded swaps. */
export const localSuggestions: SuggestionProvider = createSuggestionProvider(SWAPS);

/** "€14.50" for an amount with cents, "€34" for a whole-euro one: an amount that is not whole is never rounded. */
export function amountText(minor: Minor): string {
  return formatMoney(minor, 'EUR', minor % 100 === 0 ? { whole: true } : undefined);
}

/**
 * The saving in the words of the line: whole euros, rounded down so it is never flattering ("about €10" for €10.70),
 * except that a saving under €1 keeps its cents rather than read as €0.
 */
function savingText(minor: Minor): string {
  return minor < 100 ? amountText(minor) : amountText(Math.floor(minor / 100) * 100);
}

/** "Try this: Eat at the Mensa instead of a restaurant · save about €10 per meal". */
export function swapLineText({ swap, savingPerUseMinor }: Suggestion): string {
  return `Try this: ${swap.title} · save about ${savingText(savingPerUseMinor)} per ${swap.per}`;
}
