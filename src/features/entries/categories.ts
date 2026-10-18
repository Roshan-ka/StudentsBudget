import { CATEGORIES } from '@/data/categories';
import type { Category } from '@/db/types';

/** What quick add offers when it cannot tell the category from the note. */
export const FLEXIBLE_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind === 'flexible');

/** Everything an expense can be filed under. */
export const EXPENSE_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind !== 'income');

export const INCOME_CATEGORIES: Category[] = CATEGORIES.filter((c) => c.kind === 'income');

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));

/** The category's name, or the id itself for one that is not built in. */
export function categoryName(id: string): string {
  return NAMES.get(id) ?? id;
}
