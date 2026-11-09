import type { Category, Entry } from '@/db/types';
import { keywordsOf } from '@/features/entries/quick-add';
import { chainRule, merchantKey } from './merchants';

// The category an imported row gets (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md). Roshan chose
// "save straight away" (09-11-2026), so this is the whole decision, and the student's own earlier choices come first:
// 1. what the student chose for this shop before: an imported entry of the same shop whose category they changed from
//    the import's guess, else an entry they typed whose first word is one of the row's words (as quick add learns);
// 2. the chain list (`merchants.ts`);
// 3. Other, or Other income.
// An imported entry whose category is still the import's guess is never learned from, so a wrong guess can't reinforce
// itself.

/** Where the category came from: the student's own choice, the chain list, or nothing (Other). */
export type CategorySource = 'yours' | 'typed' | 'chain' | 'fallback';

export type Categorized = { categoryId: string; source: CategorySource; merchant: string };

/** The part of a statement row the category depends on. */
export type CategorizeInput = { amountMinor: number; payee: string; purpose: string };

const FALLBACK = { expense: 'other', income: 'income-other' } as const;

/**
 * The category for a row of money out (an expense) or in (income), from the student's entries (`history`) and the
 * categories that exist. A learned category of the wrong kind (income for money out) or one that no longer exists is
 * passed over.
 */
export function categorize(row: CategorizeInput, history: readonly Entry[], categories: readonly Category[]): Categorized {
  const type = row.amountMinor < 0 ? 'expense' : 'income';
  const merchant = merchantKey(row.payee, row.purpose);
  const fits = (id: string) => categories.some((category) => category.id === id && (category.kind === 'income') === (type === 'income'));

  const yours = learnedChoice(merchant, type, history);
  if (yours !== null && fits(yours)) return { categoryId: yours, source: 'yours', merchant };

  const typed = typedChoice(`${row.payee} ${row.purpose}`, type, history);
  if (typed !== null && fits(typed)) return { categoryId: typed, source: 'typed', merchant };

  const text = `${row.payee} ${row.purpose}`;
  const chain = chainRule(text, type === 'expense' ? 'out' : 'in');
  if (chain !== null && fits(chain.categoryId)) return { categoryId: chain.categoryId, source: 'chain', merchant };
  // Money back from a shop on the list is a refund: other income, so balances stay right (spending isn't reduced).
  if (type === 'income' && chainRule(text, 'out') !== null) return { categoryId: FALLBACK.income, source: 'chain', merchant };

  return { categoryId: FALLBACK[type], source: 'fallback', merchant };
}

/** The category of the newest imported entry of this shop that the student moved away from the import's guess. */
function learnedChoice(merchant: string, type: 'expense' | 'income', history: readonly Entry[]): string | null {
  if (merchant === '') return null;
  let found: { categoryId: string; createdAt: string } | null = null;
  for (const entry of history) {
    if (entry.type !== type || entry.imported?.merchant !== merchant) continue;
    if (entry.categoryId === entry.imported.guess) continue;
    // createdAt is always written with toISOString(), so comparing the strings compares the times.
    if (found === null || entry.createdAt > found.createdAt) found = { categoryId: entry.categoryId, createdAt: entry.createdAt };
  }
  return found?.categoryId ?? null;
}

/**
 * The category of the newest entry the student typed (not imported, not posted by a schedule) whose note starts with
 * one of the row's words, the row's words tried in order: "REWE Markt GmbH" finds a typed "rewe 23,40".
 */
function typedChoice(text: string, type: 'expense' | 'income', history: readonly Entry[]): string | null {
  const latest = new Map<string, { categoryId: string; createdAt: string }>();
  for (const entry of history) {
    if (entry.type !== type || entry.recurring !== undefined || entry.imported !== undefined) continue;
    const first = keywordsOf(entry.note)[0];
    if (first === undefined) continue;
    const known = latest.get(first);
    if (known === undefined || entry.createdAt > known.createdAt) latest.set(first, { categoryId: entry.categoryId, createdAt: entry.createdAt });
  }
  for (const word of keywordsOf(text)) {
    const found = latest.get(word);
    if (found !== undefined) return found.categoryId;
  }
  return null;
}
