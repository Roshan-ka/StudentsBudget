import { describe, expect, it } from 'vitest';
import { todayIso } from '@/lib/dates';
import { CATEGORIES } from './categories';
import { DISCOUNTS } from './discounts';
import { REGENSBURG_BOX } from './regensburg-box';

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Drinks in English and German, also inside German compounds (Freibier, Glühwein): the app never points anyone at
 * an alcohol deal (the Concept rule). Strict on purpose: "drinks" alone trips it, so a soft-drink offer names the
 * drink.
 */
const ALCOHOL =
  /alcohol|alkohol|bier|beers?\b|wein|\bwines?\b|\bsekt\b|prosecco|spritz|aperol|cocktail|longdrink|schnaps|\bshots?\b|vodka|wodka|\bgin\b|\brum\b|whisk(e)?y|liquor|\bspirits\b|radler|\bpils|weizen\b|mojito|happy[- ]?hour|\bdrinks?\b|\bdrinking\b/i;

describe('Regensburg discounts', () => {
  it('has 10 to 20 entries', () => {
    expect(DISCOUNTS.length).toBeGreaterThanOrEqual(10);
    expect(DISCOUNTS.length).toBeLessThanOrEqual(20);
  });

  it('every discount has a place, an address, an offer, conditions, a known category, a source, an https url and a checked date', () => {
    // Expenses only: a discount is never filed under income.
    const categoryIds = new Set(CATEGORIES.filter((c) => c.kind !== 'income').map((c) => c.id));

    for (const d of DISCOUNTS) {
      expect(d.id, 'id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(d.place.trim(), `${d.id} place`).not.toBe('');
      expect(d.address, `${d.id} address`).toMatch(/\d{5} Regensburg$/);
      expect(d.offer.trim(), `${d.id} offer`).not.toBe('');
      expect(d.conditions.trim(), `${d.id} conditions`).not.toBe('');
      expect(categoryIds.has(d.categoryId), `${d.id} category ${d.categoryId}`).toBe(true);
      expect(d.source.trim(), `${d.id} source`).not.toBe('');
      expect(d.url, `${d.id} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(d.checked), `${d.id} checked`).toBe(true);
    }
  });

  it('every discount has a position in the Regensburg box, from an OpenStreetMap element, with a real date', () => {
    const today = todayIso();
    for (const d of DISCOUNTS) {
      const at = d.location;
      expect(at, `${d.id} location`).toBeDefined();
      if (at === undefined) continue;
      expect(at.lat, `${d.id} lat`).toBeGreaterThanOrEqual(REGENSBURG_BOX.south);
      expect(at.lat, `${d.id} lat`).toBeLessThanOrEqual(REGENSBURG_BOX.north);
      expect(at.lng, `${d.id} lng`).toBeGreaterThanOrEqual(REGENSBURG_BOX.west);
      expect(at.lng, `${d.id} lng`).toBeLessThanOrEqual(REGENSBURG_BOX.east);
      // To 5 decimals, about a metre: more would claim a precision the lookup doesn't have.
      expect(Number(at.lat.toFixed(5)), `${d.id} lat decimals`).toBe(at.lat);
      expect(Number(at.lng.toFixed(5)), `${d.id} lng decimals`).toBe(at.lng);
      expect(at.source, `${d.id} source`).toBe('OpenStreetMap');
      expect(at.url, `${d.id} url`).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
      expect(isRealIsoDate(at.checked), `${d.id} checked`).toBe(true);
      expect(at.checked <= today, `${d.id} checked ${at.checked} is not after today`).toBe(true);
    }
  });

  it('discounts at one address share one position, and discounts at different addresses never do', () => {
    // The map groups discounts at one spot into one pin (Haidplatz 8 has two).
    for (const a of DISCOUNTS) {
      for (const b of DISCOUNTS) {
        if (a === b || a.location === undefined || b.location === undefined) continue;
        const samePlace = a.location.lat === b.location.lat && a.location.lng === b.location.lng;
        expect(samePlace, `${a.id} and ${b.id}`).toBe(a.address === b.address);
      }
    }
  });

  it('has unique ids, and one entry per place', () => {
    const ids = DISCOUNTS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const places = DISCOUNTS.map((d) => d.place);
    expect(new Set(places).size).toBe(places.length);
  });

  it('offers no alcohol deal', () => {
    for (const d of DISCOUNTS) {
      expect(`${d.offer} ${d.conditions}`, d.id).not.toMatch(ALCOHOL);
    }
  });

  it('the alcohol check catches drink deals in English and German', () => {
    for (const text of [
      'Free beer with a burger',
      'Happy hour: 2 for 1',
      'Happy-Hour bis 21 Uhr',
      'Ein Glas Wein gratis',
      'Freibier ab 20 Uhr',
      'Rotwein, Glühwein',
      'Aperol Spritz €5',
      'Shots for €1',
      'Radler, Pils or Hefeweizen',
      'Mojito Monday',
      '2 drinks for the price of 1',
    ]) {
      expect(text, text).toMatch(ALCOHOL);
    }
    for (const text of [
      '€7 instead of €9.50 per ticket',
      'Free entry',
      'Pupils and students',
      'A free lemonade with lunch',
      'Weizenbrötchen',
      'Climbing day ticket',
    ]) {
      expect(text, text).not.toMatch(ALCOHOL);
    }
  });

  it('states facts, not ratings', () => {
    for (const d of DISCOUNTS) {
      expect(`${d.offer} ${d.conditions}`, d.id).not.toMatch(/★|\b(stars?|rated|ratings?|best|must-see|amazing)\b/i);
    }
  });
});
