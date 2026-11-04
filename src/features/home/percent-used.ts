import type { Minor } from '@/lib/money';

/**
 * How full a bar or Home's ring is, 0 to 100: the share of the plan spent, stopping at full. A plan of €0 with
 * spending reads as full. The envelope bars and the month's ring share it, so a full ring and a full bar mean the same.
 */
export function percentUsed(plannedMinor: Minor, spentMinor: Minor): number {
  if (plannedMinor <= 0) return spentMinor > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((spentMinor / plannedMinor) * 100)));
}
