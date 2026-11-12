import { describe, expect, it } from 'vitest';
import { DISCOUNTS } from '@/data/discounts';
import { boxOf, JOIN_DISTANCE, pinsOf, spotsOf, worldPixel, type MapItem, type Placed, type Spot } from './pins';

function item(id: string, lat: number, lng: number, extra: Partial<MapItem> = {}): MapItem {
  return { id, place: id, offer: `${id} offer`, categoryId: 'other', lat, lng, student: false, ...extra };
}

/** Spots placed at screen positions, by key. */
function placed(spots: readonly Spot[], at: Record<string, [number, number]>): Placed[] {
  return spots.map((spot) => ({ spot, x: at[spot.key][0], y: at[spot.key][1] }));
}

describe('spotsOf', () => {
  it('puts items at one position into one spot, in their order', () => {
    const spots = spotsOf([item('a', 49.02, 12.09), item('b', 49.01, 12.1), item('c', 49.02, 12.09)]);
    expect(spots.map((spot) => spot.items.map((i) => i.id))).toEqual([['a', 'c'], ['b']]);
    expect(spots[0]).toMatchObject({ key: '49.02,12.09', lat: 49.02, lng: 12.09 });
  });

  it('orders spots north to south, then west to east', () => {
    const spots = spotsOf([item('south', 49.0, 12.1), item('north-east', 49.03, 12.12), item('north-west', 49.03, 12.05)]);
    expect(spots.map((spot) => spot.items[0].id)).toEqual(['north-west', 'north-east', 'south']);
  });

  it('gives the bundled discounts one spot each, except Haidplatz 8, which holds two', () => {
    const spots = spotsOf(
      DISCOUNTS.map((d) => item(d.id, d.location?.lat ?? 0, d.location?.lng ?? 0)),
    );
    expect(spots).toHaveLength(DISCOUNTS.length - 1);
    expect(spots.filter((spot) => spot.items.length > 1).map((spot) => spot.items.map((i) => i.id))).toEqual([
      ['stadtbuecherei-library-card', 'vhs-course-fees'],
    ]);
  });
});

describe('pinsOf', () => {
  const spots = spotsOf([item('a', 49.04, 12.0), item('b', 49.03, 12.0), item('c', 49.02, 12.0), item('d', 49.01, 12.0)]);
  const [a, b, c, d] = spots.map((spot) => spot.key);

  it('gives spots far apart a pin each', () => {
    const pins = pinsOf(placed(spots, { [a]: [0, 0], [b]: [100, 0], [c]: [0, 100], [d]: [100, 100] }), null);
    expect(pins.map((pin) => pin.kind)).toEqual(['spot', 'spot', 'spot', 'spot']);
    expect(pins.map((pin) => pin.key)).toEqual([a, b, c, d]);
  });

  it('joins spots closer than the distance into a count pin of their discounts', () => {
    const haidplatz = spotsOf([item('x', 49.0, 12.0), item('y', 49.0, 12.0)]);
    const all = [...spots, ...haidplatz];
    const at = { [a]: [0, 0], [b]: [JOIN_DISTANCE - 1, 0], [c]: [200, 200], [d]: [400, 400], [haidplatz[0].key]: [10, 10] };
    const pins = pinsOf(placed(all, at as Record<string, [number, number]>), null);
    expect(pins.map((pin) => pin.kind)).toEqual(['count', 'spot', 'spot']);
    const count = pins[0];
    if (count.kind !== 'count') throw new Error('a count pin first');
    expect(count.spots.map((spot) => spot.key)).toEqual([a, b, haidplatz[0].key]);
    // Two spots of one discount each, and Haidplatz's two.
    expect(count.count).toBe(4);
  });

  it('keeps spots exactly the distance apart on their own', () => {
    const pins = pinsOf(placed(spots, { [a]: [0, 0], [b]: [JOIN_DISTANCE, 0], [c]: [300, 0], [d]: [600, 0] }), null);
    expect(pins.every((pin) => pin.kind === 'spot')).toBe(true);
  });

  it('never puts the chosen spot into a count pin', () => {
    const together = { [a]: [0, 0], [b]: [5, 0], [c]: [10, 0], [d]: [500, 0] } as Record<string, [number, number]>;
    const pins = pinsOf(placed(spots, together), b);
    expect(pins.map((pin) => [pin.kind, pin.kind === 'count' ? pin.count : pin.key])).toEqual([
      ['count', 2],
      ['spot', b],
      ['spot', d],
    ]);
  });

  it('makes no pins of no spots', () => {
    expect(pinsOf([], null)).toEqual([]);
  });
});

describe('worldPixel', () => {
  it('puts 0° 0° in the middle of a 512 px world at zoom 0', () => {
    expect(worldPixel(0, 0, 0)).toEqual({ x: 256, y: 256 });
  });

  it('runs west to east and north to south', () => {
    const middle = worldPixel(49.02, 12.09, 14);
    expect(worldPixel(49.02, 12.1, 14).x).toBeGreaterThan(middle.x);
    expect(worldPixel(49.0, 12.09, 14).y).toBeGreaterThan(middle.y);
  });

  it('doubles every distance with each zoom', () => {
    const at = (zoom: number) => {
      const a = worldPixel(49.02, 12.09, zoom);
      const b = worldPixel(49.0, 12.12, zoom);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    expect(at(15) / at(14)).toBeCloseTo(2, 10);
  });

  it('agrees with a metre scale: about 0.39 m per pixel at zoom 17 in Regensburg', () => {
    // 100 m north–south is 100 / 111_320 degrees of latitude; at 49° a pixel is 40 075 016 × cos 49° / (512 × 2^17) m.
    const a = worldPixel(49.02, 12.09, 17);
    const b = worldPixel(49.02 + 100 / 111_320, 12.09, 17);
    const metresPerPixel = (40_075_016 * Math.cos((49.02 * Math.PI) / 180)) / (512 * 2 ** 17);
    expect(a.y - b.y).toBeCloseTo(100 / metresPerPixel, 0);
  });
});

describe('boxOf', () => {
  it('is the box around the spots, west, south, east, north', () => {
    expect(boxOf([{ lat: 49.02, lng: 12.1 }, { lat: 49.0, lng: 12.05 }, { lat: 49.03, lng: 12.13 }])).toEqual([
      12.05, 49.0, 12.13, 49.03,
    ]);
  });

  it('is null for no spots', () => {
    expect(boxOf([])).toBeNull();
  });
});
