import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TIPS } from '../src/data/tips.ts';
import { categoryIdsOf, categoryInput, categoryName, CITE_NOTE, countNote, ESTIMATE_NOTE, narrowed, orderOf, searchInput } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

const CATEGORY_IDS = categoryIdsOf(TIPS);

/** Words that find a tip; a test holds them to it, since the search input offers them as examples. */
export const TIP_SEARCH_EXAMPLES = ['Mensa', 'library', 'Rundfunkbeitrag'];

/** German names in the tips, for the search's hints. */
const GERMAN_NAMES = 'Mensa is the university canteen, Wohngeld housing benefit, Rundfunkbeitrag the broadcasting fee';

const tipSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  categoryId: z.string(),
  category: z.string(),
  ...sourcedShape,
});

export type FoundTip = z.infer<typeof tipSchema>;
export type FoundTips = { note: string; tips: FoundTip[] };

/**
 * The tips in a category holding every word of `search` (title, text, category or source), in the order the app's
 * tips page shows; all of the category's when none does.
 */
export function findTips(category?: string, search?: string): FoundTips {
  const inCategory = TIPS.filter((t) => category === undefined || t.categoryId === category).sort(
    (a, b) => orderOf(a.categoryId) - orderOf(b.categoryId),
  );
  const found = narrowed(inCategory, search, (t) => [t.title, t.body, t.categoryId, categoryName(t.categoryId), t.source]);
  const tips = found.items.map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    categoryId: t.categoryId,
    category: categoryName(t.categoryId),
    ...sourcedFields(t),
  }));
  const note = countNote(found, ['Regensburg money tip', 'Regensburg money tips'], { search, category, germanNames: GERMAN_NAMES });
  return { note: `${note} ${CITE_NOTE} ${ESTIMATE_NOTE}`, tips };
}

export function tipsText({ note, tips }: FoundTips): string {
  const lines = [note, ''];
  for (const t of tips) lines.push(`- ${t.title} (${t.category}): ${t.body} ${sourceLine(t)}.`);
  return lines.join('\n');
}

export function registerFindTips(server: McpServer): void {
  server.registerTool(
    'find_tips',
    {
      title: 'Regensburg money tips',
      description:
        'Ways for students in Regensburg, Germany, to spend less: the Mensa, the semester ticket, the library, free ' +
        'museums and more. Every number in a tip is stated on its source page: cite the source and the date it ' +
        'was checked, and call a tip marked as an estimate an estimate. Regensburg only.',
      inputSchema: { category: categoryInput(CATEGORY_IDS), search: searchInput(TIP_SEARCH_EXAMPLES, GERMAN_NAMES) },
      outputSchema: { note: z.string(), tips: z.array(tipSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, search }) => {
      const found = findTips(category, search);
      return { content: [{ type: 'text', text: tipsText(found) }], structuredContent: found };
    },
  );
}
