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

/** The app's Sunday check-in, in a chat: the week and month so far, what is over, and a sourced swap or two. */
export function weeklyCheckIn(): GetPromptResult {
  return userMessage(
    [
      'Do my StudentsBudget weekly check-in.',
      '1. Call budget_overview. If its state isn’t ready, tell me its note and stop there.',
      '2. Call recent_entries for this month.',
      '3. For each envelope that is over its plan, call suggest_swaps with that category. Skip it when the tool has no swap for it.',
      'Then write the check-in:',
      '- what is left this week and this month;',
      '- the envelopes that are over, and by how much;',
      '- this week’s biggest few expenses from recent_entries, with their dates (leave out transfers and anything marked beforeSetup);',
      '- if plan.overBy is above zero, that the envelopes plan more than the month brings in;',
      '- one or two swaps that fit, each with what it saves and its sources.',
      'Say that the figures are as of my last Save from the phone (savedAt), so anything I entered since is missing.',
      HOUSE_RULES,
    ].join('\n'),
  );
}

/** A first month in Regensburg for a new student: costs, the semester, tips and discounts, all sourced. */
export function newInRegensburg(university?: 'ur' | 'oth'): GetPromptResult {
  const name = university === undefined ? undefined : UNIVERSITIES.find((u) => u.id === university)?.name;
  const at = name === undefined ? '' : ` at ${name}`;
  const semester =
    university === undefined
      ? 'Call semester_info for both universities, for the current semester, the next one and its fee.'
      : `Call semester_info with university ${university}, for the current semester, the next one and its fee.`;
  return userMessage(
    [
      `I’m a student new in Regensburg${at}. Help me plan my first month.`,
      '1. Call regensburg_costs without a search, for what a student typically spends a month.',
      `2. ${semester}`,
      '3. Call find_tips without a search, and pick the five most useful for a new student.',
      '4. Call find_discounts without a search, and pick three for everyday life.',
      'Then give me:',
      '- a monthly budget per category as the ranges from regensburg_costs, rent first;',
      '- the next semester fee and when re-registration opens, if a page states them;',
      '- the five tips and three discounts, each in a line or two.',
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
        'Your StudentsBudget check-in for the week: what is left this week and this month, what is over, your ' +
        'biggest expenses and a sourced swap or two. Reads your account, as of your last Save.',
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
        university: z.enum(['ur', 'oth']).optional().describe('ur (Universität Regensburg) or oth (OTH Regensburg). Leave it out if unsure.'),
      },
    },
    ({ university }) => newInRegensburg(university),
  );
}
