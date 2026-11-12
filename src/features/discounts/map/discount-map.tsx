'use client';

import { MaximizeIcon, MinusIcon, PlusIcon, UserRoundIcon } from 'lucide-react';
import type * as MapLibre from 'maplibre-gl';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { useFocusAfter } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { DiscountCard, type CardEntry } from './discount-card';
import { canDrawMap, loadMapLibre } from './load-maplibre';
import { MAP_SET } from './map-set';
import { boxOf, pinsOf, spotsOf, worldPixel, type Box, type MapItem, type Pin, type Spot } from './pins';
import { discountMapStyle, type MapFlavor } from './style';

type MapState = 'loading' | 'ready' | 'failed';

/** Where the map looks: kept by the view while the map is away, so coming back opens where it was. */
export type MapCamera = { center: [number, number]; zoom: number };

/** The map's data is credited to these, as their licences ask; names, so not translated. */
const PROTOMAPS = 'Protomaps';

/**
 * Room kept free when the map fits pins in: the chips along the top, and the zoom buttons at the end. The same on both
 * sides, so it holds in either reading direction.
 */
const PADDING = { top: 72, bottom: 32, left: 60, right: 60 };
/** The closest "Show all" goes, so one discount alone isn't shown street by street. */
const FIT_MAX_ZOOM = 16;
/** The closest a count pin zooms in: close enough to part pins a few metres apart. */
const COUNT_MAX_ZOOM = 17;
/** How far the chosen teardrop reaches above its place, and the room the chips take along the top. */
const TEARDROP_HEIGHT = 63;
const CHIPS_HEIGHT = 72;
/** The card's gap to the map's edges (the approved look: 10 px). */
const CARD_GAP = 10;

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

/** A spot's place in its pin's name, marked when a student added it. */
const placeName = (item: MapItem, text: Messages['tips']['discountMap']) =>
  item.student ? text.studentPlace(item.place) : item.place;

/** A pin's name: its place and offer, or for a spot of several, their count and places. */
function spotName(spot: Spot, text: Messages['tips']['discountMap']): string {
  if (spot.items.length === 1) return text.pin(placeName(spot.items[0], text), spot.items[0].offer);
  return text.spotPin(spot.items.length, spot.items.map((item) => placeName(item, text)).join(', '));
}

/**
 * The discount map (discount map: chunk 1, the bare map; chunk 4, the pins and controls, in the look Roshan approved
 * from chunk 2's mockups). Mounted only while it shows: its effect creates the map and its cleanup removes it, so
 * leaving the tab or the page never keeps a WebGL context. It opens where `camera` says, else on every discount, and
 * can't be moved outside the set's box. North stays up, so the pins' order on screen is their order for the keyboard.
 *
 * Pins are our own buttons over the canvas, placed with `map.project` as the map moves. They group by the zoom the map
 * came to rest at (`pinsOf`): a tap on a count pin zooms in on its discounts, a tap on a spot's pin chooses it. The
 * chips (`chips`) sit along the top; "+", "−" and "Show all" at the end. `fitKey` changing (another category) fits the
 * map to the discounts shown. The box fills the screen down to the navigation. `data-map-ready` marks it drawn, for
 * the specs.
 *
 * The chosen spot's discounts (`card`, chunk 5) show in a card at the bottom. A tap that opens it puts the focus on its
 * heading; Close, Escape or a second tap on the pin closes it, and the focus goes back to the pin (or to the count pin
 * it joined). The map moves the chosen pin into the room above the card when the card would hide it.
 */
