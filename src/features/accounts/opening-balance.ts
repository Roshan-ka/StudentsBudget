import { parseAmount, type Minor } from '@/lib/money';

/**
 * Parses an amount field where nothing means nothing: empty or zero gives 0 (so a new cash wallet,
 * a zero envelope or an unused income source is valid); anything else must be a positive amount.
 * Returns null for text that is not an amount.
 */
export function parseOpeningBalance(text: string): Minor | null {
  const trimmed = text.trim();
  if (trimmed === '' || /^0+(?:[.,]0{1,2})?$/.test(trimmed)) return 0;
  return parseAmount(trimmed);
}
