import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, expect, it } from 'vitest';
import { connect } from './test-client.ts';

async function promptText(client: Client, name: string, args?: Record<string, string>): Promise<string> {
  const { messages } = await client.getPrompt({ name, ...(args === undefined ? {} : { arguments: args }) });
  expect(messages).toHaveLength(1);
  const [message] = messages;
  expect(message.role).toBe('user');
  if (message.content.type !== 'text') throw new Error('expected a text message');
  return message.content.text;
}

/** Words in a prompt shaped like this server's tool names (snake_case), so a renamed tool can't leave a prompt behind. */
function toolNamesIn(text: string): string[] {
  return [...new Set(text.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [])];
}

describe('the prompts', () => {
  it('are listed with a title, a description and their arguments', async () => {
    const { prompts } = await (await connect()).listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(['new_in_regensburg', 'weekly_check_in']);
    for (const p of prompts) {
      expect(p.title, p.name).toBeTruthy();
      expect(p.description, p.name).toBeTruthy();
    }
    const newcomer = prompts.find((p) => p.name === 'new_in_regensburg');
    expect(newcomer?.arguments).toEqual([expect.objectContaining({ name: 'university', required: false })]);
    expect(prompts.find((p) => p.name === 'weekly_check_in')?.arguments ?? []).toEqual([]);
  });

  it('name only tools this server has, and say how to write the answer', async () => {
    const client = await connect();
    const tools = new Set((await client.listTools()).tools.map((t) => t.name));
    for (const [name, args] of [['weekly_check_in'], ['new_in_regensburg'], ['new_in_regensburg', { university: 'oth' }]] as const) {
      const text = await promptText(client, name, args);
      // Field names the check-in reads (plan.overBy, savedAt) are camelCase; anything snake_case must be a tool.
      const named = toolNamesIn(text);
      expect(named.length, name).toBeGreaterThan(0);
      for (const tool of named) expect(tools.has(tool), `${name} names ${tool}`).toBe(true);
      expect(text, name).toContain('never "failed" or a warning');
      expect(text, name).toContain('DD-MM-YYYY');
      expect(text, name).toContain('cite the source and checked date');
    }
  });

  it('name only fields the tools return', async () => {
    const client = await connect();
    // Every property name anywhere in the tools' output schemas.
    const fields = new Set<string>();
    const collect = (schema: unknown): void => {
      if (typeof schema !== 'object' || schema === null) return;
      for (const [key, value] of Object.entries(schema)) {
        if (key === 'properties' && typeof value === 'object' && value !== null) {
          for (const name of Object.keys(value)) fields.add(name);
        }
        collect(value);
      }
    };
    for (const tool of (await client.listTools()).tools) collect(tool.outputSchema);
    const text = await promptText(client, 'weekly_check_in');
    // camelCase words, such as plan.overBy, savedAt and eurMinor.
    const named = [...new Set(text.match(/\b[a-z]+[A-Z][A-Za-z]*\b/g) ?? [])];
    expect(named).toEqual(expect.arrayContaining(['overBy', 'savedAt', 'eurMinor']));
    for (const field of named) expect(fields.has(field), `weekly_check_in names ${field}`).toBe(true);
  });

  it('builds the check-in on week_check_in, the app’s week, and adds the month from budget_overview', async () => {
    const text = await promptText(await connect(), 'weekly_check_in');
    expect(text.indexOf('week_check_in')).toBeLessThan(text.indexOf('budget_overview'));
    // The week's swaps come from week_check_in alone: suggest_swaps would measure nothing against the week.
    expect(text).not.toContain('suggest_swaps');
    expect(text).toContain('the swaps week_check_in gives, each with what it saves and its sources, and no others');
    expect(text).toContain('If its state isn’t ready, tell me its note and stop there.');
    expect(text).toContain('as of my last Save from the phone');
  });

  it('names the university when one is given, in any case, and asks about both otherwise', async () => {
    const client = await connect();
    for (const given of ['oth', 'OTH', ' Oth ']) {
      const oth = await promptText(client, 'new_in_regensburg', { university: given });
      expect(oth, given).toContain('I’m a student new in Regensburg at OTH Regensburg. Help me plan my first month.');
      expect(oth, given).toContain('Call semester_info with university oth');
    }
    for (const args of [undefined, { university: '' }]) {
      const either = await promptText(client, 'new_in_regensburg', args);
      expect(either).toContain('I’m a student new in Regensburg. Help me plan my first month.\n');
      expect(either).toContain('Call semester_info for both universities');
    }
  });

  it('covers both universities, and says why, for one the tools don’t know', async () => {
    const text = await promptText(await connect(), 'new_in_regensburg', { university: 'TUM' });
    expect(text).toContain('(I wrote “TUM”, but the tools only know UR and OTH, so cover both.)');
    expect(text).toContain('Call semester_info for both universities');
  });

  it('asks for what the costs don’t cover, and each discount’s conditions, instead of guesses', async () => {
    const text = await promptText(await connect(), 'new_in_regensburg');
    expect(text).toContain('never an estimate of your own');
    expect(text).toContain('each with who gets it and the proof it needs');
  });
});
