import { CATEGORIES } from '@/data/categories';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { BUCKET_ID } from './aggregate';

/**
 * The name of a category as a chart writes it, in the dictionary's language: short enough for a legend row or an
 * axis. A name that would not fit beside a slice or a bar has a shorter one (`charts.shortNames`); the table, the
 * tooltip and every other screen keep the full name. The bucket of everything that did not fit in the top 6 is
 * "Everything else".
 */
export function chartLabel(categoryId: string, t: Messages): string {
  if (categoryId === BUCKET_ID) return t.charts.bucket;
  return (t.charts.shortNames as Record<string, string>)[categoryId] ?? categoryNameIn(t, categoryId);
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

/** How much of the category's colour a tinted block takes: tokens.test.ts holds its text to 4.5:1 at this share. */
export const TINT_SHARE = 22;

/**
 * The pale block a category sits on (redesign, chunk 4: an envelope on Home): its colour mixed into the card colour,
 * so a dark theme that changes either changes the tint with it.
 */
export function categoryTint(categoryId: string): string {
  return `color-mix(in oklch, ${chartColor(categoryId)} ${TINT_SHARE}%, var(--card))`;
}
