import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DISCOUNTS } from '../src/data/discounts.ts';
import { daysBetween, type IsoDate } from '../src/lib/dates.ts';
import { askedFor, categoryChoices, categoryIdsOf, categoryInput, categoryName, holds, orderOf, searchInput } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

/** As the app's `STALE_AFTER_DAYS`: a discount nobody has confirmed for eight weeks may be outdated. */
export const STALE_AFTER_DAYS = 56;

const CATEGORY_IDS = categoryIdsOf(DISCOUNTS);

const discountSchema = z.object({
  id: z.string(),
  place: z.string(),
  offer: z.string(),
  conditions: z.string(),
  address: z.string(),
  categoryId: z.string(),
  category: z.string(),
  mayBeOutdated: z.boolean(),
  ...sourcedShape,
});

export type FoundDiscount = z.infer<typeof discountSchema>;

/**
 * The discounts in a category and holding a word (place, offer, conditions, address or category name), in the app's
 * category order. The phone's "still works" votes aren't here, so only the source check dates them.
 */
export function findDiscounts(today: IsoDate, category?: string, search?: string): FoundDiscount[] {
  return DISCOUNTS.filter((d) => category === undefined || d.categoryId === category)
    .filter((d) => holds(search, d.place, d.offer, d.conditions, d.address, categoryName(d.categoryId)))
    .sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId))
    .map((d) => ({
      id: d.id,
      place: d.place,
      offer: d.offer,
      conditions: d.conditions,
      address: d.address,
      categoryId: d.categoryId,
      category: categoryName(d.categoryId),
      mayBeOutdated: daysBetween(d.checked, today) >= STALE_AFTER_DAYS,
      ...sourcedFields(d),
    }));
}

export function discountsText(found: FoundDiscount[], category?: string, search?: string): string {
  if (found.length === 0) {
    return `No student discount in Regensburg matches ${askedFor(category, search)}. Categories with discounts: ${categoryChoices(CATEGORY_IDS)}.`;
  }
  const lines = ['Student discounts in Regensburg:'];
  for (const d of found) {
    const stale = d.mayBeOutdated ? ' Nobody has confirmed it for 8 weeks, so it may be outdated.' : '';
    lines.push(
      `- ${d.place} (${d.category}): ${d.offer}. Who and when: ${d.conditions} Address: ${d.address}. ${sourceLine(d)}.${stale}`,
    );
  }
  return lines.join('\n');
}

export function registerFindDiscounts(server: McpServer, today: () => IsoDate): void {
  server.registerTool(
    'find_discounts',
    {
      title: 'Regensburg student discounts',
      description:
        'Student discounts at places in Regensburg, Germany (cinemas, theatres, pools, museums, restaurants and ' +
        'more): the offer, who gets it and when, and the address. Each one is stated on the place’s own page or a ' +
        'Studierendenwerk or university page: cite that source and the date it was checked, and pass on the ' +
        'conditions. No alcohol deals. Regensburg only.',
      inputSchema: { category: categoryInput(CATEGORY_IDS), search: searchInput },
      outputSchema: { discounts: z.array(discountSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, search }) => {
      const discounts = findDiscounts(today(), category, search);
      return {
        content: [{ type: 'text', text: discountsText(discounts, category, search) }],
        structuredContent: { discounts },
      };
    },
  );
}
