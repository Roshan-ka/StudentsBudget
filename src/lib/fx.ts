import type { Rate } from '@/db/types';
import type { IsoDate } from './dates';
import { CURRENCIES, type CurrencyCode, type Minor } from './money';

/** One rate per currency, as `loadRates` returns it. EUR never has one. */
export type RateMap = Partial<Record<CurrencyCode, Rate>>;

// Frankfurter's v2 "rates" endpoint answers with the latest rates when `date` is left out. It blends many
// providers unless `providers=ecb` is set, which keeps "ECB" true. v1 is deprecated, but it still runs.
const RATES_URL = 'https://api.frankfurter.dev/v2/rates';
const FETCH_TIMEOUT_MS = 10_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Converts an amount to EUR minor units, rounded to the nearest cent. Null when the currency has no rate. */
export function toEurMinor(amount: Minor, c: CurrencyCode, rates: RateMap): Minor | null {
  if (c === 'EUR') return amount;
  const rate = rates[c];
  if (!rate) return null;
  const eur = Math.round(amount / rate.perEur);
  // A small negative amount rounds to -0, which Object.is and the formatter tell apart from 0.
  return eur === 0 ? 0 : eur;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currencyOf(value: unknown): CurrencyCode | undefined {
  return CURRENCIES.find((c) => c === value);
}

/**
 * Fetches today's ECB rates (units of each currency per 1 EUR) from Frankfurter.
 * Requested currencies missing from the response are left out of `perEur`.
 * Throws on a network error, a non-OK status, a response of the wrong shape, and an empty response (it
 * has no rate date). The rate date is the newest row date; the ECB rows share one.
 */
export async function fetchEcbRates(
  symbols: CurrencyCode[],
  fetchFn: typeof fetch = fetch,
): Promise<{ rateDate: IsoDate; perEur: Partial<Record<CurrencyCode, number>> }> {
  const response = await fetchFn(`${RATES_URL}?base=EUR&quotes=${symbols.join(',')}&providers=ecb`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Frankfurter responded with status ${response.status}`);

  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error('Frankfurter sent a response in an unexpected shape');
  if (body.length === 0) throw new Error('Frankfurter sent no rates');

  const perEur: Partial<Record<CurrencyCode, number>> = {};
  let rateDate: IsoDate = '';
  for (const row of body as unknown[]) {
    if (!isRecord(row) || row.base !== 'EUR' || typeof row.date !== 'string' || !ISO_DATE.test(row.date)) {
      throw new Error('Frankfurter sent a response in an unexpected shape');
    }
    const quote = currencyOf(row.quote);
    if (quote === undefined) throw new Error('Frankfurter sent a response in an unexpected shape');
    if (typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) {
      throw new Error(`Frankfurter sent an unusable ${quote} rate`);
    }
    // ISO dates sort as text, and the list is not empty, so this ends on the newest row's date.
    if (row.date > rateDate) rateDate = row.date;
    if (symbols.includes(quote)) perEur[quote] = row.rate;
  }
  return { rateDate, perEur };
}
