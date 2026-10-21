import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { CurrencyCode } from '@/lib/money';
import { db } from './db';
import { clearManualRate, loadRates, refreshRates, setManualRate } from './rates';
import type { Account, Rate } from './types';

const TODAY = '2026-10-16';
const YESTERDAY = '2026-10-15';

function account(id: string, currency: CurrencyCode): Account {
  return { id, name: id, kind: 'bank', currency, openingMinor: 0, createdAt: '2026-10-01T08:00:00.000Z' };
}

function ecb(currency: CurrencyCode, perEur: number, fetchedOn = TODAY): Rate {
  return { currency, perEur, rateDate: fetchedOn, fetchedOn, source: 'ecb' };
}

function manual(currency: CurrencyCode, perEur: number, fetchedOn = TODAY): Rate {
  return { currency, perEur, rateDate: fetchedOn, fetchedOn, source: 'manual' };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, ...init });
}

/** A fake Frankfurter (v2) that answers with a row per given rate, dated today and sorted by quote. */
function fakeFrankfurter(rates: Partial<Record<CurrencyCode, number>>) {
  return vi.fn<typeof fetch>(async () => jsonResponse(v2Rows(rates)));
}

function v2Rows(rates: Partial<Record<CurrencyCode, number>>, date = TODAY) {
  return Object.entries(rates)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quote, rate]) => ({ date, base: 'EUR', quote, rate }));
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  // A failed refresh is logged; keep that out of the test output.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('refreshRates', () => {
  it('returns none-needed without fetching when no account uses a foreign currency', async () => {
    const fake = fakeFrankfurter({});
    expect(await refreshRates(TODAY, fake)).toBe('none-needed');

    await db.accounts.add(account('a1', 'EUR'));
    expect(await refreshRates(TODAY, fake)).toBe('none-needed');

    expect(fake).not.toHaveBeenCalled();
  });

  it('fetches each foreign currency in use once and stores it as an ECB rate', async () => {
    await db.accounts.bulkAdd([
      account('a1', 'EUR'),
      account('a2', 'INR'),
      account('a3', 'INR'),
      account('a4', 'USD'),
    ]);
    const fake = fakeFrankfurter({ INR: 95.12, USD: 1.1 });

    expect(await refreshRates(TODAY, fake)).toBe('updated');

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake.mock.calls[0]?.[0]).toBe('https://api.frankfurter.dev/v2/rates?base=EUR&quotes=INR,USD&providers=ecb');
    expect(await db.fxRates.toArray()).toEqual(
      expect.arrayContaining([
        { currency: 'INR', perEur: 95.12, rateDate: TODAY, fetchedOn: TODAY, source: 'ecb' },
        { currency: 'USD', perEur: 1.1, rateDate: TODAY, fetchedOn: TODAY, source: 'ecb' },
      ]),
    );
    expect(await db.fxRates.count()).toBe(2);
  });

  it('stores the rate date of the rows apart from the day it was fetched', async () => {
    await db.accounts.add(account('a1', 'INR'));
    const weekend = vi.fn<typeof fetch>(async () => jsonResponse(v2Rows({ INR: 95.12 }, YESTERDAY)));

    expect(await refreshRates(TODAY, weekend)).toBe('updated');

    expect(await db.fxRates.get(['INR', 'ecb'])).toEqual({
      currency: 'INR',
      perEur: 95.12,
      rateDate: YESTERDAY,
      fetchedOn: TODAY,
      source: 'ecb',
    });
  });

  it('returns fresh without fetching when fetched today', async () => {
    await db.accounts.add(account('a1', 'INR'));
    await db.fxRates.put(ecb('INR', 95));
    const fake = fakeFrankfurter({ INR: 99 });

    expect(await refreshRates(TODAY, fake)).toBe('fresh');

    expect(fake).not.toHaveBeenCalled();
    expect((await loadRates()).INR?.perEur).toBe(95);
  });

  it('fetches again when the stored rate is from an earlier day', async () => {
    await db.accounts.add(account('a1', 'INR'));
    await db.fxRates.put(ecb('INR', 95, YESTERDAY));
    const fake = fakeFrankfurter({ INR: 96 });

    expect(await refreshRates(TODAY, fake)).toBe('updated');

    expect(await db.fxRates.get(['INR', 'ecb'])).toEqual(ecb('INR', 96));
  });

  it('fetches when a currency in use has no rate yet, even if another is fresh', async () => {
    await db.accounts.bulkAdd([account('a1', 'INR'), account('a2', 'USD')]);
    await db.fxRates.put(ecb('INR', 95));
    const fake = fakeFrankfurter({ INR: 95, USD: 1.1 });

    expect(await refreshRates(TODAY, fake)).toBe('updated');

    expect((await loadRates()).USD?.perEur).toBe(1.1);
  });

  it('keeps the old rate when the fetch fails', async () => {
    await db.accounts.add(account('a1', 'INR'));
    const old = ecb('INR', 95, YESTERDAY);
    await db.fxRates.put(old);
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await refreshRates(TODAY, offline)).toBe('failed');

    expect(await db.fxRates.toArray()).toEqual([old]);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('returns failed on a non-OK response or an unreadable body, and stores nothing', async () => {
    await db.accounts.add(account('a1', 'INR'));
    const serverError = vi.fn<typeof fetch>(async () => jsonResponse({ message: 'oops' }, { status: 500 }));
    const unknownParameter = vi.fn<typeof fetch>(async () =>
      jsonResponse({ status: 422, message: 'unknown parameter: symbols' }, { status: 422 }),
    );
    const notJson = vi.fn<typeof fetch>(async () => new Response('<html>oops</html>'));
    const wrongShape = vi.fn<typeof fetch>(async () => jsonResponse({ rates: 'none' }));
    const wrongBase = vi.fn<typeof fetch>(async () =>
      jsonResponse([{ date: TODAY, base: 'USD', quote: 'INR', rate: 95 }]),
    );
    const badDate = vi.fn<typeof fetch>(async () =>
      jsonResponse([{ date: 'yesterday', base: 'EUR', quote: 'INR', rate: 95 }]),
    );
    const badRate = vi.fn<typeof fetch>(async () => jsonResponse([{ date: TODAY, base: 'EUR', quote: 'INR', rate: 0 }]));

    expect(await refreshRates(TODAY, serverError)).toBe('failed');
    expect(await refreshRates(TODAY, unknownParameter)).toBe('failed');
    expect(await refreshRates(TODAY, notJson)).toBe('failed');
    expect(await refreshRates(TODAY, wrongShape)).toBe('failed');
    expect(await refreshRates(TODAY, wrongBase)).toBe('failed');
    expect(await refreshRates(TODAY, badDate)).toBe('failed');
    expect(await refreshRates(TODAY, badRate)).toBe('failed');

    expect(await db.fxRates.count()).toBe(0);
  });

  it('returns failed on an empty list, keeping the old rate', async () => {
    await db.accounts.add(account('a1', 'INR'));
    const old = ecb('INR', 95, YESTERDAY);
    await db.fxRates.put(old);

    expect(await refreshRates(TODAY, fakeFrankfurter({}))).toBe('failed');

    expect(await db.fxRates.toArray()).toEqual([old]);
  });

  it('returns failed when the response has none of the currencies in use', async () => {
    await db.accounts.add(account('a1', 'INR'));

    expect(await refreshRates(TODAY, fakeFrankfurter({ USD: 1.1 }))).toBe('failed');

    expect(await db.fxRates.count()).toBe(0);
  });

  it('never overwrites a manual rate', async () => {
    await db.accounts.add(account('a1', 'INR'));
    await db.fxRates.put(manual('INR', 97, YESTERDAY));
    const fake = fakeFrankfurter({ INR: 95.12 });

    expect(await refreshRates(TODAY, fake)).toBe('updated');

    expect(await db.fxRates.get(['INR', 'manual'])).toEqual(manual('INR', 97, YESTERDAY));
    expect(await db.fxRates.get(['INR', 'ecb'])).toEqual(ecb('INR', 95.12));
    expect((await loadRates()).INR).toEqual(manual('INR', 97, YESTERDAY));
  });

  it('does not fetch twice when called concurrently', async () => {
    await db.accounts.add(account('a1', 'INR'));
    const fake = fakeFrankfurter({ INR: 95.12 });

    const results = await Promise.all([refreshRates(TODAY, fake), refreshRates(TODAY, fake)]);

    expect(results).toEqual(['updated', 'fresh']);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(await db.fxRates.count()).toBe(1);
  });

  it('a call made while another is running still sees accounts added in between', async () => {
    await db.accounts.add(account('a1', 'INR'));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fake = vi.fn<typeof fetch>(async (input) => {
      await gate;
      const quotes = new URL(String(input)).searchParams.get('quotes') ?? '';
      const rates = Object.fromEntries(quotes.split(',').map((c) => [c, c === 'INR' ? 95 : 1.1]));
      return jsonResponse(v2Rows(rates));
    });

    const first = refreshRates(TODAY, fake);
    await vi.waitFor(() => expect(fake).toHaveBeenCalledTimes(1));
    await db.accounts.add(account('a2', 'USD'));
    const second = refreshRates(TODAY, fake);
    release();

    expect(await first).toBe('updated');
    expect(await second).toBe('updated');
    expect(fake).toHaveBeenCalledTimes(2);
    expect((await loadRates()).USD?.perEur).toBe(1.1);
  });
});

