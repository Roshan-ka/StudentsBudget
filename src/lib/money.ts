/** Integer minor units (cents, paise). Money is never held as a float. */
export type Minor = number;

export type CurrencyCode = 'EUR' | 'INR' | 'USD' | 'GBP' | 'CHF' | 'CNY' | 'TRY';

export const CURRENCIES: CurrencyCode[] = ['EUR', 'INR', 'USD', 'GBP', 'CHF', 'CNY', 'TRY'];

const LOCALE = 'en-IE';

// Digits with an optional ',' or '.' decimal part of one or two digits.
const AMOUNT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

/**
 * Parses what a person types ("6", "6,50", "6.5") into minor units.
 * Returns null unless the amount is greater than zero with at most two decimals.
 */
export function parseAmount(text: string): Minor | null {
  const trimmed = text.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const minor = Math.round(Number(trimmed.replace(',', '.')) * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: CurrencyCode, whole: boolean): Intl.NumberFormat {
  const key = `${currency}:${whole}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * "€6.50", or "€63" with `{ whole: true }`. A whole figure that rounds to nothing is "€0", never "-€0": a few cents
 * overdrawn would otherwise read as a minus sign in front of zero. (`signDisplay` would do it, but an older Safari throws.)
 */
export function formatMoney(m: Minor, c: CurrencyCode, o?: { whole?: boolean }): string {
  const whole = o?.whole ?? false;
  const major = m / 100;
  // Below half a unit either way rounds to nothing; ±0.50 rounds away from zero, as Intl does, so both signs match.
  return currencyFormatter(c, whole).format(whole && Math.abs(major) < 0.5 ? 0 : major);
}

const wholeNumberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** EUR range in whole euros, euro sign on the first number only: "€200–260". */
export function formatRange(minM: Minor, maxM: Minor): string {
  return `${formatMoney(minM, 'EUR', { whole: true })}–${wholeNumberFormatter.format(maxM / 100)}`;
}
