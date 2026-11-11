'use client';

import type * as MapLibre from 'maplibre-gl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useT } from '@/i18n/use-t';
import { canDrawMap, loadMapLibre } from './load-maplibre';
import { MAP_SET } from './map-set';
import { discountMapStyle, type MapFlavor } from './style';

type MapState = 'loading' | 'ready' | 'failed';

/** The map's data is credited to these, as their licences ask; names, so not translated. */
const PROTOMAPS = 'Protomaps';

/** Whether WebGL 2 is there never changes while the page is open. */
const neverChanges = () => () => {};
const drawableOnServer = () => true;

/** The app's theme as the page shows it: the `dark` class `ThemeAttributes` keeps on <html>. */
function subscribeToTheme(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
const flavorNow = (): MapFlavor => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
const flavorOnServer = (): MapFlavor => 'light';

/**
 * The discount map (discount map, chunk 1: the bare map). Mounted only while it shows: its effect creates the map and
 * its cleanup removes it, so leaving the tab or the page never keeps a WebGL context. It opens on the set's box and
 * can't be moved outside it. `data-map-ready` marks it drawn, for the specs.
 */
export function DiscountMap() {
  const { t } = useT();
  const text = t.tips.discountMap;
  const flavor = useSyncExternalStore(subscribeToTheme, flavorNow, flavorOnServer);
  const drawable = useSyncExternalStore(neverChanges, canDrawMap, drawableOnServer);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre.Map | null>(null);
  const [state, setState] = useState<MapState>('loading');

  useEffect(() => {
    if (!drawable) return;
    let current = true;
    loadMapLibre().then(
      (maplibregl) => {
        if (!current || container.current === null) return;
        // A map made again (the page shown again) is loading until it is drawn.
        setState('loading');
        const [west, south, east, north] = MAP_SET.bounds;
        const drawn = new maplibregl.Map({
          container: container.current,
          style: discountMapStyle(window.location.origin, flavorNow()),
          bounds: [west, south, east, north],
          maxBounds: [west - 0.02, south - 0.02, east + 0.02, north + 0.02],
          minZoom: MAP_SET.minZoom,
          maxZoom: 18,
          attributionControl: false,
          // One finger scrolls the page; two move the map.
          cooperativeGestures: true,
        });
        map.current = drawn;
        drawn.once('load', () => {
          if (current) setState('ready');
        });
      },
      (error: unknown) => {
        console.error('StudentsBudget: could not load the map', error);
        if (current) setState('failed');
      },
    );
    return () => {
      current = false;
      map.current?.remove();
      map.current = null;
    };
  }, [drawable]);

  // A theme change redraws the map in the other flavour, keeping where it is.
  useEffect(() => {
    map.current?.setStyle(discountMapStyle(window.location.origin, flavor));
  }, [flavor]);

  if (!drawable || state === 'failed') {
    return <p className="text-sm">{drawable ? text.failed : text.noWebgl}</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={container}
        role="region"
        aria-label={text.region}
        aria-busy={state === 'loading'}
        data-map-ready={state === 'ready' ? '' : undefined}
        className="h-[60svh] min-h-72 w-full overflow-hidden rounded-xl border-[1.5px] border-outline"
      />
      {state === 'loading' && <p className="text-sm text-muted-foreground">{text.loading}</p>}
      <p className="text-xs text-muted-foreground">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
          {text.osm}
        </a>
        {' · '}
        <a href="https://protomaps.com" target="_blank" rel="noopener noreferrer" className="underline">
          {PROTOMAPS}
        </a>
      </p>
    </div>
  );
}
