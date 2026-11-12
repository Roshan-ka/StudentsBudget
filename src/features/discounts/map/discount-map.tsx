'use client';

import { LocateFixedIcon, MaximizeIcon, MinusIcon, PlusIcon, UserRoundIcon } from 'lucide-react';
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
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { useFocusAfter } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { DiscountCard, type CardEntry } from './discount-card';
import type { LatLng } from './distance';
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
 * Room kept free when the map fits pins in, so that a whole pin (up to 48 px) clears what lies over the map: the chips
 * along the top (60 px), the zoom buttons at the end (52 px from the edge) and Show me at the bottom (54 px). The same
 * on both sides, so it holds in either reading direction.
 */
const PADDING = { top: 88, bottom: 80, left: 80, right: 80 };
/** Half a pin's box, for what may lie over it: a count pin's 48 px, the largest of the round ones. */
const PIN_HALF = 24;
/** The closest "Show all" goes, so one discount alone isn't shown street by street. */
const FIT_MAX_ZOOM = 16;
/** The closest a count pin zooms in: close enough to part pins a few metres apart. */
const COUNT_MAX_ZOOM = 17;
/** How far the chosen teardrop reaches above its place, and the room the chips take along the top. */
const TEARDROP_HEIGHT = 63;
const CHIPS_HEIGHT = 72;
/** The card's gap to the map's edges (the approved look: 10 px). */
const CARD_GAP = 10;
/** How close Show me zooms in on the phone, at least: a few streets around it. */
const HERE_ZOOM = 15;

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

/** A box within the map, in CSS pixels from its top-left corner. */
type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * Whether a pin at (x, y) can be drawn: on the map, and with its whole box clear of everything that lies over the map
 * (the chips, the zoom buttons, Show me, the card). A pin under one would be hidden from the eye but not from the
 * keyboard, and too little of it would be left to tap.
 */
