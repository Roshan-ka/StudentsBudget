import { z } from 'zod';
import { CATEGORIES } from '../src/data/categories.ts';
import { formatMoney, type Minor } from '../src/lib/money.ts';

// The app's own helpers for these (src/features/…) import through `@/`, which Node's type stripping can't resolve,
// so the few the tools need live here. The tests check them against the app's.

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const ORDER = new Map(CATEGORIES.map((c) => [c.id, c.order]));

export function categoryName(id: string): string {
  return NAMES.get(id) ?? id;
}

/** The app's category order: the chips, the tips page and the setup steps all follow it. */
export function orderOf(categoryId: string): number {
  return ORDER.get(categoryId) ?? Number.MAX_SAFE_INTEGER;
}

/** The categories `items` use, in the app's order. */
export function categoryIdsOf(items: readonly { categoryId: string }[]): string[] {
  return [...new Set(items.map((i) => i.categoryId))].sort((a, b) => orderOf(a) - orderOf(b));
}

/** "eating-out (Eating out), going-out (Going out)": what a tool's category input accepts. */
export function categoryChoices(ids: readonly string[]): string {
  return ids.map((id) => `${id} (${categoryName(id)})`).join(', ');
}

/** A tool input that takes one of `ids`, described with their names. */
export function categoryInput(ids: readonly string[]) {
  return z
    .enum(ids as [string, ...string[]])
    .optional()
    .describe(`Only this category: ${categoryChoices(ids)}. Leave it out for all.`);
}

/** A tool input for a word or two to look for. */
export const searchInput = z
  .string()
  .max(60)
  .optional()
  .describe('A word or two to look for, such as "swimming" or "cinema". Leave it out for everything.');

/** True when `search` is empty, or when one of `texts` holds it, in any case. */
export function holds(search: string | undefined, ...texts: string[]): boolean {
  const words = (search ?? '').trim().toLowerCase();
  return words === '' || texts.some((text) => text.toLowerCase().includes(words));
}

/** "€14.50" for an amount with cents, "€34" for a whole-euro one, as the app's swap lines write it. */
export function amountText(minor: Minor): string {
  return formatMoney(minor, 'EUR', minor % 100 === 0 ? { whole: true } : undefined);
}

/** What a filter asked for, for the "nothing matches" line: `category "food" and "pizza"`. */
export function askedFor(category: string | undefined, search: string | undefined): string {
  const parts = [
    ...(category ? [`category "${category}"`] : []),
    ...(search?.trim() ? [`"${search.trim()}"`] : []),
  ];
  return parts.join(' and ');
}
