import { describe, expect, it } from 'vitest';
import { CITIES } from '../src/data/cities.ts';
import { HIDDEN_PRICE_LABELS, type RegensburgCosts } from './regensburg-costs.ts';
import { call, connect } from './test-client.ts';

const city = CITIES.regensburg;
const shownPrices = city.prices.filter((p) => !HIDDEN_PRICE_LABELS.includes(p.label));
/** The tools over the sourced Regensburg catalogs; budget_overview, recent_entries and week_check_in read the user's own account. */
const CATALOG_TOOLS = ['find_discounts', 'find_tips', 'regensburg_costs', 'semester_info', 'suggest_swaps'];

describe('the StudentsBudget MCP server', () => {
  it('introduces itself and lists its tools, all read-only, the catalog ones asking for sources to be cited', async () => {
    const client = await connect();
    expect(client.getServerVersion()?.name).toBe('studentsbudget');
    expect(client.getInstructions()).toContain('Cite them');

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['budget_overview', ...CATALOG_TOOLS, 'recent_entries', 'week_check_in'].sort());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.outputSchema, tool.name).toBeDefined();
      if (CATALOG_TOOLS.includes(tool.name)) expect(tool.description, tool.name).toMatch(/[Cc]ite/);
    }
  });

  it('refuses input outside a tool’s schema, as a tool error the model can read', async () => {
    const client = await connect();
    const unknownCategory = await client.callTool({ name: 'find_tips', arguments: { category: 'parking' } });
    expect(unknownCategory.isError).toBe(true);
    const notADay = await client.callTool({ name: 'semester_info', arguments: { date: '2027-02-30' } });
    expect(notADay.isError).toBe(true);
  });
});

describe('regensburg_costs', () => {
  const costs = async (search?: string) =>
    call<RegensburgCosts>(await connect(), 'regensburg_costs', search === undefined ? {} : { search });

  it('returns every monthly range and single price, each with its source, URL and checked date', async () => {
    const { isError, text, data } = await costs();
    expect(isError).toBe(false);
    expect(data.ranges).toHaveLength(city.ranges.length);
    expect(data.prices).toHaveLength(shownPrices.length);
    for (const item of [...data.ranges, ...data.prices]) {
      expect(item.source).not.toBe('');
      expect(item.url).toMatch(/^https:\/\//);
      expect(item.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(text).toContain(item.url);
    }
  });

  it('writes each figure as the app does, with the date as DD-MM-YYYY', async () => {
    const { text, data } = await costs();
    const rent = data.ranges.find((r) => r.categoryId === 'rent');
    expect(rent).toMatchObject({ category: 'Rent', range: '€215–561', minMinor: 21500, maxMinor: 56100, estimate: false });
    expect(text).toContain('- Rent: €215–561 a month. Source: Universität Regensburg');
    expect(text).toContain('checked 16-10-2026');
    expect(data.prices.find((p) => p.label === 'Mensa main meal (student price)')?.price).toBe('€3.80');
  });

  it('calls an estimate an estimate', async () => {
    const { text, data } = await costs();
    expect(data.ranges.find((r) => r.categoryId === 'eating-out')?.estimate).toBe(true);
    expect(text).toMatch(/- Eating out: €30–135 a month\. Estimate: no page states this number/);
  });

  it('leaves out the Deutschlandticket price, which the app never shows either', async () => {
    expect(city.prices.map((p) => p.label)).toEqual(expect.arrayContaining([...HIDDEN_PRICE_LABELS]));
    const { text, data } = await costs('Deutschlandticket');
    expect(data.prices.map((p) => p.label)).not.toContain('Deutschlandticket per month');
    expect(text).not.toContain('€63');
  });

  it('narrows the list to a word, in any case, and finds it in a source too', async () => {
    const rent = await costs('RENT');
    expect(rent.data.ranges.map((r) => r.categoryId)).toEqual(['rent']);
    expect(rent.data.prices).toEqual([]);
    expect(rent.data.note).toMatch(/^1 of the 11 Regensburg cost figures matches "RENT"\. To be sure nothing is missed/);
    expect(rent.data.note).not.toContain('German');
    expect(rent.data.note).toContain('call again without search and look through all 11. Cite each item’s source');
    expect(rent.text).not.toContain('Single prices');

    // "WG room" is in the rent range's source.
    expect((await costs('room')).data.ranges.map((r) => r.categoryId)).toEqual(['rent']);

    const gym = await costs('gym');
    expect(gym.data.ranges).toEqual([]);
    expect(gym.data.prices.map((p) => p.label)).toEqual(['Gym per month']);
  });

  it('returns everything, and says so in the note, when nothing matches', async () => {
    const { isError, text, data } = await costs('parking');
    expect(isError).toBe(false);
    expect(data.ranges).toHaveLength(city.ranges.length);
    expect(data.prices).toHaveLength(shownPrices.length);
    expect(data.note).toMatch(/^Nothing matched "parking", so all 11 Regensburg cost figures are listed instead/);
    expect(text.startsWith(data.note)).toBe(true);
  });
});
