import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TIPS } from '../src/data/tips.ts';
import { askedFor, categoryChoices, categoryIdsOf, categoryInput, categoryName, holds, orderOf, searchInput } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

const CATEGORY_IDS = categoryIdsOf(TIPS);

const tipSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  categoryId: z.string(),
  category: z.string(),
  ...sourcedShape,
});

export type FoundTip = z.infer<typeof tipSchema>;

/** The tips in a category and holding a word (title, text or category name), in the order the app's tips page shows. */
export function findTips(category?: string, search?: string): FoundTip[] {
  return TIPS.filter((t) => category === undefined || t.categoryId === category)
    .filter((t) => holds(search, t.title, t.body, categoryName(t.categoryId)))
    .sort((a, b) => orderOf(a.categoryId) - orderOf(b.categoryId))
    .map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      categoryId: t.categoryId,
      category: categoryName(t.categoryId),
      ...sourcedFields(t),
    }));
}

export function tipsText(found: FoundTip[], category?: string, search?: string): string {
  if (found.length === 0) {
    return `No Regensburg money tip matches ${askedFor(category, search)}. Categories with tips: ${categoryChoices(CATEGORY_IDS)}.`;
  }
  const lines = ['Money tips for students in Regensburg:'];
  for (const t of found) lines.push(`- ${t.title} (${t.category}): ${t.body} ${sourceLine(t)}.`);
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
      inputSchema: { category: categoryInput(CATEGORY_IDS), search: searchInput },
      outputSchema: { tips: z.array(tipSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ category, search }) => {
      const tips = findTips(category, search);
      return { content: [{ type: 'text', text: tipsText(tips, category, search) }], structuredContent: { tips } };
    },
  );
}
