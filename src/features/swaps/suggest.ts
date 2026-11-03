import { SWAPS, type Swap } from '@/data/swaps';
import { LANGUAGES, type Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
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

/**
 * "€14.50" for an amount with cents, "€34" for a whole-euro one: an amount that is not whole is never rounded. In
 * English unless `locale` says otherwise (the MCP server's are English).
 */
export function amountText(minor: Minor, locale?: string): string {
  return formatMoney(minor, 'EUR', { whole: minor % 100 === 0, locale });
}

/**
 * The saving in the words of the line: whole euros, rounded down so it is never flattering ("about €10" for €10.70),
 * except that a saving under €1 keeps its cents rather than read as €0.
 */
export function savingText(minor: Minor, locale?: string): string {
  return minor < 100 ? amountText(minor, locale) : amountText(Math.floor(minor / 100) * 100, locale);
}

/**
 * "Try this: Eat at the Mensa instead of a restaurant · save about €10 per meal", in `lang`; the swap's title and
 * what it is per are city content and stay as written. A saving that rests on an assumption says "(estimate)" on the
 * line itself, where the number is shown, not only once the swap is opened.
 */
export function swapLineText({ swap, savingPerUseMinor }: Suggestion, lang: Language = 'en'): string {
  const text = MESSAGES[lang].tips.swap;
  const line = text.line(swap.title, savingText(savingPerUseMinor, LANGUAGES[lang].locale), swap.per);
  return swap.estimate === true ? text.estimate(line) : line;
}
