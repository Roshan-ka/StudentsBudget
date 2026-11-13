// Which city items Ask sends with a question (the Groq switch, chunk 3, docs/superpowers/plans/2026-11-13-groq-free-plan.md).
// Groq's free plan takes 8,000 tokens a minute per model, and the whole pack is about 10,000, so Ask sends only the
// items whose words (pack.ts) match the question's, picked here without a model. The same question, conversation and
// spending always pick the same items in the same order.

import { CITY_PACK } from './city-pack.ts';
import { foldWords, renderPackBrief, type PackItem } from './pack.ts';

/** What a question picks its city items by. */
export type PackQuestion = {
  /** The question being asked now. */
  question: string;
  /** The conversation's earlier questions: their words count half, so a follow-up keeps its topic. */
  earlier: readonly string[];
  /** Euros spent this month by category id (the snapshot's envelopes): between items that match alike, more first. */
  spend: Readonly<Record<string, number>>;
};

/** At most 10 items, and at most 3,000 characters of them as `renderPackBrief` writes them. */
export const PICK_LIMITS = { max: 10, maxChars: 3_000 } as const;

/** How much a word of the question counts against a word of an earlier one. */
const QUESTION_WEIGHT = 2;
const EARLIER_WEIGHT = 1;

/** What a question that matches nothing gets: the typical monthly costs and the city's prices. */
const FALLBACK_KINDS: ReadonlySet<PackItem['kind']> = new Set<PackItem['kind']>(['range', 'price']);

/** How much a word counts against an item that holds only part of it ("semest" for "semesterbeitrag"). */
const PARTIAL = 0.5;

/**
 * How far two folded words are one: 1 when they are the same; `PARTIAL` when the shorter (5 letters or more) starts the
 * longer ("cheap", "cheaply") or the shorter (6 letters or more) ends it, as German compounds do ("beitrag",
 * "semesterbeitrag"); else 0.
 */
export function wordMatch(a: string, b: string): number {
  if (a === b) return 1;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const partial = (short.length >= 5 && long.startsWith(short)) || (short.length >= 6 && long.endsWith(short));
  return partial ? PARTIAL : 0;
}

/**
 * The city items for a question, best first. Each word of the question (twice) and of the earlier questions (once)
 * adds to every item it matches, more the fewer items it matches and half for a partial match; equal scores go by this
 * month's spending in the item's category, then by the pack's order. When no word matches, the ranges and prices stand
 * in. The picks stop at `limits.max` items, and skip an item that would take them over `limits.maxChars`.
 */
export function selectPack(
  ask: PackQuestion,
  pack: readonly PackItem[] = CITY_PACK,
  limits: { max: number; maxChars: number } = PICK_LIMITS,
): PackItem[] {
  const asked = foldWords(ask.question);
  const before = foldWords(ask.earlier.join('\n')).filter((word) => !asked.includes(word));
  const weighted = [
    ...asked.map((word) => ({ word, weight: QUESTION_WEIGHT })),
    ...before.map((word) => ({ word, weight: EARLIER_WEIGHT })),
  ];

  const wordsOf = pack.map((item) => item.words.split(' '));
  const scores = pack.map(() => 0);
  for (const { word, weight } of weighted) {
    const hits = wordsOf.map((words) => Math.max(0, ...words.map((other) => wordMatch(word, other))));
    const count = hits.filter((hit) => hit > 0).length;
    if (count === 0) continue;
    const rarity = Math.log(1 + pack.length / count);
    hits.forEach((hit, at) => {
      scores[at] += weight * rarity * hit;
    });
  }

  const spent = (item: PackItem): number => {
    const value = item.categoryId === null ? undefined : ask.spend[item.categoryId];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
  // Scores rounded, so two items that match the same words tie however the sums were added.
  const entries = pack.map((item, at) => ({ item, at, score: Math.round(scores[at] * 1e6) }));
  const matched = entries.filter((entry) => entry.score > 0);
  const ranked = (matched.length > 0 ? matched : entries.filter((entry) => FALLBACK_KINDS.has(entry.item.kind))).sort(
    (a, b) => b.score - a.score || spent(b.item) - spent(a.item) || a.at - b.at,
  );

  const picked: PackItem[] = [];
  let chars = 0;
  for (const { item } of ranked) {
    if (picked.length >= limits.max) break;
    const length = renderPackBrief([item]).length + 1;
    if (chars + length > limits.maxChars) continue;
    picked.push(item);
    chars += length;
  }
  return picked;
}
