import { CATEGORIES } from '@/data/categories';
import { categoryName } from '@/features/entries/categories';
import { BUCKET_ID } from './aggregate';

/** What the bucket of everything that did not fit in the top 6 is called. */
export const BUCKET_LABEL = 'Everything else';

/** Names that would not fit beside a slice or a bar; the table, the tooltip and every other screen keep the full name. */
const SHORT_NAMES: Record<string, string> = {
  utilities: 'Utilities',
  'transport-pass': 'Transport pass',
  health: 'Health',
};

/** The name of a category as a chart writes it: short enough for a legend row or an axis. */
export function chartLabel(categoryId: string): string {
  if (categoryId === BUCKET_ID) return BUCKET_LABEL;
  return SHORT_NAMES[categoryId] ?? categoryName(categoryId);
}

const COLORED = new Set([...CATEGORIES.map((c) => c.id), BUCKET_ID]);

/**
 * The colour of a category, as a CSS value: its `--cat-<id>` variable, which `globals.css` defines for light and for
 * dark. A category keeps its colour whatever else is on the chart, so a reader who has learned "Food is orange" keeps
 * it. The bucket, and anything that is not a built-in category, is the neutral grey.
 */
export function chartColor(categoryId: string): string {
  return `var(--cat-${COLORED.has(categoryId) ? categoryId : BUCKET_ID})`;
}
