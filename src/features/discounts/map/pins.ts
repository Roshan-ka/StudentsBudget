// What the discount map draws (discount map, chunk 4; the look Roshan approved in chunk 2's mockups): one pin per spot
// (the discounts at one position, with a count when there are more), and count pins where spots sit closer than
// `JOIN_DISTANCE` on screen. Pure, so the grouping is tested without a map: the view projects the positions.

/** A discount as the map shows it: its words (in the phone's language where translated) and its position. */
export type MapItem = {
  id: string;
  place: string;
  offer: string;
  categoryId: string;
  lat: number;
  lng: number;
  /** Added by a student: its pin is marked so. */
  student: boolean;
};

/** The discounts at one position, which share a pin. `key` names the position. */
export type Spot = { key: string; lat: number; lng: number; items: readonly MapItem[] };

/** A spot at its place on the screen, in CSS pixels from the map's top-left corner. */
export type Placed = { spot: Spot; x: number; y: number };

/** A spot's own pin, or a count pin for spots that sit close together on the screen. */
export type Pin =
  | { kind: 'spot'; key: string; spot: Spot }
  | { kind: 'count'; key: string; spots: readonly Spot[]; count: number };

/** Pins whose centres are closer than this, in CSS pixels, join into a count pin: a 44 px pin and a little air. */
export const JOIN_DISTANCE = 46;

/** West, south, east, north, in degrees. */
export type Box = [number, number, number, number];

/** The key of the spot at a position: what `chosen` names, so the view finds the chosen spot's discounts. */
export const spotKey = (lat: number, lng: number) => `${lat},${lng}`;
const keyOf = spotKey;

/**
 * The spots the items make: items at the same position share one, in the order given. Spots run north to south, then
 * west to east, the order they're read on a north-up map, so the keyboard meets the pins as the eye does.
 */
export function spotsOf(items: readonly MapItem[]): Spot[] {
  const byKey = new Map<string, MapItem[]>();
  for (const item of items) {
    const key = keyOf(item.lat, item.lng);
    const at = byKey.get(key);
    if (at === undefined) byKey.set(key, [item]);
    else at.push(item);
  }
  return [...byKey.values()]
    .map((at) => ({ key: keyOf(at[0].lat, at[0].lng), lat: at[0].lat, lng: at[0].lng, items: at }))
    .sort((a, b) => b.lat - a.lat || a.lng - b.lng);
}

/**
 * The pins for spots placed on the screen. Going through the spots in their order, each spot not yet taken starts a
 * pin and takes every other free spot within `distance` of it; two or more make a count pin. The chosen spot always
 * keeps its own pin, so what is chosen never hides in a count. Pins keep the spots' order.
 */
export function pinsOf(placed: readonly Placed[], chosen: string | null, distance = JOIN_DISTANCE): Pin[] {
  const taken = new Set<string>();
  const pins: Pin[] = [];
  for (const start of placed) {
    if (taken.has(start.spot.key)) continue;
    taken.add(start.spot.key);
    if (start.spot.key === chosen) {
      pins.push({ kind: 'spot', key: start.spot.key, spot: start.spot });
      continue;
    }
    const near = placed.filter(
      (other) =>
        !taken.has(other.spot.key) &&
        other.spot.key !== chosen &&
        Math.hypot(other.x - start.x, other.y - start.y) < distance,
    );
    if (near.length === 0) {
      pins.push({ kind: 'spot', key: start.spot.key, spot: start.spot });
      continue;
    }
    for (const other of near) taken.add(other.spot.key);
    const spots = [start.spot, ...near.map((other) => other.spot)];
    pins.push({
      kind: 'count',
      key: `count:${spots.map((spot) => spot.key).join('|')}`,
      spots,
      count: spots.reduce((sum, spot) => sum + spot.items.length, 0),
    });
  }
  return pins;
}

/**
 * Where a position lies on the whole world's map at `zoom`, in CSS pixels (Web Mercator). MapLibre's zooms count
 * 512 px tiles, so the world is 512 × 2^zoom pixels wide. Distances between these points are distances on the screen,
 * which is all the grouping needs: `pinsOf` runs on them at the zoom the map came to rest at.
 */
export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const size = 512 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** The box around the spots, or null for none. */
export function boxOf(spots: readonly Pick<Spot, 'lat' | 'lng'>[]): Box | null {
  if (spots.length === 0) return null;
  const lats = spots.map((spot) => spot.lat);
  const lngs = spots.map((spot) => spot.lng);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