describe('manual rates', () => {
  it('loadRates is empty without any rate', async () => {
    expect(await loadRates()).toEqual({});
  });

  it('loadRates returns the ECB rate when there is no manual one', async () => {
    await db.fxRates.put(ecb('INR', 95));

    expect((await loadRates()).INR).toEqual(ecb('INR', 95));
  });

  it('loadRates prefers the manual rate', async () => {
    await db.fxRates.bulkPut([ecb('INR', 95), manual('INR', 97)]);

    const rates = await loadRates();

    expect(rates.INR?.perEur).toBe(97);
    expect(rates.INR?.source).toBe('manual');
  });

  it('setManualRate writes only the manual row', async () => {
    await db.fxRates.put(ecb('INR', 95, YESTERDAY));

    await setManualRate('INR', 97, TODAY);

    expect(await db.fxRates.get(['INR', 'manual'])).toEqual(manual('INR', 97));
    expect(await db.fxRates.get(['INR', 'ecb'])).toEqual(ecb('INR', 95, YESTERDAY));
  });

  it('setManualRate replaces an earlier manual rate', async () => {
    await setManualRate('INR', 97, YESTERDAY);
    await setManualRate('INR', 98, TODAY);

    expect(await db.fxRates.toArray()).toEqual([manual('INR', 98)]);
  });

  it('setManualRate refuses a rate that is not a positive number', async () => {
    for (const bad of [0, -95, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(setManualRate('INR', bad, TODAY), String(bad)).rejects.toBeInstanceOf(RangeError);
    }

    expect(await db.fxRates.count()).toBe(0);
  });

  it('clearManualRate keeps the ECB rate', async () => {
    await db.fxRates.bulkPut([ecb('INR', 95), manual('INR', 97)]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await clearManualRate('INR');

    expect((await loadRates()).INR?.perEur).toBe(95);
    expect(await db.fxRates.get(['INR', 'manual'])).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('clearManualRate does nothing when there is no manual rate', async () => {
    await db.fxRates.put(ecb('INR', 95));

    await clearManualRate('INR');

    expect(await db.fxRates.toArray()).toEqual([ecb('INR', 95)]);
  });
});
