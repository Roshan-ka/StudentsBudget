// How far a discount is from where the phone is (discount map, chunk 6: Show me). Pure: the position comes from the
// browser only on a tap, stays in memory, and is never stored or sent.

import { inRegensburgBox } from '@/data/regensburg-box';

/** A position in degrees (WGS 84). */
export type LatLng = { lat: number; lng: number };

/** The Earth's mean radius, in metres: the haversine's sphere, a few metres off over a city at most. */
const EARTH_RADIUS = 6_371_008.8;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The distance between two positions along the Earth's surface, in metres (the haversine formula). */
export function distanceMeters(from: LatLng, to: LatLng): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * A distance as a person says it, in the language's locale: metres rounded to 10 below a kilometre ("850 m"), then
 * kilometres to one decimal below 10 ("2.8 km", "2,8 km"), then whole kilometres. Never "0 m": closer than 10 m reads
 * "10 m".
 */
export function formatDistance(meters: number, locale: string): string {
  if (meters < 995) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', unitDisplay: 'short' }).format(rounded);
  }
  const km = meters / 1000;
  const digits = km < 9.95 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(km);
}

/** What asking for the phone's position gave: where it is, or why the map stays on the city. */
export type WhereResult =
  | { kind: 'here'; at: LatLng }
  | { kind: 'outside' }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/** The part of `navigator.geolocation` Show me uses, so a test can stand in for it. */
export type Locator = Pick<Geolocation, 'getCurrentPosition'>;

/** The browser's error code for a refused permission (`GeolocationPositionError.PERMISSION_DENIED`). */
const PERMISSION_DENIED = 1;

/**
 * Asks the browser once for the phone's position: only from a tap, never stored. Outside Regensburg's box the
 * position is dropped (`outside`), so no distance reads in tens of kilometres. A refused permission is `denied`; no
 * fix, a timeout or a failure is `unavailable`.
 */
export function whereIs(geolocation: Locator): Promise<WhereResult> {
  return new Promise((resolve) => {
    try {
      geolocation.getCurrentPosition(
        ({ coords }) => {
          const at = { lat: coords.latitude, lng: coords.longitude };
          resolve(inRegensburgBox(at.lat, at.lng) ? { kind: 'here', at } : { kind: 'outside' });
        },
        (error) => resolve({ kind: error.code === PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        // A fix of up to a minute ago will do; a cold start may take a while outdoors.
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
      );
    } catch {
      resolve({ kind: 'unavailable' });
    }
  });
}
