import { describe, expect, it } from 'vitest';
import { MAP_SET } from './map-set';
import { discountMapStyle } from './style';

const ORIGIN = 'https://students-budget.vercel.app';

/** Every string in a value, however deep. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

describe('the map style', () => {
  for (const flavor of ['light', 'dark'] as const) {
    it(`asks only the app for its files (${flavor})`, () => {
      const style = discountMapStyle(ORIGIN, flavor);
      const urls = stringsIn(style).filter((text) => /^[a-z]+:\/\//i.test(text) || text.includes('://'));
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(url.startsWith(`${ORIGIN}/maps/${MAP_SET.id}/`), url).toBe(true);
      expect(style.sprite).toBe(`${ORIGIN}/maps/${MAP_SET.id}/sprites/${flavor}`);
    });
  }

  it('names the set’s box and zooms, so no tile outside the set is asked for', () => {
    const source = discountMapStyle(ORIGIN, 'light').sources.protomaps;
    expect(source).toMatchObject({
      type: 'vector',
      minzoom: MAP_SET.minZoom,
      maxzoom: MAP_SET.maxZoom,
      bounds: [...MAP_SET.bounds],
    });
  });

  it('draws the basemap from that one source', () => {
    const style = discountMapStyle(ORIGIN, 'dark');
    expect(style.layers.length).toBeGreaterThan(10);
    for (const layer of style.layers) if ('source' in layer) expect(layer.source).toBe('protomaps');
  });
});
