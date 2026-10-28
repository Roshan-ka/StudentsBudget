import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRegensburgCosts } from './regensburg-costs.ts';

/** Sent to the client when it connects; clients may show it to the model alongside the tool list. */
const INSTRUCTIONS =
  "StudentsBudget's data for students in Regensburg, Germany. Every figure the tools return carries its source, " +
  'URL and the date it was checked. Cite them when you use a figure, call estimates estimates, and say so when ' +
  'the tools have nothing on a question instead of guessing a price.';

/** The StudentsBudget MCP server with all its tools, not yet connected to a transport. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'studentsbudget', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  registerRegensburgCosts(server);
  return server;
}
