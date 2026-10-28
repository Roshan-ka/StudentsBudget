import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SWAPS, type Swap } from '../src/data/swaps.ts';
import { savingText } from '@/features/swaps/suggest';
import { amountText, categoryIdsOf, categoryInput, categoryName, CITE_NOTE, countNote, narrowed, orderOf, searchInput } from './catalog.ts';
import { isEstimate, sourcedShape, sourceLine } from './sourced.ts';

const CATEGORY_IDS = categoryIdsOf(SWAPS);

/** Words that find a swap; a test holds them to it, since the search input offers them as examples. */
export const SWAP_SEARCH_EXAMPLES = ['Mensa', 'cinema', 'Deutschlandticket'];

/** German names in the swaps, for the search's hints. */
const GERMAN_NAMES = 'Mensa is the university canteen, Kinos a cinema';

/** A swap's `estimate` is about its saving: both of its prices are stated on pages. */
const SWAP_ESTIMATE_NOTE =
  'estimate: true means the saving rests on an assumption no page states (both prices are stated), so call the saving an estimate.';

export const swapSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  categoryId: z.string(),
  category: z.string(),
  from: z.string(),
  to: z.string(),
  fromMinor: z.number().int(),
  toMinor: z.number().int(),
  per: z.string(),
  savingPerUseMinor: z.number().int(),
  saving: z.string(),
  ...sourcedShape,
  toSource: z.string().optional(),
  toUrl: z.string().optional(),
});

export type FoundSwap = z.infer<typeof swapSchema>;

export function foundSwap(s: Swap): FoundSwap {
  return {
    id: s.id,
    title: s.title,
    body: s.body,
    categoryId: s.categoryId,
    category: categoryName(s.categoryId),
    from: amountText(s.fromMinor),
    to: amountText(s.toMinor),
    fromMinor: s.fromMinor,
    toMinor: s.toMinor,
    per: s.per,
    savingPerUseMinor: s.fromMinor - s.toMinor,
    saving: savingText(s.fromMinor - s.toMinor),
    // A swap's saving can rest on an assumption even when both prices are stated.
    estimate: s.estimate === true || isEstimate(s),
    source: s.source,
    url: s.url,
    checked: s.checked,
    ...(s.toSource === undefined ? {} : { toSource: s.toSource }),
    ...(s.toUrl === undefined ? {} : { toUrl: s.toUrl }),
  };
}

export type FoundSwaps = { note: string; swaps: FoundSwap[] };

/**
 * The swaps in a category holding every word of `search` (title, text, category or a source), in the app's category
 * order with the biggest saving first within one; all of the category's when none does.
 */
export function findSwaps(category?: string, search?: string): FoundSwaps {
  const inCategory = SWAPS.filter((s) => category === undefined || s.categoryId === category)
    .map(foundSwap)
    .sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId) || b.savingPerUseMinor - a.savingPerUseMinor);
  const found = narrowed(inCategory, search, (s) => [s.title, s.body, s.categoryId, s.category, s.source, s.toSource ?? '']);
  const note =
    `${countNote(found, ['cheaper swap in Regensburg', 'cheaper swaps in Regensburg'], { search, category, germanNames: GERMAN_NAMES })} ${CITE_NOTE} ${SWAP_ESTIMATE_NOTE} ` +
    'source and url state the usual price; toSource and toUrl, where given, state the cheaper one.';
  return { note, swaps: found.items };
}

export function swapsText({ note, swaps }: FoundSwaps): string {
  const lines = [note, ''];
  for (const s of swaps) {
    // Without its own source, the cheaper price is stated on the same page as the usual one.
    const prices =
      s.toSource === undefined
        ? `${sourceLine(s)}.`
        : `Usual price: ${sourceLine(s)}. Cheaper price: ${s.toSource}, ${s.toUrl ?? s.url}.`;
    const estimate = s.estimate ? ' The saving rests on an assumption no page states, so it is an estimate.' : '';
    lines.push(
      `- ${s.title} (${s.category}): ${s.to} instead of ${s.from} per ${s.per}, about ${s.saving} less. ${s.body} ${prices}${estimate}`,
    );
  }
  return lines.join('\n');
}

export function registerSuggestSwaps(server: McpServer): void {
  server.registerTool(
    'suggest_swaps',
    {
      title: 'Regensburg cheaper swaps',
      description:
        'Cheaper alternatives for students in Regensburg, Germany, such as the Mensa instead of a restaurant: the ' +
        'usual price, the cheaper price and the saving per use. Both prices are sourced: cite the sources and the ' +
        'date they were checked, and call a saving marked as an estimate an estimate. Regensburg only.',
      inputSchema: { category: categoryInput(CATEGORY_IDS), search: searchInput(SWAP_SEARCH_EXAMPLES, GERMAN_NAMES) },
      outputSchema: { note: z.string(), swaps: z.array(swapSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, search }) => {
      const found = findSwaps(category, search);
      return { content: [{ type: 'text', text: swapsText(found) }], structuredContent: found };
    },
  );
}
