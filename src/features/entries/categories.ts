import { CATEGORIES, GUESS_CATEGORY_IDS } from '@/data/categories';
import type { Category } from '@/db/types';

/** What quick add offers when it cannot tell the category from the note. */
export const FLEXIBLE_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind === 'flexible');

/** The flexible categories setup asks a guess for. */
export const GUESS_CATEGORIES: Category[] = FLEXIBLE_CATEGORIES.filter((c) => GUESS_CATEGORY_IDS.includes(c.id));

/** Everything an expense can be filed under. */
export const EXPENSE_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind !== 'income');

export const INCOME_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind === 'income');

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));

/** The category's name, or the id itself for one that is not built in. */
export function categoryName(id: string): string {
  return NAMES.get(id) ?? id;
}

const ORDER = new Map(CATEGORIES.map((c) => [c.id, c.order]));

/** Position in the built-in list; a category that is not built in goes last. */
export function orderOf(categoryId: string): number {
  return ORDER.get(categoryId) ?? Number.MAX_SAFE_INTEGER;
}
