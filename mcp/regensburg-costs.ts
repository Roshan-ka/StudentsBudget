import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CITIES } from '../src/data/cities.ts';
import { formatMoney, formatRange } from '../src/lib/money.ts';
import { categoryName } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

const city = CITIES.regensburg;

const rangeSchema = z.object({
  categoryId: z.string(),
  category: z.string(),
  range: z.string(),
  minMinor: z.number().int(),
  maxMinor: z.number().int(),
  ...sourcedShape,
});
const priceSchema = z.object({ label: z.string(), price: z.string(), minor: z.number().int(), ...sourcedShape });
const outputShape = { ranges: z.array(rangeSchema), prices: z.array(priceSchema) };

export type CostRange = z.infer<typeof rangeSchema>;
export type CostPrice = z.infer<typeof priceSchema>;
export type RegensburgCosts = { ranges: CostRange[]; prices: CostPrice[] };

/** The monthly ranges and single prices, narrowed to those whose name holds `search` (any case) when it is given. */
export function regensburgCosts(search = ''): RegensburgCosts {
  const words = search.trim().toLowerCase();
  const matches = (...names: string[]) => names.some((name) => name.toLowerCase().includes(words));
  return {
    ranges: city.ranges
      .map((r) => ({
        categoryId: r.categoryId,
        category: categoryName(r.categoryId),
        range: formatRange(r.minMinor, r.maxMinor),
        minMinor: r.minMinor,
        maxMinor: r.maxMinor,
        ...sourcedFields(r),
      }))
      .filter((r) => matches(r.categoryId, r.category)),
    prices: city.prices
      .map((p) => ({ label: p.label, price: formatMoney(p.minor, 'EUR'), minor: p.minor, ...sourcedFields(p) }))
      .filter((p) => matches(p.label)),
  };
}

/** The same as text, one figure per line with where it comes from. */
export function costsText(costs: RegensburgCosts, search = ''): string {
  if (costs.ranges.length === 0 && costs.prices.length === 0) {
    const ranges = city.ranges.map((r) => categoryName(r.categoryId)).join(', ');
    const prices = city.prices.map((p) => p.label).join(', ');
    return `Nothing in the Regensburg costs matches "${search.trim()}". Monthly ranges: ${ranges}. Single prices: ${prices}.`;
  }
  const lines: string[] = [];
  if (costs.ranges.length > 0) {
    lines.push('What a student in Regensburg spends a month, in euros:');
    for (const r of costs.ranges) lines.push(`- ${r.category}: ${r.range} a month. ${sourceLine(r)}.`);
  }
  if (costs.prices.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Single prices in Regensburg:');
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
      inputSchema: {
        search: z
          .string()
          .max(60)
          .optional()
          .describe('A word to narrow the list, such as "rent", "food" or "gym". Leave it out for everything.'),
      },
      outputSchema: outputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search }) => {
      const costs = regensburgCosts(search);
      return { content: [{ type: 'text', text: costsText(costs, search) }], structuredContent: costs };
    },
  );
}
