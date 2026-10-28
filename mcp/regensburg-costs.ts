import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CITIES } from '../src/data/cities.ts';
import { formatMoney, formatRange } from '../src/lib/money.ts';
import { categoryName, CITE_NOTE, countNote, narrowed, searchInput } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

const city = CITIES.regensburg;

/** Words that find a cost figure; a test holds them to it, since the search input offers them as examples. */
export const COST_SEARCH_EXAMPLES = ['rent', 'room', 'gym'];

const rangeSchema = z.object({
  categoryId: z.string(),
  category: z.string(),
  range: z.string(),
  minMinor: z.number().int(),
  maxMinor: z.number().int(),
  ...sourcedShape,
});
const priceSchema = z.object({ label: z.string(), price: z.string(), minor: z.number().int(), ...sourcedShape });
const outputShape = { note: z.string(), ranges: z.array(rangeSchema), prices: z.array(priceSchema) };

export type CostRange = z.infer<typeof rangeSchema>;
export type CostPrice = z.infer<typeof priceSchema>;
export type RegensburgCosts = { note: string; ranges: CostRange[]; prices: CostPrice[] };

const RANGES: CostRange[] = city.ranges.map((r) => ({
  categoryId: r.categoryId,
  category: categoryName(r.categoryId),
  range: formatRange(r.minMinor, r.maxMinor),
  minMinor: r.minMinor,
  maxMinor: r.maxMinor,
  ...sourcedFields(r),
}));
const PRICES: CostPrice[] = city.prices.map((p) => ({
  label: p.label,
  price: formatMoney(p.minor, 'EUR'),
  minor: p.minor,
  ...sourcedFields(p),
}));

/**
 * The monthly ranges and single prices holding every word of `search` (in a name or a source). When nothing does,
 * all of them, and the note says so.
 */
export function regensburgCosts(search?: string): RegensburgCosts {
  // One search over both lists: a hit in either keeps the other narrowed, to nothing if need be.
  const found = narrowed([...RANGES, ...PRICES], search, (item) =>
    'range' in item ? [item.categoryId, item.category, item.source] : [item.label, item.source],
  );
  const ranges = found.items.filter((item): item is CostRange => 'range' in item);
  const prices = found.items.filter((item): item is CostPrice => 'price' in item);
  const note = countNote(found, ['Regensburg cost figure', 'Regensburg cost figures'], { search });
  return { note: `${note} ${CITE_NOTE}`, ranges, prices };
}

/** The same as text, one figure per line with where it comes from. */
export function costsText(costs: RegensburgCosts): string {
  const lines = [costs.note];
  if (costs.ranges.length > 0) {
    lines.push('', 'What a student in Regensburg spends a month, in euros:');
    for (const r of costs.ranges) lines.push(`- ${r.category}: ${r.range} a month. ${sourceLine(r)}.`);
  }
  if (costs.prices.length > 0) {
    lines.push('', 'Single prices in Regensburg:');
    for (const p of costs.prices) lines.push(`- ${p.label}: ${p.price}. ${sourceLine(p)}.`);
  }
  return lines.join('\n');
}

export function registerRegensburgCosts(server: McpServer): void {
  server.registerTool(
    'regensburg_costs',
    {
      title: 'Regensburg student costs',
      description:
        'What a student in Regensburg, Germany, typically spends a month per category (rent, food, eating out, ' +
        'going out, transport, shopping, other), and single prices such as a Mensa meal or a gym month. Every ' +
        'figure comes with its source, URL and the date it was checked: cite them in the answer, and call a ' +
        'figure marked as an estimate an estimate. Regensburg only; there is no data for other cities.',
      inputSchema: { search: searchInput(COST_SEARCH_EXAMPLES) },
      outputSchema: outputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search }) => {
      const costs = regensburgCosts(search);
      return { content: [{ type: 'text', text: costsText(costs) }], structuredContent: costs };
    },
  );
}
