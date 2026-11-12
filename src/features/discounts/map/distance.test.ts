import { describe, expect, it } from 'vitest';
import { DISCOUNTS } from '@/data/discounts';
import { distanceMeters, formatDistance, whereIs, type Locator } from './distance';

/** NBSP and narrow NBSP, as Intl writes them between a number and its unit or between thousands. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('distanceMeters', () => {
  it('is 0 from a place to itself', () => {
    expect(distanceMeters({ lat: 49.02, lng: 12.09 }, { lat: 49.02, lng: 12.09 })).toBe(0);
  });

  it('measures a degree of latitude as about 111.2 km, and is the same both ways', () => {
    const a = { lat: 49, lng: 12.09 };
    const b = { lat: 50, lng: 12.09 };
    expect(distanceMeters(a, b)).toBeCloseTo(111_195, -1);
    expect(distanceMeters(b, a)).toBe(distanceMeters(a, b));
  });

  it('measures a degree of longitude at 49° as cos 49° of one at the equator', () => {
    const atEquator = distanceMeters({ lat: 0, lng: 12 }, { lat: 0, lng: 13 });
    const atRegensburg = distanceMeters({ lat: 49, lng: 12 }, { lat: 49, lng: 13 });
    expect(atRegensburg / atEquator).toBeCloseTo(Math.cos((49 * Math.PI) / 180), 3);
  });

  it('puts Westbad about 2.9 km from Haidplatz, as the map shows them', () => {
    const at = (id: string) => {
      const location = DISCOUNTS.find((d) => d.id === id)?.location;
      if (location === undefined) throw new Error(`${id} has no position`);
      return location;
    };
    const metres = distanceMeters(at('stadtbuecherei-library-card'), at('westbad'));
    // 4.4 km of longitude × cos 49° west and 490 m north.
    expect(metres).toBeGreaterThan(2_850);
    expect(metres).toBeLessThan(2_950);
  });
});

describe('formatDistance', () => {
  it('writes metres rounded to 10 below a kilometre, and never 0', () => {
    expect(plain(formatDistance(847, 'en-IE'))).toBe('850 m');
    expect(plain(formatDistance(3, 'en-IE'))).toBe('10 m');
    expect(plain(formatDistance(994, 'en-IE'))).toBe('990 m');
  });

  it("writes kilometres to one decimal below 10, in the language's own way", () => {
    expect(plain(formatDistance(995, 'en-IE'))).toBe('1.0 km');
    expect(plain(formatDistance(2_784, 'en-IE'))).toBe('2.8 km');
    expect(plain(formatDistance(2_784, 'de-DE'))).toBe('2,8 km');
    expect(plain(formatDistance(2_784, 'fr-FR'))).toBe('2,8 km');
    expect(plain(formatDistance(2_784, 'es-ES'))).toBe('2,8 km');
  });

  it('writes whole kilometres from 10 on', () => {
    expect(plain(formatDistance(9_949, 'en-IE'))).toBe('9.9 km');
    expect(plain(formatDistance(9_950, 'en-IE'))).toBe('10 km');
    expect(plain(formatDistance(12_400, 'de-DE'))).toBe('12 km');
  });
});

/** A stand-in for the browser's geolocation that answers at once. */
function answering(answer: { lat: number; lng: number } | { code: number } | 'throws'): Locator {
  return {
    getCurrentPosition(success, failure) {
      if (answer === 'throws') throw new Error('no geolocation here');
      if ('code' in answer) {
        failure?.({ code: answer.code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        return;
      }
      success({
        coords: { latitude: answer.lat, longitude: answer.lng },
        timestamp: 0,
      } as GeolocationPosition);
    },
  };
}

describe('whereIs', () => {
  it('gives the position inside Regensburg', async () => {
    await expect(whereIs(answering({ lat: 49.0195, lng: 12.095 }))).resolves.toEqual({
      kind: 'here',
      at: { lat: 49.0195, lng: 12.095 },
    });
  });

  it('drops a position outside Regensburg', async () => {
    await expect(whereIs(answering({ lat: 48.137, lng: 11.575 }))).resolves.toEqual({ kind: 'outside' });
  });

  it('tells a refused permission from a position that could not be found', async () => {
    await expect(whereIs(answering({ code: 1 }))).resolves.toEqual({ kind: 'denied' });
    await expect(whereIs(answering({ code: 2 }))).resolves.toEqual({ kind: 'unavailable' });
    await expect(whereIs(answering({ code: 3 }))).resolves.toEqual({ kind: 'unavailable' });
    await expect(whereIs(answering('throws'))).resolves.toEqual({ kind: 'unavailable' });
  });
});
