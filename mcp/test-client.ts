import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { IsoDate } from '../src/lib/dates.ts';
import type { ReadAccount } from './account.ts';
import { createServer } from './create-server.ts';

/** A real MCP client talking to the server over the SDK's in-memory transport: the same protocol as stdio. */
export async function connect(today: IsoDate = '2026-10-28', account?: ReadAccount): Promise<Client> {
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer({ today: () => today, ...(account === undefined ? {} : { account }) });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

/** Calls a tool and hands back its text and structured content. */
export async function call<T>(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const [first] = result.content as { type: string; text: string }[];
  return { isError: result.isError === true, text: first.text, data: result.structuredContent as T };
}
