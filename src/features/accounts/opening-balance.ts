import { parseAmount, type Minor } from '@/lib/money';

/** Zero in any spelling: "0", "00", "0.0", "0,00". */
const ZERO_TEXT = /^0+(?:[.,]0{1,2})?$/;

/**
 * Parses an amount field where nothing means nothing: empty or zero gives 0 (so a new cash wallet,
 * a zero envelope or an unused income source is valid); anything else must be a positive amount.
 * Returns null for text that is not an amount.
 */
export function parseOptionalAmount(text: string): Minor | null {
  const trimmed = text.trim();
  if (trimmed === '' || ZERO_TEXT.test(trimmed)) return 0;
  return parseAmount(trimmed);
}

// A hyphen, or the typographic minus some keyboards put in its place.
const MINUS = /^[-−]/;

/** Whether the text starts with a minus sign. */
export function isNegativeText(text: string): boolean {
  return MINUS.test(text.trim());
}

/**
 * Parses an opening balance, the one amount that may be below zero: `parseOptionalAmount`, with an optional minus
 * sign in front ("-250"). A minus needs an amount behind it, and "-0" is 0. Returns null for text that is not one.
 */
export function parseSignedAmount(text: string): Minor | null {
  const trimmed = text.trim();
  if (!MINUS.test(trimmed)) return parseOptionalAmount(trimmed);
  const rest = trimmed.slice(1).trim();
  if (rest === '') return null;
  const magnitude = parseOptionalAmount(rest);
  if (magnitude === null) return null;
  return magnitude === 0 ? 0 : -magnitude;
}

/**
 * The text of an opening balance next to its "Overdrawn" checkbox. The sign lives in the text, as a leading "-", so a
 * typed "-250" and a ticked box say the same thing. `waiting` is a tick made while the field was still empty: there
 * is nothing to put a sign on yet, so the box stays ticked and the first thing typed takes the sign.
 */
export type OpeningText = { text: string; waiting: boolean };

/**
 * The box was ticked or cleared. A bare 0 is no amount to put a minus on ("-0" is not a balance), so it waits like an
 * empty field: the 0 goes, and the first thing typed takes the sign.
 */
export function tickOverdrawn(text: string, checked: boolean): OpeningText {
  const bare = text.trim().replace(MINUS, '').trim();
  if (!checked) return { text: bare, waiting: false };
  return bare === '' || ZERO_TEXT.test(bare) ? { text: '', waiting: true } : { text: `-${bare}`, waiting: false };
}

/** The field was typed in. A tick that was waiting for an amount puts its minus in front of what was typed. */
export function typeOpening(typed: string, waiting: boolean): OpeningText {
  if (!waiting || typed.trim() === '') return { text: typed, waiting };
  return { text: isNegativeText(typed) ? typed : `-${typed.trim()}`, waiting: false };
}

/** Whether the box shows ticked: a minus in the text, or a tick still waiting for an amount. */
export function isOverdrawn(text: string, waiting: boolean): boolean {
  return waiting || isNegativeText(text);
}
