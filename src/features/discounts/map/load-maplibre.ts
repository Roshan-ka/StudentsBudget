import type * as MapLibre from 'maplibre-gl';

/**
 * The MapLibre version the app ships, as copied to `public/maps/vendor/maplibre-gl-<version>/` by
 * `scripts/copy-map-vendor.mjs`. Equal to package.json's `maplibre-gl` (tested in `map-vendor.test.ts`).
 */
export const MAPLIBRE_VERSION = '6.16.0';

const BASE = `/maps/vendor/maplibre-gl-${MAPLIBRE_VERSION}`;

let loading: Promise<typeof MapLibre> | null = null;

/**
 * MapLibre, loaded once from the app's own copy (discount map, chunk 1): its stylesheet with a link tag and its module
 * with a native `import()` the bundler leaves alone. The module starts its worker from the file beside it. The service
 * worker keeps all three in the map's cache, which outlives a deploy, so the map opens offline after its first visit.
 * A failed load can be tried again.
 */
export function loadMapLibre(): Promise<typeof MapLibre> {
  loading ??= (async () => {
    if (document.querySelector(`link[href="${BASE}/maplibre-gl.css"]`) === null) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${BASE}/maplibre-gl.css`;
      document.head.append(link);
    }
    try {
      return (await import(/* webpackIgnore: true */ `${BASE}/maplibre-gl.mjs`)) as typeof MapLibre;
    } catch (error) {
      loading = null;
      throw error;
    }
  })();
  return loading;
}

/** The browser's answer, once asked: it never changes while the page is open. */
let drawable: boolean | null = null;

/**
 * Whether this browser can draw the map: MapLibre needs WebGL 2. Asked once per page and remembered, and the probe's
 * context is let go at once. React calls this on every render (it is a `useSyncExternalStore` snapshot, and the map
 * renders on every frame it moves), and a probe each time made a WebGL context per frame: a few seconds of panning
 * passed the browser's limit, which then dropped the map's own context, so the map stalled while it rebuilt
 * (12-11-2026).
 */
export function canDrawMap(): boolean {
  if (drawable !== null) return drawable;
  try {
    const probe = document.createElement('canvas').getContext('webgl2');
    drawable = probe !== null;
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    drawable = false;
  }
  return drawable;
}
