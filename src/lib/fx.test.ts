import { describe, expect, it, vi } from 'vitest';
import type { Rate } from '@/db/types';
import { fetchEcbRates, toEurMinor } from './fx';

function rate(perEur: number): Rate {
  return { currency: 'INR', perEur, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, ...init });
}

describe('toEurMinor', () => {
  it('converts with the rate: 9500 paise at 95 per euro is 100 cents', () => {
    expect(toEurMinor(9500, 'INR', { INR: rate(95) })).toBe(100);
  });

  it('returns EUR amounts unchanged without a rate', () => {
    expect(toEurMinor(650, 'EUR', {})).toBe(650);
  });

  it('returns null when there is no rate for the currency', () => {
    expect(toEurMinor(100, 'INR', {})).toBeNull();
  });

  it('rounds to the nearest cent', () => {
    expect(toEurMinor(9499, 'INR', { INR: rate(95) })).toBe(100); // 99.99
    expect(toEurMinor(9524, 'INR', { INR: rate(95) })).toBe(100); // 100.25
    expect(toEurMinor(9548, 'INR', { INR: rate(95) })).toBe(101); // 100.50...
  });

  it('keeps the sign of a negative amount', () => {
    expect(toEurMinor(-9500, 'INR', { INR: rate(95) })).toBe(-100);
  });

  it('returns 0, never -0, for a small negative amount', () => {
    // -20 / 95 = -0.21, which Math.round turns into -0.
    expect(Object.is(toEurMinor(-20, 'INR', { INR: rate(95) }), 0)).toBe(true);
    expect(Object.is(toEurMinor(0, 'INR', { INR: rate(95) }), 0)).toBe(true);
  });
});

function row(quote: string, rate: unknown, date = '2026-10-16', base = 'EUR') {
  return { date, base, quote, rate };
}

describe('fetchEcbRates', () => {
  it('reads the rate date and the rates from the Frankfurter v2 rows', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([row('INR', 95.12)]));

    expect(await fetchEcbRates(['INR'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
  });

  it('asks Frankfurter v2 for the EUR base, the requested quotes and the ECB only', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([row('INR', 95.12), row('USD', 1.1)]));

    await fetchEcbRates(['INR', 'USD'], fake);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake.mock.calls[0]?.[0]).toBe('https://api.frankfurter.dev/v2/rates?base=EUR&quotes=INR,USD&providers=ecb');
  });

  it('takes the newest row date as the rate date', async () => {
    const fake = vi.fn<typeof fetch>(async () =>
      jsonResponse([row('INR', 95, '2026-10-15'), row('USD', 1.1, '2026-10-16')]),
    );

    expect(await fetchEcbRates(['INR', 'USD'], fake)).toEqual({
      rateDate: '2026-10-16',
      perEur: { INR: 95, USD: 1.1 },
    });
  });

  it('throws on a non-OK response, a 422 for an unknown parameter included', async () => {
    const notFound = vi.fn<typeof fetch>(async () => jsonResponse({ message: 'not found' }, { status: 404 }));
    const unknown = vi.fn<typeof fetch>(async () =>
      jsonResponse({ status: 422, message: 'unknown parameter: symbols' }, { status: 422 }),
    );

    await expect(fetchEcbRates(['INR'], notFound)).rejects.toThrow('404');
    await expect(fetchEcbRates(['INR'], unknown)).rejects.toThrow('422');
  });

  it('throws when the body is not the expected shape', async () => {
    const bodies: unknown[] = [
      null,
      // The v1 shape, which an old proxy or cache could still send.
      { amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95.12 } },
      ['INR'],
      [null],
      [row('INR', 95.12, 'yesterday')],
      [{ base: 'EUR', quote: 'INR', rate: 95.12 }],
      [row('INR', 95.12, '2026-10-16', 'USD')],
      [{ date: '2026-10-16', quote: 'INR', rate: 95.12 }],
      [row('XYZ', 95.12)],
      [{ date: '2026-10-16', base: 'EUR', rate: 95.12 }],
      [{ date: '2026-10-16', base: 'EUR', quote: 5, rate: 95.12 }],
      [row('INR', '95.12')],
      [row('INR', 0)],
      [row('INR', -95)],
      [row('INR', null)],
      // One bad row spoils the response, even next to a good one.
      [row('USD', 1.1), row('INR', 0)],
      [row('USD', 1.1), row('INR', 95.12, '2026-10-16', 'GBP')],
    ];

    for (const body of bodies) {
      const fake = vi.fn<typeof fetch>(async () => jsonResponse(body));
      await expect(fetchEcbRates(['INR'], fake), JSON.stringify(body)).rejects.toThrow();
    }
  });

  it('throws when the body is not JSON', async () => {
    const fake = vi.fn<typeof fetch>(async () => new Response('<html>oops</html>'));

    await expect(fetchEcbRates(['INR'], fake)).rejects.toThrow();
  });

  it('throws on an empty list: no rows means no rate date and no rates', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([]));

    await expect(fetchEcbRates(['INR'], fake)).rejects.toThrow('no rates');
  });

  it('skips a row for a currency the app has no code for, instead of failing the refresh', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([row('INR', 95.12), row('XYZ', 7), row('ZZZ', 'bad')]));

    expect(await fetchEcbRates(['INR'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
  });

  it('does not take the rate date from a skipped row', async () => {
    const fake = vi.fn<typeof fetch>(async () =>
      jsonResponse([row('INR', 95, '2026-10-15'), row('XYZ', 7, '2026-10-16')]),
    );

    expect(await fetchEcbRates(['INR'], fake)).toEqual({ rateDate: '2026-10-15', perEur: { INR: 95 } });
  });

  it('still throws on a skipped row that is not a row: wrong base or a bad date', async () => {
    for (const body of [[row('INR', 95.12), row('XYZ', 7, '2026-10-16', 'USD')], [row('INR', 95.12), row('XYZ', 7, 'soon')]]) {
      const fake = vi.fn<typeof fetch>(async () => jsonResponse(body));
      await expect(fetchEcbRates(['INR'], fake), JSON.stringify(body)).rejects.toThrow('unexpected shape');
    }
  });

  it('throws when every row is for a currency the app has no code for: nothing is left to date or use', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([row('XYZ', 7), row('ZZZ', 2)]));

    await expect(fetchEcbRates(['INR'], fake)).rejects.toThrow('no rates');
  });

  it('leaves out requested currencies the response does not contain', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([row('INR', 95.12)]));

    expect(await fetchEcbRates(['INR', 'TRY'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
  });

  it('leaves out rows of known currencies that were not requested', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse([row('INR', 95.12), row('USD', 1.1)]));

    expect(await fetchEcbRates(['INR'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
  });
});
