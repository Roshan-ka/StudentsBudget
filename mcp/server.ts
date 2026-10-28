// The StudentsBudget MCP server over stdio: Claude Code starts it through .mcp.json, or run `npm run mcp`.
// stdout carries the protocol, so anything else goes to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './create-server.ts';

await createServer().connect(new StdioServerTransport());
console.error('StudentsBudget MCP server: running on stdio');
