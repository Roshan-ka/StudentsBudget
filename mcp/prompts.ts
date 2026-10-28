import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { UNIVERSITIES } from '@/features/profile/profile';

// MCP prompts: named templates the user picks, which Claude Code offers as slash commands
// (/mcp__studentsbudget__weekly_check_in). Each asks Claude to work through the server's own tools, in the app's
// calm wording and with its sources, so nothing in a prompt states a figure itself.

/** How every answer from these prompts is written: the app's rules for text, and the tools' for figures. */
const HOUSE_RULES =
  'Write it short and calm: a figure below zero is "€12 over", never "failed" or a warning. Write full dates as ' +
  'DD-MM-YYYY. Use only figures the tools return, cite the source and checked date of every Regensburg figure, call ' +
  'estimates estimates, and say so when a tool has nothing instead of guessing.';

function userMessage(text: string): GetPromptResult {
  return { messages: [{ role: 'user', content: { type: 'text', text } }] };
}

/**
 * The app's Sunday check-in, in a chat. week_check_in builds the week the way the app's check-in does (each envelope
 * against its share of the week, swaps only for those over it); budget_overview adds the month.
 */
export function weeklyCheckIn(): GetPromptResult {
  return userMessage(
    [
      'Do my StudentsBudget weekly check-in.',
      '1. Call week_check_in. If its state isn’t ready, tell me its note and stop there.',
      '2. Call budget_overview, for the month as a whole.',
      'Then write the check-in, one part of the week after the other (an earlier part first, when there is one):',
      '- each envelope’s line as week_check_in gives it, the ones over their share of the week first;',
      '- the week’s total line;',
      '- the swaps week_check_in gives, each with what it saves and its sources, and no others;',
      '- the week’s three biggest expenses by eurMinor, with their dates (a transfer is no spending).',
      'Then the month: what is left this month, and if plan.overBy is above zero, that the envelopes plan more than the month brings in.',
      'Say that the figures are as of my last Save from the phone (savedAt), so anything I entered since is missing. Quote my entry notes only when they help.',
      HOUSE_RULES,
    ].join('\n'),
  );
}

/** `ur` or `oth` in any case and spacing; anything else (an empty field included) is no university. */
function universityOf(given: string | undefined): 'ur' | 'oth' | undefined {
  const id = given?.trim().toLowerCase();
  return id === 'ur' || id === 'oth' ? id : undefined;
}

/** A first month in Regensburg for a new student: costs, the semester, tips and discounts, all sourced. */
export function newInRegensburg(given?: string): GetPromptResult {
  const university = universityOf(given);
  const name = university === undefined ? undefined : UNIVERSITIES.find((u) => u.id === university)?.name;
  const at = name === undefined ? '' : ` at ${name}`;
  const semester =
    university === undefined
      ? 'Call semester_info for both universities, for the current semester, the next one and its fee.'
      : `Call semester_info with university ${university}, for the current semester, the next one and its fee.`;
  // Typed but not one the tools know: say so, rather than refuse the whole prompt.
  const unknown = university === undefined && given?.trim() ? ` (I wrote “${given.trim()}”, but the tools only know UR and OTH, so cover both.)` : '';
  return userMessage(
    [
      `I’m a student new in Regensburg${at}. Help me plan my first month.${unknown}`,
      '1. Call regensburg_costs without a search, for what a student typically spends a month.',
      `2. ${semester}`,
      '3. Call find_tips without a search, and pick the five most useful for a new student.',
      '4. Call find_discounts without a search, and pick three for everyday life.',
      'Then give me:',
      '- a monthly budget per category as the ranges from regensburg_costs, rent first;',
      '- for what regensburg_costs has no range for (it has none for health insurance, phone or the broadcasting fee), what the tips state, or that there is no figure: never an estimate of your own;',
      '- the next semester fee and when re-registration is expected to open, if a page states them;',
      '- the five tips, each in a line or two, and the three discounts, each with who gets it and the proof it needs.',
      HOUSE_RULES,
    ].join('\n'),
  );
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'weekly_check_in',
    {
      title: 'Weekly check-in',
      description:
        'Your StudentsBudget check-in for the week, as the app’s: each envelope against its share of the week, ' +
        'the week’s total, a sourced swap for what is over, your biggest expenses, and the month. Reads your ' +
        'account, as of your last Save.',
    },
    () => weeklyCheckIn(),
  );
  server.registerPrompt(
    'new_in_regensburg',
    {
      title: 'New in Regensburg',
      description:
        'A first month in Regensburg for a new student: typical costs, the semester and its fee, money tips and ' +
        'student discounts, every figure with its source.',
      argsSchema: {
        // Prompt arguments arrive as typed, so any text is taken and read leniently (see universityOf).
        university: z.string().optional().describe('ur (Universität Regensburg) or oth (OTH Regensburg). Leave it out if unsure.'),
      },
    },
    ({ university }) => newInRegensburg(university),
  );
}
