/** Integer minor units (cents, paise). Money is never held as a float. */
export type Minor = number;

export type CurrencyCode = 'EUR' | 'INR' | 'USD' | 'GBP' | 'CHF' | 'CNY' | 'TRY';

export const CURRENCIES: CurrencyCode[] = ['EUR', 'INR', 'USD', 'GBP', 'CHF', 'CNY', 'TRY'];

// English's, the default. Callers pass the phone's locale (useT().locale); this file imports nothing from the app,
// because the MCP server loads it before the app's imports work.
const DEFAULT_LOCALE = 'en-IE';

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

function currencyFormatter(currency: CurrencyCode, whole: boolean, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}:${whole}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * "€6.50", or "€63" with `{ whole: true }`, in English; another `locale` formats its own way ("6,50 €"). A whole
 * figure that rounds to nothing is "€0", never "-€0": a few cents overdrawn would otherwise read as a minus sign in
 * front of zero. (`signDisplay` would do it, but an older Safari throws.)
 */
export function formatMoney(m: Minor, c: CurrencyCode, o?: { whole?: boolean; locale?: string }): string {
  const whole = o?.whole ?? false;
  const major = m / 100;
  // Below half a unit either way rounds to nothing; ±0.50 rounds away from zero, as Intl does, so both signs match.
  return currencyFormatter(c, whole, o?.locale ?? DEFAULT_LOCALE).format(whole && Math.abs(major) < 0.5 ? 0 : major);
}

const wholeNumberFormatters = new Map<string, Intl.NumberFormat>();

function wholeNumberFormatter(locale: string): Intl.NumberFormat {
  let formatter = wholeNumberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    wholeNumberFormatters.set(locale, formatter);
  }
  return formatter;
}

/** Whether the locale writes the currency sign before the number ("€63") rather than after it ("63 €"). */
function signFirst(locale: string): boolean {
  const parts = currencyFormatter('EUR', true, locale).formatToParts(1);
  return parts.findIndex((p) => p.type === 'currency') < parts.findIndex((p) => p.type === 'integer');
}

/**
 * EUR range in whole euros, with the euro sign once, where the locale puts it: "€200–260" in English, "200–260 €" in
 * German.
 */
export function formatRange(minM: Minor, maxM: Minor, locale: string = DEFAULT_LOCALE): string {
  if (signFirst(locale)) {
    return `${formatMoney(minM, 'EUR', { whole: true, locale })}–${wholeNumberFormatter(locale).format(maxM / 100)}`;
  }
  return `${wholeNumberFormatter(locale).format(minM / 100)}–${formatMoney(maxM, 'EUR', { whole: true, locale })}`;
}
