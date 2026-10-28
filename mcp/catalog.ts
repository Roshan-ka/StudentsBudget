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

/** A tool input for words to look for; `examples` are words that find something in that tool (a test checks). */
export function searchInput(examples: readonly string[]) {
  return z
    .string()
    .max(60)
    .optional()
    .describe(
      `Words to look for, such as ${examples.map((e) => `"${e}"`).join(' or ')}: every word must start a word in ` +
        'the item. Many names are German (Westbad is a pool, Kinos a cinema), so for a broad question leave it ' +
        'out: the list is short. When nothing matches, everything is returned instead.',
    );
}

/** The words of a search, lower case. */
function wordsOf(search: string | undefined): string[] {
  return (search ?? '').toLowerCase().split(/\s+/).filter((w) => w !== '');
}

const escaped = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when every word of `search` starts a word in one of `texts`, in any case; true for an empty search. At the
 * start of a word, so "rent" finds "Rent" and "rental" but not "current".
 */
export function holds(search: string | undefined, ...texts: string[]): boolean {
  const haystack = texts.join('\n');
  return wordsOf(search).every((word) => new RegExp(`(^|[^\\p{L}\\p{N}])${escaped(word)}`, 'iu').test(haystack));
}

/**
 * `items` narrowed to those holding `search`. When none does, all of them come back with `matched` false, so the
 * model can still pick what fits (a German place name can hide "pool") instead of reading an empty list.
 */
export function narrowed<T>(
  items: readonly T[],
  search: string | undefined,
  textsOf: (item: T) => string[],
): Narrowed<T> {
  const found = items.filter((item) => holds(search, ...textsOf(item)));
  return found.length > 0 || wordsOf(search).length === 0
    ? { items: found, matched: true, total: items.length }
    : { items: [...items], matched: false, total: items.length };
}

export type Narrowed<T> = { items: T[]; matched: boolean; total: number };

/** A noun in the singular and the plural: ['cheaper swap', 'cheaper swaps']. */
export type Noun = readonly [one: string, many: string];

/**
 * The start of a tool's `note`: how many items there are, and what the search did. A search that finds some says
 * how many of how many, since a German name can hide the English word asked for.
 */
export function countNote(
  { items, matched, total }: Narrowed<unknown>,
  [one, many]: Noun,
  { search, category }: { search?: string; category?: string },
): string {
  const where = category === undefined ? '' : ` in ${categoryName(category)}`;
  const asked = search?.trim();
  if (!matched) {
    return `Nothing matched "${asked}", so all ${total} ${many}${where} are listed instead: pick the ones that fit the question, or say that none does.`;
  }
  if (wordsOf(search).length === 0) return `${total} ${total === 1 ? one : many}${where}.`;
  return (
    `${items.length} of the ${total} ${many}${where} ${items.length === 1 ? 'matches' : 'match'} "${asked}". ` +
    `Names are often German (Westbad is a pool, Kinos a cinema): to be sure nothing is missed, call again without search and look through all ${total}.`
  );
}

/** The end of every list tool's `note`. */
export const CITE_NOTE =
  'Cite each item’s source, URL and checked date when you use it. estimate: true means no page states the number, so call it an estimate.';

/** "€14.50" for an amount with cents, "€34" for a whole-euro one, as the app's swap lines write it. */
export function amountText(minor: Minor): string {
  return formatMoney(minor, 'EUR', minor % 100 === 0 ? { whole: true } : undefined);
}
