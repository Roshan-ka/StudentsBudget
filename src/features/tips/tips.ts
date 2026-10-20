import { GUESS_CATEGORY_IDS } from '@/data/categories';
import type { Tip } from '@/data/tips';
import { categoryName, orderOf } from '@/features/entries/categories';

/** The tips in the app's category order; within a category they keep the order they were written in. */
export function sortTips(tips: readonly Tip[]): Tip[] {
  return [...tips].sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId));
}

/** The categories that have at least one tip, in the app's category order. */
export function tipCategoryIds(tips: readonly Tip[]): string[] {
  return [...new Set(tips.map((t) => t.categoryId))].sort((a, b) => orderOf(a) - orderOf(b));
}

/**
 * The category chips: the original six categories up front, every other category behind a More chip, as in
 * quick add. Only categories with tips get a chip.
 */
export function tipChipIds(tips: readonly Tip[]): { main: string[]; more: string[] } {
  const ids = tipCategoryIds(tips);
  return {
    main: ids.filter((id) => GUESS_CATEGORY_IDS.includes(id)),
    more: ids.filter((id) => !GUESS_CATEGORY_IDS.includes(id)),
  };
}

/** The tag under a tip: its category, and "Estimate" when no page states its number. */
export function tipTag(tip: Tip): string {
  const name = categoryName(tip.categoryId);
  return tip.source === 'Estimate' ? `${name} · Estimate` : name;
}
