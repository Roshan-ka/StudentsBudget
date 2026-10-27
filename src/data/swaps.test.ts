import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { CITIES } from './cities';
import { SWAPS } from './swaps';
import { TIPS } from './tips';

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

describe('swaps', () => {
  it('every swap has a flexible category, a saving, a source, an https url and a checked date', () => {
    expect(SWAPS.length).toBeGreaterThan(0);
    const flexibleIds = new Set(CATEGORIES.filter((c) => c.kind === 'flexible').map((c) => c.id));

    for (const s of SWAPS) {
      expect(s.id, 'id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(flexibleIds.has(s.categoryId), `${s.id} category ${s.categoryId}`).toBe(true);
      expect(s.title.trim(), `${s.id} title`).not.toBe('');
      expect(s.body.trim(), `${s.id} body`).not.toBe('');
      expect(s.per.trim(), `${s.id} per`).not.toBe('');
      // Whole cents, and the new way costs something but less than the old one.
      expect(Number.isInteger(s.fromMinor), `${s.id} fromMinor is whole cents`).toBe(true);
      expect(Number.isInteger(s.toMinor), `${s.id} toMinor is whole cents`).toBe(true);
      expect(s.toMinor, `${s.id} toMinor`).toBeGreaterThan(0);
      expect(s.fromMinor, `${s.id} fromMinor`).toBeGreaterThan(s.toMinor);
      expect(s.source.trim(), `${s.id} source`).not.toBe('');
      expect(s.url, `${s.id} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(s.checked), `${s.id} checked`).toBe(true);
    }
  });

  it('gives each of the two amounts a source it can be checked on', () => {
    for (const s of SWAPS) {
      // The dearer amount is behind `url`; the cheaper one behind `toUrl`, or behind `url` too when one page states both.
      for (const [which, url] of [['fromMinor', s.url], ['toMinor', s.toUrl ?? s.url]] as const) {
        expect(url, `${s.id} ${which} url`).toMatch(/^https:\/\/\S+$/);
      }
      // The two come as a pair, and a second page is a different page.
      expect(s.toSource === undefined, `${s.id} toSource and toUrl come together`).toBe(s.toUrl === undefined);
      if (s.toSource !== undefined && s.toUrl !== undefined) {
        expect(s.toSource.trim(), `${s.id} toSource`).not.toBe('');
        expect(s.toUrl, `${s.id} toUrl`).toMatch(/^https:\/\/\S+$/);
        expect(s.toUrl, `${s.id} toUrl is another page`).not.toBe(s.url);
      }
    }
  });

  it('an estimate says so in its body and in its source, and is flagged so its line says so too', () => {
    for (const s of SWAPS) {
      expect(s.body.startsWith('Estimate'), `${s.id} body`).toBe(s.source.startsWith('Estimate'));
      expect(s.estimate === true, `${s.id} estimate flag`).toBe(s.body.startsWith('Estimate'));
    }
    // Not vacuous: the Deutschlandticket saving assumes one Bayern-Ticket day a month.
    expect(SWAPS.find((s) => s.id === 'deutschlandticket-for-travel-months')?.estimate).toBe(true);
  });

  it('has unique ids', () => {
    const ids = SWAPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links only to tips that exist', () => {
    const tipIds = new Set(TIPS.map((t) => t.id));
    for (const s of SWAPS) {
      if (s.tipId !== undefined) expect(tipIds.has(s.tipId), `${s.id} tip ${s.tipId}`).toBe(true);
    }
  });

  it('never suggests drinking (the Concept rule)', () => {
    for (const s of SWAPS) {
      expect(`${s.title} ${s.body}`, s.id).not.toMatch(/\b(alcohol\w*|beers?|wine|cocktails?|drinking|pre-?drinks?|shots?)\b/i);
    }
  });

  it('uses the Mensa price that cities.ts already sources, from the same page', () => {
    const mensa = CITIES.regensburg.prices.find((p) => p.label.startsWith('Mensa main meal'));
    const swap = SWAPS.find((s) => s.id === 'mensa-instead-of-restaurant');
    expect(mensa, 'cities.ts Mensa price').toBeDefined();
    expect(swap, 'Mensa swap').toBeDefined();
    expect(swap?.toMinor).toBe(mensa?.minor);
    expect(swap?.toUrl).toBe(mensa?.url);
  });
});