function clear(x: number, y: number, width: number, height: number, covered: readonly Rect[]): boolean {
  if (x < 0 || y < 0 || x > width || y > height) return false;
  return covered.every(
    (rect) =>
      x + PIN_HALF <= rect.left || x - PIN_HALF >= rect.right || y + PIN_HALF <= rect.top || y - PIN_HALF >= rect.bottom,
  );
}

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
 *
 * Show me (chunk 6) is a pill just above the card: the view asks for the position on its tap (`onShowMe`), and the map
 * draws a dot there and centres on each new find (`centreOn`). What it has to say shows under the map.
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
  here,
  centreOn,
  onShowMe,
  locationNote,
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
  /** Where the phone is, once Show me found it in Regensburg: in memory only. */
  here: LatLng | null;
  /** Counts up with each position Show me finds: the map centres on it then, not each time it opens. */
  centreOn: number;
  /** Show me's tap; null where the browser has no geolocation, and the pill isn't shown. */
  onShowMe: (() => void) | null;
  /** What Show me has to say: finding, refused, not found, outside the city. */
  locationNote: string | null;
}) {
  const { t } = useT();
  const text = t.tips.discountMap;
  const flavor = useSyncExternalStore(subscribeToTheme, flavorNow, flavorOnServer);
  const drawable = useSyncExternalStore(neverChanges, canDrawMap, drawableOnServer);
  const box = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const cardBox = useRef<HTMLDivElement>(null);
  // What lies over the map: the chips' row, the zoom buttons, Show me and the card.
  const chipsRow = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const showMeButton = useRef<HTMLButtonElement>(null);
  const cardWrap = useRef<HTMLDivElement>(null);
  /** Their boxes within the map, as last measured: a pin under one isn't drawn (`clear`). */
  const [covered, setCovered] = useState<readonly Rect[]>([]);
  /** The card's heading after a tap opened it, and a pin after the card closed (keys `card` and `pin:<spot>`). */
  const focus = useFocusAfter();
  /** The flavour the map was last drawn in, so a theme change redraws it once. */
  const drawnFlavor = useRef<MapFlavor | null>(null);
  const lastFit = useRef(fitKey);
  const lastCentre = useRef(centreOn);
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

  // Show me found the phone: the map centres on it, at street level or closer.
  const centreHere = useEffectEvent(() => {
    if (map !== null && here !== null) map.easeTo({ center: [here.lng, here.lat], zoom: Math.max(map.getZoom(), HERE_ZOOM) });
  });
  useEffect(() => {
    if (lastCentre.current === centreOn) return;
    lastCentre.current = centreOn;
    centreHere();
  }, [centreOn]);

  // A pin just chosen: the card is drawn by now (effects run after it), so the map can make room for the teardrop.
  useEffect(() => {
    if (chosen !== null && state === 'ready') showChosen();
  }, [chosen, state]);

  // What lies over the map is measured whenever it changes size, and again when the card or Show me comes or goes, so
  // no pin is drawn under it: hidden but still reachable by the keyboard, or a target too small to tap (axe's
  // target-size, CI run 43191801922).
  const hasCard = card.length > 0 && chosen !== null;
  const hasShowMe = onShowMe !== null;
  useEffect(() => {
    const frame = box.current;
    if (frame === null || state !== 'ready') return;
    const overlays = [chipsRow.current, controls.current, showMeButton.current, cardWrap.current].filter(
      (element): element is HTMLDivElement | HTMLButtonElement => element !== null,
    );
    const measure = () => {
      const origin = frame.getBoundingClientRect();
      setCovered(
        overlays.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left - origin.left,
            top: rect.top - origin.top,
            right: rect.right - origin.left,
            bottom: rect.bottom - origin.top,
          };
        }),
      );
    };
    // A ResizeObserver reports each element once as it starts watching, then on every change of size.
    const observer = new ResizeObserver(measure);
    for (const element of [frame, ...overlays]) observer.observe(element);
    return () => observer.disconnect();
  }, [state, hasCard, hasShowMe]);

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
  /** The phone's place on the screen, once Show me found it. */
  const dotAt = ready && here !== null ? map.project([here.lng, here.lat]) : null;
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
            {/* Where the phone is (Show me): a dot in the primary colour, ringed in the card's, with a soft halo. Under
                the pins, and only for the eye: the pressed "You're here" says it. */}
            {dotAt !== null && dotAt.x >= 0 && dotAt.y >= 0 && dotAt.x <= width && dotAt.y <= height && (
              <span
                aria-hidden="true"
                data-location-dot=""
                className="absolute start-0 top-0 size-6 rounded-full border-[3px] border-card bg-primary"
                style={{
                  transform: `translate(${dotAt.x - 12}px, ${dotAt.y - 12}px)`,
                  boxShadow: '0 0 0 7px color-mix(in oklch, var(--primary) 28%, transparent)',
                }}
              />
            )}
            {pins.map((pin) => {
              const { x, y } = placeOf(pin);
              // The chosen teardrop rises above its tip, and the map keeps it in the room above the card itself.
              const keptInView = pin.kind === 'spot' && pin.spot.key === chosen;
              if (!clear(x, y, width, height, keptInView ? [] : covered)) return null;
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
        <div ref={chipsRow} className="pointer-events-none absolute inset-x-0 top-0 p-2 *:pointer-events-auto">
          {chips}
        </div>
        {ready && (
          <div ref={controls} className="absolute end-2 top-16 flex flex-col gap-2">
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
        {ready && (
          // The room below the chips, with Show me and the card at its bottom: 10 px from the map's edges, the pill
          // just above the card, and the card scrolling when it is taller than the room (several discounts at a spot
          // on a short screen).
          <div className="pointer-events-none absolute inset-x-2.5 top-[4.5rem] bottom-2.5 flex flex-col justify-end">
            <div ref={cardBox} className="flex max-h-full min-h-0 flex-col items-start gap-2">
              {onShowMe !== null && (
                <Button
                  ref={showMeButton}
                  type="button"
                  variant={here === null ? 'outline' : 'default'}
                  aria-pressed={here !== null}
                  className={cn('pointer-events-auto rounded-full px-4', here === null && 'shadow-offset')}
                  onClick={onShowMe}
                >
                  <LocateFixedIcon aria-hidden="true" className="size-5" />
                  {here === null ? text.showMe : text.youreHere}
                </Button>
              )}
              {chosenSpot !== undefined && card.length > 0 && (
                <div ref={cardWrap} className="pointer-events-auto flex min-h-0 w-full flex-col">
                  <DiscountCard
                    key={chosenSpot.key}
                    entries={card}
                    label={spotName(chosenSpot, text)}
                    headingRef={focus.refFor('card')}
                    onClose={close}
                    onShowInList={onShowInList}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {state === 'loading' && <p className="text-sm text-muted-foreground">{text.loading}</p>}
      {locationNote !== null && <StatusLine className="text-sm">{locationNote}</StatusLine>}
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
