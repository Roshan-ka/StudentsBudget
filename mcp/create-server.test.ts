import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { CITIES } from '../src/data/cities.ts';
import { createServer } from './create-server.ts';
import type { RegensburgCosts } from './regensburg-costs.ts';

/** A real MCP client talking to the server over the SDK's in-memory transport: the same protocol as stdio. */
async function connect(): Promise<Client> {
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([createServer().connect(serverSide), client.connect(clientSide)]);
  return client;
}

async function costs(client: Client, search?: string) {
  const result = await client.callTool({ name: 'regensburg_costs', arguments: search === undefined ? {} : { search } });
  const [first] = result.content as { type: string; text: string }[];
  return { result, text: first.text, data: result.structuredContent as RegensburgCosts };
}

const city = CITIES.regensburg;

describe('the StudentsBudget MCP server', () => {
  it('introduces itself and lists regensburg_costs as a read-only tool', async () => {
    const client = await connect();
    expect(client.getServerVersion()?.name).toBe('studentsbudget');
    expect(client.getInstructions()).toContain('Cite them');

    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'regensburg_costs');
    expect(tool?.annotations?.readOnlyHint).toBe(true);
    expect(tool?.description).toContain('source, URL and the date it was checked');
    expect(tool?.outputSchema).toBeDefined();
  });
});

describe('regensburg_costs', () => {
  it('returns every monthly range and single price, each with its source, URL and checked date', async () => {
    const { result, text, data } = await costs(await connect());
    expect(result.isError).toBeFalsy();
    expect(data.ranges).toHaveLength(city.ranges.length);
    expect(data.prices).toHaveLength(city.prices.length);
    for (const item of [...data.ranges, ...data.prices]) {
      expect(item.source).not.toBe('');
      expect(item.url).toMatch(/^https:\/\//);
      expect(item.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(text).toContain(item.url);
    }
  });

  it('writes each figure as the app does, with the date as DD-MM-YYYY', async () => {
    const { text, data } = await costs(await connect());
    const rent = data.ranges.find((r) => r.categoryId === 'rent');
    expect(rent).toMatchObject({ category: 'Rent', range: '€215–561', minMinor: 21500, maxMinor: 56100, estimate: false });
    expect(text).toContain('- Rent: €215–561 a month. Source: Universität Regensburg');
    expect(text).toContain('checked 16-10-2026');
    expect(data.prices.find((p) => p.label === 'Mensa main meal (student price)')?.price).toBe('€3.80');
  });

  it('calls an estimate an estimate', async () => {
    const { text, data } = await costs(await connect());
    const eatingOut = data.ranges.find((r) => r.categoryId === 'eating-out');
    expect(eatingOut?.estimate).toBe(true);
    expect(text).toMatch(/- Eating out: €30–135 a month\. Estimate: no page states this number/);
  });

  it('narrows the list to a word, in any case', async () => {
    const client = await connect();
    const rent = await costs(client, 'RENT');
    expect(rent.data.ranges.map((r) => r.categoryId)).toEqual(['rent']);
    expect(rent.data.prices).toEqual([]);
    expect(rent.text).not.toContain('Single prices');

    const gym = await costs(client, 'gym');
    expect(gym.data.ranges).toEqual([]);
    expect(gym.data.prices.map((p) => p.label)).toEqual(['Gym per month']);
  });

  it('says what it has when nothing matches, instead of an error', async () => {
    const { result, text, data } = await costs(await connect(), 'parking');
    expect(result.isError).toBeFalsy();
    expect(data).toEqual({ ranges: [], prices: [] });
    expect(text).toContain('Nothing in the Regensburg costs matches "parking"');
    expect(text).toContain('Monthly ranges: Rent, Food & groceries');
  });
});
