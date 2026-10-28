// The StudentsBudget MCP server over stdio: Claude Code starts it through .mcp.json, or run `npm run mcp`.
// stdout carries the protocol, so anything else goes to stderr.
import { existsSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppImports } from './app-imports.ts';

// The account settings (git-ignored): the app's two Supabase values, and the email and password the budget tools
// sign in with. Values already in the environment win.
const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// The tools load the app's own modules, which Node resolves only through these hooks: register them, then import.
registerAppImports();
const { createServer } = await import('./create-server.ts');

await createServer().connect(new StdioServerTransport());
console.error('StudentsBudget MCP server: running on stdio');
