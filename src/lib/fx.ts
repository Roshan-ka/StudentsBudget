import type { Rate } from '@/db/types';
import type { IsoDate } from './dates';
import type { CurrencyCode, Minor } from './money';

/** One rate per currency, as `loadRates` returns it. EUR never has one. */
export type RateMap = Partial<Record<CurrencyCode, Rate>>;

// Frankfurter's v1 "latest" endpoint serves the ECB reference rates. Its docs mark v1 as deprecated
// in favour of v2 but keep it running; v2 blends providers unless `providers=ecb` is set.
const LATEST_URL = 'https://api.frankfurter.dev/v1/latest';
const FETCH_TIMEOUT_MS = 10_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Converts an amount to EUR minor units, rounded to the nearest cent. Null when the currency has no rate. */
export function toEurMinor(amount: Minor, c: CurrencyCode, rates: RateMap): Minor | null {
  if (c === 'EUR') return amount;
  const rate = rates[c];
  if (!rate) return null;
  return Math.round(amount / rate.perEur);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fetches today's ECB rates (units of each currency per 1 EUR) from Frankfurter.
 * Requested currencies missing from the response are left out of `perEur`.
 * Throws on a network error, a non-OK status and a response of the wrong shape.
 */
export async function fetchEcbRates(
  symbols: CurrencyCode[],
  fetchFn: typeof fetch = fetch,
): Promise<{ rateDate: IsoDate; perEur: Partial<Record<CurrencyCode, number>> }> {
  const response = await fetchFn(`${LATEST_URL}?base=EUR&symbols=${symbols.join(',')}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Frankfurter responded with status ${response.status}`);

  const body: unknown = await response.json();
  if (
    !isRecord(body) ||
    body.base !== 'EUR' ||
    typeof body.date !== 'string' ||
    !ISO_DATE.test(body.date) ||
    !isRecord(body.rates)
  ) {
    throw new Error('Frankfurter sent a response in an unexpected shape');
  }

  const perEur: Partial<Record<CurrencyCode, number>> = {};
  for (const symbol of symbols) {
    const value = body.rates[symbol];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`Frankfurter sent an unusable ${symbol} rate`);
    }
    perEur[symbol] = value;
  }
  return { rateDate: body.date, perEur };
}
