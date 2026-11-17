import type { Entry } from '@/db/types';
import { chainRule, fold } from '@/features/import/merchants';
import { suggestCategory } from './quick-add';

/**
 * Food and drink words a first line is likely to use, for a phone with no history yet (review P2, 17-11-2026: the
 * hint's own "döner 6" asked which category). Matched as whole words on the folded line, accents dropped, so "Döner",
 * "doener" and "Café" all count. No alcohol (CLAUDE.md's data rules). Short on purpose: anything else asks once, and
 * the student's choice then teaches `suggestCategory`.
 */
const WORD_RULES: readonly { categoryId: string; pattern: RegExp }[] = [
  {
    categoryId: 'eating-out',
    pattern:
      /\b(doener|doner|kebab|kebap|duerum|durum|pizza|burger|pommes|falafel|imbiss|sushi|kaffee|coffee|cafe|cappuccino|baecker|baeckerei|bakery|brezel|breze|restaurant|resto)\b/,
  },
  { categoryId: 'food', pattern: /\b(groceries|lebensmittel|supermarkt|supermarket|supermarche|supermercado)\b/ },
];

/** The line as the word rules read it: `fold`ed (umlauts written out), then any other accent dropped. */
function folded(note: string): string {
  return fold(note).normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * The category the words alone suggest, or null: a shop on the CSV import's chain list first ("rewe" is groceries,
 * "mensa" eating out), then the food and drink words above.
 */
export function wordCategory(note: string): string | null {
  const chain = chainRule(note, 'out');
  if (chain !== null) return chain.categoryId;
  const text = folded(note);
  return WORD_RULES.find((rule) => rule.pattern.test(text))?.categoryId ?? null;
}

/**
 * Quick add's category for a line: the student's own earlier choice (`suggestCategory`) first, else what the words
 * suggest (`wordCategory`), else null and the chips ask.
 */
export function guessCategory(note: string, history: Entry[]): string | null {
  return suggestCategory(note, history) ?? wordCategory(note);
}
