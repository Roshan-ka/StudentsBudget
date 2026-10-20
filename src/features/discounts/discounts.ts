import { DISCOUNTS, type Discount } from '@/data/discounts';
import type { DiscountVote } from '@/db/types';
import { orderOf } from '@/features/entries/categories';
import { daysBetween, type IsoDate } from '@/lib/dates';

/** Where the discount list comes from: bundled with the app now, a server later. A view keeps one for its lifetime. */
export interface DiscountSource {
  list(): Promise<Discount[]>;
}

/** The discounts seeded in `src/data/discounts.ts`, as copies a caller may change. */
export const bundledDiscounts: DiscountSource = {
  list: () => Promise.resolve(DISCOUNTS.map((d) => ({ ...d }))),
};

/** Eight weeks: a discount nobody has confirmed for this long may be outdated (Concept §11). */
export const STALE_AFTER_DAYS = 56;

/**
 * `lastConfirmed` is the later of the source check and a "still works" vote. `outdated` means you said it doesn't
 * work anymore; `mayBeOutdated` that nobody has confirmed it for 8 weeks. The two never hold at once.
 */
export type Freshness = { lastConfirmed: IsoDate; outdated: boolean; mayBeOutdated: boolean };

export type DiscountRow = { discount: Discount; vote: DiscountVote | undefined; freshness: Freshness };

/**
 * How fresh a discount is on `today`. A "doesn't work anymore" vote confirms nothing, so it leaves the date alone.
 * A vote dated after today (a phone clock that ran ahead) counts as today's.
 */
export function freshness(d: Discount, vote: DiscountVote | undefined, today: IsoDate): Freshness {
  // IsoDate strings compare in date order.
  const votedOn = vote?.vote === 'works' ? (vote.on > today ? today : vote.on) : null;
  const lastConfirmed = votedOn !== null && votedOn > d.checked ? votedOn : d.checked;
  const outdated = vote?.vote === 'outdated';
  return { lastConfirmed, outdated, mayBeOutdated: !outdated && daysBetween(lastConfirmed, today) >= STALE_AFTER_DAYS };
}

/** 0 for fresh, 1 for may be outdated, 2 for marked as not working: the order the list sinks them in. */
function rank(f: Freshness): number {
  if (f.outdated) return 2;
  return f.mayBeOutdated ? 1 : 0;
}

/**
 * The discounts in the order the list shows them, each with its vote and freshness: fresh ones first, then the
 * ones that may be outdated, then the ones you marked as not working. Within each, the most recently confirmed
 * comes first; ties keep category order, then the order they were written in. Votes for discounts no longer
 * listed are ignored.
 */
export function sortByFreshness(
  discounts: readonly Discount[],
  votes: readonly DiscountVote[],
  today: IsoDate,
): DiscountRow[] {
  const byId = new Map(votes.map((v) => [v.discountId, v]));
  return discounts
    .map((discount) => {
      const vote = byId.get(discount.id);
      return { discount, vote, freshness: freshness(discount, vote, today) };
    })
    .sort(
      (a, b) =>
        rank(a.freshness) - rank(b.freshness) ||
        b.freshness.lastConfirmed.localeCompare(a.freshness.lastConfirmed) ||
        orderOf(a.discount.categoryId) - orderOf(b.discount.categoryId),
    );
}

/** The categories that have at least one discount, in the app's category order: the chips. */
export function discountCategoryIds(discounts: readonly Discount[]): string[] {
  return [...new Set(discounts.map((d) => d.categoryId))].sort((a, b) => orderOf(a) - orderOf(b));
}
