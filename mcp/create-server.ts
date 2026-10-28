import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { todayIso, type IsoDate } from '../src/lib/dates.ts';
import { accountFromEnv, type ReadAccount } from './account.ts';
import { registerBudgetOverview, registerRecentEntries } from './budget.ts';
import { registerWeekCheckIn } from './check-in.ts';
import { registerFindDiscounts } from './discounts.ts';
import { registerPrompts } from './prompts.ts';
import { registerRegensburgCosts } from './regensburg-costs.ts';
import { registerSemesterInfo } from './semesters.ts';
import { registerSuggestSwaps } from './swaps.ts';
import { registerFindTips } from './tips.ts';

// The budget tools load the app's own modules through `@/`: server.ts registers ./app-imports.ts before it imports
// this file, and Vitest resolves `@/` itself.

/** Sent to the client when it connects; clients may show it to the model alongside the tool list. */
const INSTRUCTIONS =
  "StudentsBudget's data for students in Regensburg, Germany, and the user's own budget from their StudentsBudget " +
  'account. Every Regensburg figure the tools return carries its source, URL and the date it was checked. Cite them ' +
  'when you use a figure, call estimates estimates, and say so when the tools have nothing on a question instead ' +
  'of guessing a price. Each result has a note on how to read it. Dates come as YYYY-MM-DD: write them as DD-MM-YYYY.';

export type ServerOptions = {
  /** Today's local date; tests pin it. */
  today?: () => IsoDate;
  /** How the budget tools read the account; by default signed in with the settings in .env.local. */
  account?: ReadAccount;
};

/** The StudentsBudget MCP server with all its tools, not yet connected to a transport. */
export function createServer({ today = () => todayIso(), account = accountFromEnv() }: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'studentsbudget', version: '0.1.0' }, { instructions: INSTRUCTIONS });
  registerRegensburgCosts(server);
  registerFindDiscounts(server, today);
  registerFindTips(server);
  registerSuggestSwaps(server);
  registerSemesterInfo(server, today);
  registerBudgetOverview(server, account, today);
  registerRecentEntries(server, account, today);
  registerWeekCheckIn(server, account, today);
  registerPrompts(server);
  return server;
}
