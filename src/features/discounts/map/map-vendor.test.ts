import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAPLIBRE_VERSION } from './load-maplibre';
import { MAP_SET } from './map-set';

describe('what the map ships in public/maps', () => {
  it('has MapLibre at the version package.json pins (node scripts/copy-map-vendor.mjs after a bump)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies['maplibre-gl']).toBe(MAPLIBRE_VERSION);
    const copy = `public/maps/vendor/maplibre-gl-${MAPLIBRE_VERSION}`;
    // The map module, the worker it starts from beside it, its stylesheet and its licence.
    for (const file of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css', 'LICENSE.txt']) {
      expect(existsSync(`${copy}/${file}`), file).toBe(true);
    }
  });

  it('has the set MAP_SET names, with its licences (node scripts/build-map-tiles.mjs)', () => {
    const base = `public/maps/${MAP_SET.id}`;
    expect(existsSync(`${base}/tiles/${MAP_SET.minZoom}`)).toBe(true);
    expect(existsSync(`${base}/tiles/${MAP_SET.maxZoom}`)).toBe(true);
    expect(existsSync(`${base}/sprites/light.json`)).toBe(true);
    expect(existsSync(`${base}/sprites/dark.json`)).toBe(true);
    expect(existsSync(`${base}/fonts/Noto Sans Regular/0-255.pbf`)).toBe(true);
    expect(existsSync(`${base}/fonts/OFL.txt`)).toBe(true);
    expect(readFileSync(`${base}/LICENSE.md`, 'utf8')).toContain('© OpenStreetMap contributors');
  });
});
