import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { todayIso, type IsoDate } from '../src/lib/dates.ts';
import { registerFindDiscounts } from './discounts.ts';
import { registerRegensburgCosts } from './regensburg-costs.ts';
import { registerSemesterInfo } from './semesters.ts';
import { registerSuggestSwaps } from './swaps.ts';
import { registerFindTips } from './tips.ts';

/** Sent to the client when it connects; clients may show it to the model alongside the tool list. */
const INSTRUCTIONS =
  "StudentsBudget's data for students in Regensburg, Germany. Every figure the tools return carries its source, " +
  'URL and the date it was checked. Cite them when you use a figure, call estimates estimates, and say so when ' +
  'the tools have nothing on a question instead of guessing a price. Each result has a note on how to read it. ' +
  'Dates come as YYYY-MM-DD: write them as DD-MM-YYYY.';

export type ServerOptions = {
  /** Today's local date; tests pin it. */
  today?: () => IsoDate;
};

/** The StudentsBudget MCP server with all its tools, not yet connected to a transport. */
export function createServer({ today = () => todayIso() }: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'studentsbudget', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  registerRegensburgCosts(server);
  registerFindDiscounts(server, today);
  registerFindTips(server);
  registerSuggestSwaps(server);
  registerSemesterInfo(server, today);
  return server;
}
