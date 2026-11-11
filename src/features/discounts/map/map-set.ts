// The Regensburg map shipped with the app (discount map, docs/superpowers/plans/2026-11-11-discount-map.md): vector
// tiles cut from a Protomaps OpenStreetMap build by `scripts/build-map-tiles.mjs`, and the fonts and icons from
// Protomaps' basemaps-assets, all under `public/maps/<id>/`. No outside service is asked for anything while the map
// shows. To refresh it, change the build and the id, then run the script again: the service worker keeps one cache per
// set (`sw.js?map=<id>`), so a new id replaces the old set on phones.

/** West, south, east, north, in degrees. */
export type Bounds = readonly [number, number, number, number];

export const MAP_SET = {
  id: '20261110',
  /** The OpenStreetMap build the tiles were cut from (data © OpenStreetMap contributors, ODbL), and the day it was built. */
  build: 'https://build.protomaps.com/20261110.pmtiles',
  built: '2026-11-10',
  /** basemaps-assets at this commit: the Noto Sans glyphs (OFL) and the light and dark sprites. */
  assets: { repo: 'protomaps/basemaps-assets', commit: '028c18f713baecad011301ff7a69acc39bcc2ae7' },
  /** The box the tiles cover: Regensburg with its edges. */
  bounds: [12.0, 48.97, 12.2, 49.07] as Bounds,
  minZoom: 10,
  /**
   * The closest zoom the set has tiles for: MapLibre stretches them for closer zooms. Zoom 15 alone was 6.7 MB of the
   * 9.55 (404 tiles, 11-11-2026), against the plan's budget of a few MB.
   */
  maxZoom: 14,
} as const;

/** Where a set's files are served from, as an absolute URL (MapLibre loads tiles in a worker, where a relative one fails). */
export function mapBase(origin: string): string {
  return `${origin}/maps/${MAP_SET.id}`;
}
