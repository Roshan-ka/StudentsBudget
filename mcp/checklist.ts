import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CHECKLIST, CHECKLIST_GROUPS, CHECKLIST_WHO, type ChecklistGroup } from '../src/data/checklist.ts';
import { CITE_NOTE, countNote, narrowed, searchInput, type Noun } from './catalog.ts';
import { sourcedFields, sourcedShape, sourceLine } from './sourced.ts';

/** Words that find a checklist item; a test holds them to it, since the search input offers them as examples. */
export const CHECKLIST_SEARCH_EXAMPLES = ['BAföG', 'Kindergeld', 'residence permit'];

/** German names in the checklist, for the search's hints. */
const GERMAN_NAMES =
  'BAföG is the state student grant, Kindergeld child benefit, Wohngeld housing benefit, Rundfunkbeitrag the broadcasting fee';

/** Each group as the tool's text names it, and the noun its note counts in. */
const GROUP_NAMES: Record<ChecklistGroup, string> = { 'first-weeks': 'first weeks', money: 'money to claim' };
const GROUP_NOUNS: Record<ChecklistGroup, Noun> = {
  'first-weeks': ['thing to get done in the first weeks', 'things to get done in the first weeks'],
  money: ['benefit to claim', 'benefits to claim'],
};
const ALL_NOUN: Noun = ['checklist item for new students', 'checklist items for new students'];

/** Who an item is for, as the text says it after its group; nothing for everyone. */
const WHO_TEXT: Record<(typeof CHECKLIST_WHO)[number], string> = {
  everyone: '',
  'from-abroad': ', for students from abroad',
  bafoeg: ', for students on BAföG',
  'under-25': ', for students under 25',
};

const CHECKLIST_NOTE =
  'who says whom an item is for (everyone, from-abroad, bafoeg or under-25): a tag, never a reason to leave an item ' +
  'out. tipId, where there is one, is the find_tips tip that says more.';

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  group: z.enum(CHECKLIST_GROUPS),
  who: z.enum(CHECKLIST_WHO),
  tipId: z.string().nullable(),
  ...sourcedShape,
});

export type FoundChecklistItem = z.infer<typeof itemSchema>;
export type FoundChecklist = { note: string; items: FoundChecklistItem[] };

/**
 * The checklist items in a group holding every word of `search` (title, text or source), in the order the app's
 * checklist shows them (first weeks, then money to claim); all of the group's when none does.
 */
export function findChecklist(group?: ChecklistGroup, search?: string): FoundChecklist {
  const inGroup = CHECKLIST.filter((item) => group === undefined || item.group === group).sort(
    (a, b) => CHECKLIST_GROUPS.indexOf(a.group) - CHECKLIST_GROUPS.indexOf(b.group),
  );
  const found = narrowed(inGroup, search, (item) => [item.title, item.body, item.source]);
  const items = found.items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    group: item.group,
    who: item.who,
    tipId: item.tipId ?? null,
    ...sourcedFields(item),
  }));
  const noun = group === undefined ? ALL_NOUN : GROUP_NOUNS[group];
  const note = countNote(found, noun, { search, germanNames: GERMAN_NAMES });
  return { note: `${note} ${CITE_NOTE} ${CHECKLIST_NOTE}`, items };
}

export function checklistText({ note, items }: FoundChecklist): string {
  const lines = [note, ''];
  for (const item of items) {
    lines.push(`- ${item.title} (${GROUP_NAMES[item.group]}${WHO_TEXT[item.who]}): ${item.body} ${sourceLine(item)}.`);
  }
  return lines.join('\n');
}

export function registerFindChecklist(server: McpServer): void {
  server.registerTool(
    'find_checklist',
    {
      title: 'Checklist for new students in Regensburg',
      description:
        'What a student new to Regensburg, Germany, gets done in the first weeks (registering the address, health ' +
        'insurance for enrolment, the residence permit, a bank account, the Rundfunkbeitrag) and the money they can ' +
        'claim (BAföG, the study start grant, Kindergeld, family insurance, Wohngeld, the Rundfunkbeitrag exemption). ' +
        'Every item is stated on its source page: cite the source and the date it was checked. Regensburg only.',
      inputSchema: {
        group: z
          .enum(CHECKLIST_GROUPS)
          .optional()
          .describe('Only this group: first-weeks (things to get done) or money (benefits to claim). Leave it out for both.'),
        search: searchInput(CHECKLIST_SEARCH_EXAMPLES, GERMAN_NAMES),
      },
      outputSchema: { note: z.string(), items: z.array(itemSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ group, search }) => {
      const found = findChecklist(group, search);
      return { content: [{ type: 'text', text: checklistText(found) }], structuredContent: found };
    },
  );
}
