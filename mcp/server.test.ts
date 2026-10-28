import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

// The real server in plain Node, started as .mcp.json starts it. Vitest resolves `@/` and `.ts` itself, so only this
// run shows that Node loads the whole graph through the import hook: a type imported without `type`, say, passes
// typecheck and every other test but stops the server at startup. Nothing here signs in to an account.
describe('node mcp/server.ts', () => {
  it('starts, and lists every tool and prompt over stdio', { timeout: 60_000 }, async () => {
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['mcp/server.ts'], stderr: 'pipe' }));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        'budget_overview',
        'find_discounts',
        'find_tips',
        'recent_entries',
        'regensburg_costs',
        'semester_info',
        'suggest_swaps',
        'week_check_in',
      ]);
      const { prompts } = await client.listPrompts();
      expect(prompts.map((p) => p.name).sort()).toEqual(['new_in_regensburg', 'weekly_check_in']);

      // A catalog tool and a prompt answer, each through the app's own helpers.
      const costs = await client.callTool({ name: 'regensburg_costs', arguments: { search: 'rent' } });
      expect((costs.structuredContent as { ranges: { range: string }[] }).ranges[0].range).toBe('€215–561');
      const prompt = await client.getPrompt({ name: 'new_in_regensburg', arguments: { university: 'oth' } });
      expect(prompt.messages[0].content).toMatchObject({ text: expect.stringContaining('OTH Regensburg') });
    } finally {
      await client.close();
    }
  });
});
