import type { IsoDate } from '@/lib/dates';
import { fetchEcbRates, type RateMap } from '@/lib/fx';
import { CURRENCIES, type CurrencyCode } from '@/lib/money';
import { db } from './db';
import type { Rate } from './types';

type RefreshResult = 'updated' | 'fresh' | 'failed' | 'none-needed';

// Refreshes run one after another. A call that overlaps another one waits for it, then looks at the
// stored rows again, so it fetches nothing the first call already stored and still sees accounts
// added in between.
let queue: Promise<unknown> = Promise.resolve();

async function foreignCurrenciesInUse(): Promise<CurrencyCode[]> {
  const used = new Set((await db.accounts.toArray()).map((account) => account.currency));
  return CURRENCIES.filter((c) => c !== 'EUR' && used.has(c));
}

async function refresh(today: IsoDate, fetchFn?: typeof fetch): Promise<RefreshResult> {
  const needed = await foreignCurrenciesInUse();
  if (needed.length === 0) return 'none-needed';

  const stored = await db.fxRates.bulkGet(needed.map((c): [CurrencyCode, Rate['source']] => [c, 'ecb']));
  if (stored.every((row) => row?.fetchedOn === today)) return 'fresh';

  try {
    const { rateDate, perEur } = await fetchEcbRates(needed, fetchFn);
    const rows = needed.flatMap((currency): Rate[] => {
      const rate = perEur[currency];
      return rate === undefined ? [] : [{ currency, perEur: rate, rateDate, fetchedOn: today, source: 'ecb' }];
    });
    if (rows.length === 0) return 'failed';
    // Only ECB rows are written, so a manual rate for the same currency is never touched.
    await db.fxRates.bulkPut(rows);
    return 'updated';
  } catch (error) {
    console.error('StudentsBudget: could not refresh the exchange rates', error);
    return 'failed';
  }
}

/**
 * Fetches the ECB rate of every foreign currency an account uses, at most once a day.
 * Resolves 'failed' (and keeps the stored rates) when the fetch or its response is unusable.
 * Manual rates are never overwritten.
 */
export function refreshRates(today: IsoDate, fetchFn?: typeof fetch): Promise<RefreshResult> {
  const run = queue.then(() => refresh(today, fetchFn));
  queue = run.catch(() => undefined);
  return run;
}

/** One rate per currency; a manual rate wins over the ECB one. */
export async function loadRates(): Promise<RateMap> {
  const rows = await db.fxRates.toArray();
  const rates: RateMap = {};
  for (const row of rows) if (row.source === 'ecb') rates[row.currency] = row;
  for (const row of rows) if (row.source === 'manual') rates[row.currency] = row;
  return rates;
}

/** Saves the rate the person typed. The ECB row of the same currency is left alone. */
export async function setManualRate(c: CurrencyCode, perEur: number, today: IsoDate): Promise<void> {
  if (!Number.isFinite(perEur) || perEur <= 0) throw new RangeError('A rate must be a number greater than zero.');
  await db.fxRates.put({ currency: c, perEur, rateDate: today, fetchedOn: today, source: 'manual' });
}

/** Removes the manual rate only; the stored ECB rate takes over again. */
export async function clearManualRate(c: CurrencyCode): Promise<void> {
  await db.fxRates.delete([c, 'manual']);
}
