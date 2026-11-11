import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { MAP_SET, mapBase } from './map-set';

export type MapFlavor = 'light' | 'dark';

/**
 * The map's style, built here rather than kept as a file (discount map, chunk 1): Protomaps' light or dark basemap,
 * with its tiles, fonts and icons all from the app's own set (`mapBase`, absolute, since MapLibre loads them in a
 * worker). The basemaps package names an outside host for its fonts by default; this never does (tested). The source
 * names the set's box and zooms, so MapLibre never asks for a tile the set doesn't have. Street names in German, as
 * they are written in Regensburg.
 */
export function discountMapStyle(origin: string, flavor: MapFlavor): StyleSpecification {
  const base = mapBase(origin);
  return {
    version: 8,
    glyphs: `${base}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${base}/sprites/${flavor}`,
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [`${base}/tiles/{z}/{x}/{y}.pbf`],
        minzoom: MAP_SET.minZoom,
        maxzoom: MAP_SET.maxZoom,
        bounds: [...MAP_SET.bounds],
      },
    },
    layers: layers('protomaps', namedFlavor(flavor), { lang: 'de' }),
  };
}
