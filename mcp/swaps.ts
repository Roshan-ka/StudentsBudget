import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SWAPS, type Swap } from '../src/data/swaps.ts';
import type { Minor } from '../src/lib/money.ts';
import { amountText, askedFor, categoryChoices, categoryIdsOf, categoryInput, categoryName, holds, orderOf, searchInput } from './catalog.ts';
import { isEstimate, sourcedShape, sourceLine } from './sourced.ts';

const CATEGORY_IDS = categoryIdsOf(SWAPS);

/**
 * The saving as the app's swap line says it: whole euros rounded down, so it never flatters ("about €10" for
 * €10.70), except that a saving under €1 keeps its cents.
 */
export function savingText(minor: Minor): string {
  return minor < 100 ? amountText(minor) : amountText(Math.floor(minor / 100) * 100);
}

const swapSchema = z.object({
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

function found(s: Swap): FoundSwap {
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

/** The swaps in a category and holding a word, in the app's category order, the biggest saving first within one. */
export function findSwaps(category?: string, search?: string): FoundSwap[] {
  return SWAPS.filter((s) => category === undefined || s.categoryId === category)
    .filter((s) => holds(search, s.title, s.body, categoryName(s.categoryId)))
    .map(found)
    .sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId) || b.savingPerUseMinor - a.savingPerUseMinor);
}

export function swapsText(swaps: FoundSwap[], category?: string, search?: string): string {
  if (swaps.length === 0) {
    return `No Regensburg swap matches ${askedFor(category, search)}. Categories with swaps: ${categoryChoices(CATEGORY_IDS)}.`;
  }
  const lines = ['Cheaper swaps in Regensburg, each with both prices sourced:'];
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
      inputSchema: { category: categoryInput(CATEGORY_IDS), search: searchInput },
      outputSchema: { swaps: z.array(swapSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, search }) => {
      const swaps = findSwaps(category, search);
      return { content: [{ type: 'text', text: swapsText(swaps, category, search) }], structuredContent: { swaps } };
    },
  );
}