export function DiscountMap({
  items,
  chosen,
  onChoose,
  camera,
  onCamera,
  fitKey,
  chips,
  card,
  onShowInList,
}: {
  items: readonly MapItem[];
  /** The chosen spot's key. */
  chosen: string | null;
  onChoose: (spot: string | null) => void;
  camera: MapCamera | null;
  onCamera: (camera: MapCamera) => void;
  fitKey: string;
  chips: ReactNode;
  /** The chosen spot's discounts, as its card shows them. */
  card: readonly CardEntry[];
  /** "Show in the list" on the card: the view switches to the list and lands on the discount. */
  onShowInList: (id: string) => void;
}) {
  const { t } = useT();
  const text = t.tips.discountMap;
  const flavor = useSyncExternalStore(subscribeToTheme, flavorNow, flavorOnServer);
  const drawable = useSyncExternalStore(neverChanges, canDrawMap, drawableOnServer);
  const box = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const cardBox = useRef<HTMLDivElement>(null);
  /** The card's heading after a tap opened it, and a pin after the card closed (keys `card` and `pin:<spot>`). */
  const focus = useFocusAfter();
  /** The flavour the map was last drawn in, so a theme change redraws it once. */
  const drawnFlavor = useRef<MapFlavor | null>(null);
  const lastFit = useRef(fitKey);
  const [map, setMap] = useState<MapLibre.Map | null>(null);
  const [state, setState] = useState<MapState>('loading');
  /** The zoom the map came to rest at: the pins group by it, so they don't part and join while it moves. */
  const [restZoom, setRestZoom] = useState<number | null>(null);
  // Each frame of a move draws the pins at their new places.
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const spots = useMemo(() => spotsOf(items), [items]);
  const shownBox = boxOf(spots);

  const startView = useEffectEvent(() => ({ camera, box: shownBox, text }));
  const cameraMoved = useEffectEvent((moved: MapLibre.Map) => {
    const { lng, lat } = moved.getCenter();
    onCamera({ center: [lng, lat], zoom: moved.getZoom() });
  });
  /** "Show all": every discount shown, fitted in. */
  const fitAll = () => {
    if (map !== null && shownBox !== null) map.fitBounds(shownBox, { padding: PADDING, maxZoom: FIT_MAX_ZOOM });
  };
  const fitShown = useEffectEvent(fitAll);
  /**
   * The chosen pin, moved into the room between the chips and the card when it lies outside it: the card would hide
   * the teardrop, or the chips its top.
   */
  const showChosen = useEffectEvent(() => {
    const spot = spots.find((at) => at.key === chosen);
    const cardHeight = cardBox.current?.offsetHeight;
    if (map === null || spot === undefined || cardHeight === undefined) return;
    const top = CHIPS_HEIGHT + TEARDROP_HEIGHT;
    const bottom = map.getContainer().clientHeight - cardHeight - CARD_GAP;
    const { y } = map.project([spot.lng, spot.lat]);
    if (y >= top && y <= bottom) return;
    // `offset` moves the place from the middle: to the middle of the room left above the card.
    map.easeTo({ center: [spot.lng, spot.lat], offset: [0, (top - cardHeight - CARD_GAP) / 2] });
  });

  useEffect(() => {
    if (!drawable) return;
    let current = true;
    let made: MapLibre.Map | null = null;
    loadMapLibre().then(
      (maplibregl) => {
        if (!current || container.current === null) return;
        // A map made again (the page shown again) is loading until it is drawn.
        setState('loading');
        const start = startView();
        const [west, south, east, north] = MAP_SET.bounds;
        const view: Pick<MapLibre.MapOptions, 'center' | 'zoom' | 'bounds' | 'fitBoundsOptions'> =
          start.camera === null
            ? { bounds: start.box ?? [...MAP_SET.bounds], fitBoundsOptions: { padding: PADDING, maxZoom: FIT_MAX_ZOOM } }
            : { center: start.camera.center, zoom: start.camera.zoom };
        drawnFlavor.current = flavorNow();
        const drawn = new maplibregl.Map({
          container: container.current,
          style: discountMapStyle(window.location.origin, drawnFlavor.current),
          ...view,
          maxBounds: [west - 0.02, south - 0.02, east + 0.02, north + 0.02],
          minZoom: MAP_SET.minZoom,
          maxZoom: 18,
          attributionControl: false,
          // One finger scrolls the page; two move the map.
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          // MapLibre's own words, in the phone's language: the canvas's name and the gesture hints.
          locale: {
            'Map.Title': start.text.map,
            'CooperativeGesturesHandler.MobileHelpText': start.text.gestures.touch,
            'CooperativeGesturesHandler.WindowsHelpText': start.text.gestures.windows,
            'CooperativeGesturesHandler.MacHelpText': start.text.gestures.mac,
          },
        });
        drawn.touchZoomRotate.disableRotation();
        drawn.keyboard.disableRotation();
        drawn.on('move', redraw);
        drawn.on('resize', redraw);
        drawn.on('moveend', () => {
          setRestZoom(drawn.getZoom());
          cameraMoved(drawn);
        });
        drawn.once('load', () => {
          if (!current) return;
          setRestZoom(drawn.getZoom());
          setState('ready');
        });
        made = drawn;
        setMap(drawn);
      },
      (error: unknown) => {
        console.error('StudentsBudget: could not load the map', error);
        if (current) setState('failed');
      },
    );
    return () => {
      current = false;
      made?.remove();
      // A hidden page keeps its state: the removed map must not be drawn on when it shows again.
      setMap(null);
      setState('loading');
    };
  }, [drawable]);

  // A theme change redraws the map in the other flavour, keeping where it is.
  useEffect(() => {
    if (map === null || drawnFlavor.current === flavor) return;
    drawnFlavor.current = flavor;
    map.setStyle(discountMapStyle(window.location.origin, flavor));
  }, [map, flavor]);

  // Another category: the map fits the discounts it now shows.
  useEffect(() => {
    if (lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    fitShown();
  }, [fitKey]);

  // A pin just chosen: the card is drawn by now (effects run after it), so the map can make room for the teardrop.
  useEffect(() => {
    if (chosen !== null && state === 'ready') showChosen();
  }, [chosen, state]);

  // The box reaches down to the navigation from where it starts on the page, whatever stands above it.
  useEffect(() => {
    const element = box.current;
    if (element === null) return;
    const fill = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.height = `max(18rem, calc(100svh - ${top}px - 5rem - env(safe-area-inset-bottom) - 2rem))`;
    };
    fill();
    const observer = new ResizeObserver(fill);
    observer.observe(document.body);
    window.addEventListener('resize', fill);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fill);
    };
  }, [drawable, state]);

  const pins = useMemo(
    () =>
      restZoom === null
        ? []
        : pinsOf(
            spots.map((spot) => ({ spot, ...worldPixel(spot.lat, spot.lng, restZoom) })),
            chosen,
          ),
    [spots, chosen, restZoom],
  );

  if (!drawable || state === 'failed') {
    return <p className="text-sm">{drawable ? text.failed : text.noWebgl}</p>;
  }

  /** Close or Escape: the card goes, and the focus goes back to the chosen pin, or to the count pin it now joins. */
  function close() {
    if (chosen !== null) focus.mark(`pin:${chosen}`);
    onChoose(null);
  }

  /**
   * A count pin's tap: the map zooms in on its discounts. The pin goes as they part, so the focus waits on the map,
   * from where Tab reaches them.
   */
  function zoomTo(spotsIn: readonly Spot[]) {
    const around: Box | null = boxOf(spotsIn);
    if (map === null || around === null) return;
    map.getCanvas().focus();
    map.fitBounds(around, { padding: PADDING, maxZoom: COUNT_MAX_ZOOM });
  }

  const ready = map !== null && state === 'ready';
  const chosenSpot = spots.find((spot) => spot.key === chosen);
  const width = ready ? map.getContainer().clientWidth : 0;
  const height = ready ? map.getContainer().clientHeight : 0;
  /** A pin's place on the screen: its spot's, or the middle of a count pin's spots. */
  const placeOf = (pin: Pin) => {
    if (map === null) return { x: -1, y: -1 };
    const spotsIn = pin.kind === 'spot' ? [pin.spot] : pin.spots;
    const points = spotsIn.map((spot) => map.project([spot.lng, spot.lat]));
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={box}
        role="region"
        aria-label={text.region}
        aria-busy={state === 'loading'}
        data-map-ready={state === 'ready' ? '' : undefined}
        className="relative min-h-72 w-full overflow-hidden rounded-xl border-[1.5px] border-outline shadow-offset"
      >
        <div ref={container} className="size-full" />
        {ready && (
          // A map's x runs from the left whatever the language, so the pins are placed left to right.
          <div dir="ltr" className="pointer-events-none absolute inset-0">
            {pins.map((pin) => {
              const { x, y } = placeOf(pin);
              if (x < 0 || y < 0 || x > width || y > height) return null;
              if (pin.kind === 'count') {
                return (
                  <button
                    key={pin.key}
                    // A card closed on a pin that has joined this one hands the focus here.
                    ref={(element) => {
                      for (const spot of pin.spots) focus.refFor(`pin:${spot.key}`)(element);
                    }}
                    type="button"
                    aria-label={text.countPin(pin.count)}
                    onClick={() => zoomTo(pin.spots)}
                    className="pointer-events-auto absolute start-0 top-0 grid size-12 place-items-center rounded-full border-[1.5px] border-outline bg-card font-heading text-lg font-extrabold text-foreground shadow-offset outline-none focus-visible:ring-3 focus-visible:ring-ring"
                    style={{ transform: `translate(${x - 24}px, ${y - 24}px)` }}
                  >
                    <span aria-hidden="true">{pin.count}</span>
                  </button>
                );
              }
              const { spot } = pin;
              const first = spot.items[0];
              const Icon = CATEGORY_ICONS[first.categoryId] ?? OTHER_ICON;
              const isChosen = spot.key === chosen;
              const byStudent = spot.items.some((item) => item.student);
              return (
                <button
                  key={pin.key}
                  ref={focus.refFor(`pin:${spot.key}`)}
                  type="button"
                  aria-label={spotName(spot, text)}
                  aria-pressed={isChosen}
                  onClick={(event) => {
                    // A second tap closes the card and keeps the focus here; a first opens it on its heading.
                    event.currentTarget.focus();
                    if (isChosen) {
                      onChoose(null);
                    } else {
                      focus.mark('card');
                      onChoose(spot.key);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!isChosen || event.key !== 'Escape') return;
                    event.stopPropagation();
                    close();
                  }}
                  className={cn(
                    'pointer-events-auto absolute start-0 top-0 grid place-items-center border-outline text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring',
                    isChosen
                      ? // A teardrop whose tip points at the place: its shape marks it chosen, not its colour.
                        'size-13 rounded-[50%_50%_50%_0] border-[2.5px]'
                      : cn('size-11 rounded-full shadow-offset', byStudent ? 'border-2 border-dashed' : 'border-[1.5px]'),
                  )}
                  style={{
                    backgroundColor: categoryTint(first.categoryId),
                    // The chosen teardrop turns a corner down: its tip lies 26√2 px below its middle.
                    transform: isChosen
                      ? `translate(${x - 26}px, ${y - 26 - 26 * Math.SQRT2}px) rotate(-45deg)`
                      : `translate(${x - 22}px, ${y - 22}px)`,
                    filter: isChosen ? 'drop-shadow(var(--shadow-offset))' : undefined,
                  }}
                >
                  <Icon aria-hidden="true" className={cn('size-5', isChosen && 'rotate-45')} />
                  {spot.items.length > 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-[1.5px] border-outline bg-card px-1 text-xs font-extrabold',
                        isChosen && 'rotate-45',
                      )}
                    >
                      {spot.items.length}
                    </span>
                  )}
                  {byStudent && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -end-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full border-[1.5px] border-outline bg-card',
                        isChosen && 'rotate-45',
                      )}
                    >
                      <UserRoundIcon className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-2 *:pointer-events-auto">{chips}</div>
        {ready && (
          <div className="absolute end-2 top-16 flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label={text.zoomIn}
              className="size-11 px-0 shadow-offset"
              onClick={() => map?.zoomIn()}
            >
              <PlusIcon aria-hidden="true" className="size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={text.zoomOut}
              className="size-11 px-0 shadow-offset"
              onClick={() => map?.zoomOut()}
            >
              <MinusIcon aria-hidden="true" className="size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={text.showAll}
              className="size-11 px-0 shadow-offset"
              onClick={fitAll}
            >
              <MaximizeIcon aria-hidden="true" className="size-5" />
            </Button>
          </div>
        )}
        {ready && chosenSpot !== undefined && card.length > 0 && (
          // The room below the chips, with the card at its bottom: 10 px from the map's edges, scrolling when it is
          // taller than the room (a spot of several discounts on a short screen).
          <div className="pointer-events-none absolute inset-x-2.5 top-[4.5rem] bottom-2.5 flex flex-col justify-end">
            <div ref={cardBox} className="pointer-events-auto flex max-h-full min-h-0 flex-col">
              <DiscountCard
                key={chosenSpot.key}
                entries={card}
                label={spotName(chosenSpot, text)}
                headingRef={focus.refFor('card')}
                onClose={close}
                onShowInList={onShowInList}
              />
            </div>
          </div>
        )}
      </div>
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
