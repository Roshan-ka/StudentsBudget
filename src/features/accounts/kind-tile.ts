import { BanknoteIcon, LandmarkIcon, type LucideIcon } from 'lucide-react';
import type { Account } from '@/db/types';
import { categoryTint } from '@/features/charts/colors';

/**
 * An account kind's tile: a bank in blue, cash in green, as in the mockups (13-11-2026). Two category tints, for their
 * colour. Setup's account cards and Settings → Accounts and transfers both show it.
 */
export const KIND_TILE: Record<Account['kind'], { icon: LucideIcon; tint: string }> = {
  bank: { icon: LandmarkIcon, tint: categoryTint('rent') },
  cash: { icon: BanknoteIcon, tint: categoryTint('eating-out') },
};
