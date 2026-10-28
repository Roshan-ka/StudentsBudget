import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DISCOUNTS } from '../src/data/discounts.ts';
import { daysBetween, type IsoDate } from '../src/lib/dates.ts';
import { categoryIdsOf, categoryInput, categoryName, CITE_NOTE, countNote, ESTIMATE_NOTE, narrowed, orderOf, searchInput } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

/** As the app's `STALE_AFTER_DAYS`: a discount nobody has confirmed for eight weeks may be outdated. */
export const STALE_AFTER_DAYS = 56;

const CATEGORY_IDS = categoryIdsOf(DISCOUNTS);

/** Words that find a discount; a test holds them to it, since the search input offers them as examples. */
export const DISCOUNT_SEARCH_EXAMPLES = ['pool', 'museum', 'Mensa'];

/** German names in the discounts, for the search's hints. */
const GERMAN_NAMES = 'Westbad is a pool, Kinos a cinema, Stadtbücherei the city library';

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
export type FoundDiscounts = { note: string; discounts: FoundDiscount[] };

/**
 * The discounts in a category holding every word of `search` (place, offer, conditions, address, category or source),
 * in the app's category order; all of the category's when none does. The phone's "still works" votes aren't here, so
 * only the source check dates a discount.
 */
export function findDiscounts(today: IsoDate, category?: string, search?: string): FoundDiscounts {
  const inCategory = DISCOUNTS.filter((d) => category === undefined || d.categoryId === category).sort(
    (a, b) => orderOf(a.categoryId) - orderOf(b.categoryId),
  );
  const found = narrowed(inCategory, search, (d) => [
    d.place,
    d.offer,
    d.conditions,
    d.address,
    d.categoryId,
    categoryName(d.categoryId),
    d.source,
  ]);
  const discounts = found.items.map((d) => ({
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
  const note =
    `${countNote(found, ['student discount in Regensburg', 'student discounts in Regensburg'], { search, category, germanNames: GERMAN_NAMES })} ${CITE_NOTE} ${ESTIMATE_NOTE} ` +
    'Pass on the conditions (who gets it, when, what proof). mayBeOutdated: true means the source was last checked 8 or more weeks ago, so say it may have changed.';
  return { note, discounts };
}

export function discountsText({ note, discounts }: FoundDiscounts): string {
  const lines = [note, ''];
  for (const d of discounts) {
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
      inputSchema: { category: categoryInput(CATEGORY_IDS), search: searchInput(DISCOUNT_SEARCH_EXAMPLES, GERMAN_NAMES) },
      outputSchema: { note: z.string(), discounts: z.array(discountSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, search }) => {
      const found = findDiscounts(today(), category, search);
      return { content: [{ type: 'text', text: discountsText(found) }], structuredContent: found };
    },
  );
}
