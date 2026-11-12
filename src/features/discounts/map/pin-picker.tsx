'use client';

import { MapPinIcon, MinusIcon, PlusIcon } from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import { useEffect, useEffectEvent, useId, useReducer, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/use-t';
import { describedBy } from '@/lib/described-by';
import type { Pin } from '../add-discount';
import { loadMapLibre } from './load-maplibre';
import { MAP_SET } from './map-set';
import { flavorNow, prefersLessMotion, useCanDrawMap, useMapFlavor } from './map-theme';
import { discountMapStyle } from './style';

/** Where the picker opens without a pin: the old town, where most discounts are. */
const OLD_TOWN: [number, number] = [12.0965, 49.0185];
const START_ZOOM = 15.5;

/** The needle: a pin in the primary colour, its tip at the bottom middle. */
function Needle() {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" aria-hidden="true" className="block">
      <path
        d="M20 46 C 20 46 4 28 4 17 A 16 16 0 0 1 36 17 C 36 28 20 46 20 46 Z"
        className="fill-primary stroke-outline"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="17" r="6" className="fill-card" />
    </svg>
  );
}

/**
 * The form's "On the map (optional)" (discount map, chunk 8, in the look Roshan approved from chunk 2's mockups): a
 * small map of the set with a needle fixed in its middle. "Set the pin here" takes the map's middle; the pin then
 * stays on its place while the map moves, with "Remove the pin". A tap on the map moves it there, and "+" and "−" zoom,
 * so the needle reaches a place without dragging; the canvas takes the arrow keys too. Without WebGL 2 a line says the
 * discount goes without a pin. Mounted only with the form, so no WebGL context outlives it. `data-map-ready` marks it
 * drawn, for the specs.
 */
export function PinPicker({
  value,
  onChange,
  invalid = false,
  errorId,
}: {
  value: Pin | null;
  onChange: (pin: Pin | null) => void;
  /** The form's message is about the pin: the button carries it. */
  invalid?: boolean;
  errorId?: string;
}) {
  const id = useId();
  const { t } = useT();
  const text = t.tips.studentDiscounts.form;
  const mapText = t.tips.discountMap;
  const flavor = useMapFlavor();
  const drawable = useCanDrawMap();
  const container = useRef<HTMLDivElement>(null);
  const drawnFlavor = useRef(flavor);
  const [map, setMap] = useState<MapLibre.Map | null>(null);
  const [ready, setReady] = useState(false);
  // Each frame of a move draws the set pin at its new place.
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const startView = useEffectEvent(() => ({ value, text, mapText }));

  useEffect(() => {
    if (!drawable) return;
    let current = true;
    let made: MapLibre.Map | null = null;
    loadMapLibre().then(
      (maplibregl) => {
        if (!current || container.current === null) return;
        const start = startView();
        const [west, south, east, north] = MAP_SET.bounds;
        drawnFlavor.current = flavorNow();
        const drawn = new maplibregl.Map({
          container: container.current,
          style: discountMapStyle(window.location.origin, drawnFlavor.current),
          center: start.value === null ? OLD_TOWN : [start.value.lng, start.value.lat],
          zoom: START_ZOOM,
          maxBounds: [west - 0.02, south - 0.02, east + 0.02, north + 0.02],
          minZoom: MAP_SET.minZoom,
          maxZoom: 18,
          attributionControl: false,
          // One finger scrolls the form; two move the map.
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          locale: {
            'Map.Title': start.text.pinMap,
            'CooperativeGesturesHandler.MobileHelpText': start.mapText.gestures.touch,
            'CooperativeGesturesHandler.WindowsHelpText': start.mapText.gestures.windows,
            'CooperativeGesturesHandler.MacHelpText': start.mapText.gestures.mac,
          },
        });
        drawn.touchZoomRotate.disableRotation();
        drawn.keyboard.disableRotation();
        // A tap moves the map there: one finger brings the needle onto a place, no drag needed.
        drawn.on('click', (event) => drawn.easeTo({ center: event.lngLat, duration: prefersLessMotion() ? 0 : 300 }));
        drawn.on('move', redraw);
        drawn.once('load', () => {
          if (current) setReady(true);
        });
        made = drawn;
        setMap(drawn);
      },
      (error: unknown) => console.error('StudentsBudget: could not load the map', error),
    );
    return () => {
      current = false;
      made?.remove();
      setMap(null);
      setReady(false);
    };
  }, [drawable]);

  // A theme change redraws the map in the other flavour, keeping where it is.
  useEffect(() => {
    if (map === null || drawnFlavor.current === flavor) return;
    drawnFlavor.current = flavor;
    map.setStyle(discountMapStyle(window.location.origin, flavor));
  }, [map, flavor]);

  const hintId = `${id}-hint`;
  const headingId = `${id}-heading`;
  const zoom = (by: number) => map?.easeTo({ zoom: map.getZoom() + by, duration: prefersLessMotion() ? 0 : 200 });
  const shown = ready && map !== null && value !== null ? map.project([value.lng, value.lat]) : null;

  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1.5">
      <p id={headingId} className="text-sm leading-none font-medium">
        {text.pinHeading}
      </p>
      {drawable ? (
        <div
          data-pin-picker=""
          data-map-ready={ready ? '' : undefined}
          className="relative h-52 overflow-hidden rounded-xl border-[1.5px] border-outline"
        >
          <div ref={container} className="size-full" />
          {/* The needle stands in the middle until a pin is set; then the pin keeps its place as the map moves. */}
          {value === null ? (
            <span className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-10 -translate-y-full">
              <Needle />
            </span>
          ) : (
            shown !== null && (
              // A map's x runs from the left whatever the language.
              <div dir="ltr" className="pointer-events-none absolute inset-0">
                <span
                  className="absolute start-0 top-0"
                  style={{ transform: `translate(${shown.x - 20}px, ${shown.y - 48}px)` }}
                >
                  <Needle />
                </span>
              </div>
            )
          )}
          <div className="absolute end-2 top-2 flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label={mapText.zoomIn}
              className="size-11 px-0 shadow-offset"
              disabled={!ready}
              onClick={() => zoom(1)}
            >
              <PlusIcon aria-hidden="true" className="size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={mapText.zoomOut}
              className="size-11 px-0 shadow-offset"
              disabled={!ready}
              onClick={() => zoom(-1)}
            >
              <MinusIcon aria-hidden="true" className="size-5" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm">{text.pinNoMap}</p>
      )}
      {drawable && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {text.pinHint}
        </p>
      )}
      {value === null ? (
        drawable && (
          <Button
            type="button"
            className="self-start px-4"
            disabled={!ready}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy(hintId, invalid && errorId)}
            onClick={() => {
              if (map === null) return;
              const { lng, lat } = map.getCenter();
              onChange({ lat, lng });
            }}
          >
            {text.setPin}
          </Button>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MapPinIcon aria-hidden="true" className="size-4 text-primary" />
            {text.pinSet}
          </p>
          <Button
            type="button"
            variant="outline"
            className="px-4"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy(invalid && errorId)}
            onClick={() => onChange(null)}
          >
            {text.removePin}
          </Button>
        </div>
      )}
    </div>
  );
}
