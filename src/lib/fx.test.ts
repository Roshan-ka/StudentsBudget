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
});

describe('fetchEcbRates', () => {
  it('reads the rate date and the rates from the Frankfurter response', async () => {
    const fake = vi.fn<typeof fetch>(async () =>
      jsonResponse({ amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95.12 } }),
    );

    expect(await fetchEcbRates(['INR'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
  });

  it('asks Frankfurter for the EUR base and the requested symbols only', async () => {
    const fake = vi.fn<typeof fetch>(async () =>
      jsonResponse({ amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95.12, USD: 1.1 } }),
    );

    await fetchEcbRates(['INR', 'USD'], fake);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake.mock.calls[0]?.[0]).toBe('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=INR,USD');
  });

  it('throws on a non-OK response', async () => {
    const fake = vi.fn<typeof fetch>(async () => jsonResponse({ message: 'not found' }, { status: 404 }));

    await expect(fetchEcbRates(['INR'], fake)).rejects.toThrow('404');
  });

  it('throws when the body is not the expected shape', async () => {
    const bodies: unknown[] = [
      null,
      { base: 'EUR', date: '2026-10-16' },
      { base: 'EUR', date: 'yesterday', rates: { INR: 95.12 } },
      { base: 'USD', date: '2026-10-16', rates: { INR: 95.12 } },
      { base: 'EUR', date: '2026-10-16', rates: { INR: '95.12' } },
      { base: 'EUR', date: '2026-10-16', rates: { INR: 0 } },
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

  it('leaves out requested currencies the response does not contain', async () => {
    const fake = vi.fn<typeof fetch>(async () =>
      jsonResponse({ amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95.12 } }),
    );

    expect(await fetchEcbRates(['INR', 'TRY'], fake)).toEqual({ rateDate: '2026-10-16', perEur: { INR: 95.12 } });
  });
});
