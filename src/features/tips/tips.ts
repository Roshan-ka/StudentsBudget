import { CORE_FLEXIBLE_IDS } from '@/data/categories';
import type { Tip } from '@/data/tips';
import { orderOf } from '@/features/entries/categories';
import { categoryNameIn } from '@/i18n/category-name';
import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';

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
    main: ids.filter((id) => CORE_FLEXIBLE_IDS.includes(id)),
    more: ids.filter((id) => !CORE_FLEXIBLE_IDS.includes(id)),
  };
}

/** The tag under a tip, in `lang`: its category, and "Estimate" when no page states its number. */
export function tipTag(tip: Tip, lang: Language = 'en'): string {
  const t = MESSAGES[lang];
  const name = categoryNameIn(t, tip.categoryId);
  return tip.source === 'Estimate' ? `${name} · ${t.common.estimate}` : name;
}
