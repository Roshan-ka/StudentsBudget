import { formatMoney, type Minor } from '@/lib/money';

/**
 * An amount for the week lines ("€42 left this week", "€12 over this week"): whole euros, except that a
 * non-zero amount under 50 cents would round to €0 and keeps its cents instead ("€0.40"). Exactly zero
 * stays "€0". `text` is the absolute value; `over` says whether the amount is negative.
 */
export function formatWeekAmount(minor: Minor): { text: string; over: boolean } {
  const absolute = Math.abs(minor);
  const wouldRoundToZero = absolute > 0 && absolute < 50;
  return { text: formatMoney(absolute, 'EUR', wouldRoundToZero ? undefined : { whole: true }), over: minor < 0 };
}
