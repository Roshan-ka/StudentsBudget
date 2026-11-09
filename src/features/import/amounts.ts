import type { Minor } from '@/lib/money';

// Amounts as bank statements write them (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md): signed,
// with a decimal comma (`-1.234,56`, Sparkasse and DKB) or a decimal point (`-1234.56`, N26 and Revolut), sometimes with
// the currency (`-10,22 €`), a Unicode minus or the minus at the end (`12,34-`). The app's own `parseAmount` takes none of
// this: it reads what a person types, which is never negative.

export type DecimalMark = ',' | '.';

// Spaces of any kind (a no-break or a narrow no-break space between thousands), a currency's sign or code, and a plus.
const NOISE = /[\s  €$£¥₹₺+]|\b[A-Z]{3}\b/g;

/**
 * The amount in minor units, negative for money out, or null for text that isn't an amount. `decimal` says which mark
 * separates the cents; the other is read as a thousands separator. At most two decimals, unless the rest are zeros.
 */
export function parseStatementAmount(text: string, decimal: DecimalMark): Minor | null {
  let value = text.trim().replace(/[−–]/g, '-');
  let negative = false;
  if (value.startsWith('(') && value.endsWith(')')) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(NOISE, '');
  if (value.endsWith('-')) {
    negative = !negative;
    value = value.slice(0, -1);
  }
  if (value.startsWith('-')) {
    negative = !negative;
    value = value.slice(1);
  }
  const parts = value.split(decimal);
  if (parts.length > 2) return null;
  const [wholeText, fraction = ''] = parts;
  // Thousands separators only between groups of three digits: "1.234,56", never "1.2.3".
  const groups = wholeText.split(decimal === ',' ? '.' : ',');
  if (groups.length > 1 && (groups[0].length > 3 || groups.slice(1).some((group) => group.length !== 3))) return null;
  const whole = groups.join('');
  if (!/^\d+$/.test(whole) || (parts.length === 2 && !/^\d+$/.test(fraction))) return null;
  if (fraction.length > 2 && /[^0]/.test(fraction.slice(2))) return null;
  const minor = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) return null;
  // Never -0: a zero is a zero.
  return negative && minor !== 0 ? -minor : minor;
}

/**
 * The decimal mark a column of amounts uses, for a CSV the app doesn't know, or one a spreadsheet saved again in its own
 * format. A mark followed by exactly one or two digits at the end decides; `prefer` (the profile's or the region's)
 * settles anything else.
 */
export function guessDecimalMark(values: readonly string[], prefer: DecimalMark = ','): DecimalMark {
  let comma = 0;
  let point = 0;
  for (const raw of values) {
    const value = raw.replace(NOISE, '').replace(/-$/, '');
    if (/,\d{1,2}$/.test(value)) comma += 1;
    else if (/\.\d{1,2}$/.test(value)) point += 1;
  }
  if (comma === point) return prefer;
  return comma > point ? ',' : '.';
}
