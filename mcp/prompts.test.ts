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

  it('runs the check-in from the account, then sourced swaps for what is over', async () => {
    const text = await promptText(await connect(), 'weekly_check_in');
    expect(text.indexOf('budget_overview')).toBeLessThan(text.indexOf('recent_entries'));
    expect(text.indexOf('recent_entries')).toBeLessThan(text.indexOf('suggest_swaps'));
    expect(text).toContain('If its state isn’t ready, tell me its note and stop there.');
    expect(text).toContain('as of my last Save from the phone');
    expect(text).toContain('beforeSetup');
  });

  it('names the university when one is given, and asks about both otherwise', async () => {
    const client = await connect();
    const oth = await promptText(client, 'new_in_regensburg', { university: 'oth' });
    expect(oth).toContain('I’m a student new in Regensburg at OTH Regensburg.');
    expect(oth).toContain('Call semester_info with university oth');

    const either = await promptText(client, 'new_in_regensburg');
    expect(either).toContain('I’m a student new in Regensburg. Help me plan my first month.');
    expect(either).toContain('Call semester_info for both universities');
  });

  it('refuses a university it doesn’t know', async () => {
    await expect((await connect()).getPrompt({ name: 'new_in_regensburg', arguments: { university: 'tum' } })).rejects.toThrow();
  });
});
