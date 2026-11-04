import { DISCOUNTS, type Discount } from '@/data/discounts';
import type { DiscountVote } from '@/db/types';
import { orderOf } from '@/features/entries/categories';
import { daysBetween, type IsoDate } from '@/lib/dates';
import type { CommunityConfirmations, CommunityEntry } from './community';

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
 * `lastConfirmed` is the latest of the source check, your "still works" vote and anyone's (P2.6). `outdated` means
 * you said it doesn't work anymore; `mayBeOutdated` that nobody has confirmed it for 8 weeks. The two never hold at
 * once.
 */
export type Freshness = { lastConfirmed: IsoDate; outdated: boolean; mayBeOutdated: boolean };

/** A discount as the list shows it: your vote, other students' totals when read (P2.6), and how fresh it is. */
export type DiscountRow = {
  discount: Discount;
  vote: DiscountVote | undefined;
  community: CommunityEntry | undefined;
  freshness: Freshness;
};

/**
 * How fresh a discount is on `today`. A "doesn't work anymore" vote confirms nothing, so it leaves the date alone.
 * A vote dated after today (a phone clock that ran ahead) counts as today's. `community` is other students' totals
 * (P2.6): their latest "still works" confirms it too, while their "doesn't work anymore" only shows as a count.
 */
export function freshness(
  d: Discount,
  vote: DiscountVote | undefined,
  today: IsoDate,
  community?: CommunityEntry,
): Freshness {
  // IsoDate strings compare in date order.
  const latest = (a: IsoDate, b: IsoDate | null) => (b !== null && b > a ? b : a);
  const votedOn = vote?.vote === 'works' ? (vote.on > today ? today : vote.on) : null;
  const others = community?.lastWorks ?? null;
  const othersOn = others !== null && others > today ? today : others;
  const lastConfirmed = latest(latest(d.checked, votedOn), othersOn);
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
 * listed are ignored. `community`, when read, is other students' totals (P2.6).
 */
export function sortByFreshness(
  discounts: readonly Discount[],
  votes: readonly DiscountVote[],
  today: IsoDate,
  community?: CommunityConfirmations | null,
): DiscountRow[] {
  const byId = new Map(votes.map((v) => [v.discountId, v]));
  return discounts
    .map((discount) => {
      const vote = byId.get(discount.id);
      const others = community?.get(discount.id);
      return { discount, vote, community: others, freshness: freshness(discount, vote, today, others) };
    })
    .sort(
      (a, b) =>
        rank(a.freshness) - rank(b.freshness) ||
        b.freshness.lastConfirmed.localeCompare(a.freshness.lastConfirmed) ||
        orderOf(a.discount.categoryId) - orderOf(b.discount.categoryId),
    );
}

/**
 * Which way `vote` moves its discount in `shown`, the list as it is on screen: 'up', 'down', or null when it stays
 * where it is (a confirmation on the day the list was checked, or a discount already at the top or the bottom).
 */
export function voteMove(
  shown: readonly Discount[],
  votes: readonly DiscountVote[],
  vote: DiscountVote,
  today: IsoDate,
  community?: CommunityConfirmations | null,
): 'up' | 'down' | null {
  const indexIn = (rows: DiscountRow[]) => rows.findIndex((row) => row.discount.id === vote.discountId);
  const before = indexIn(sortByFreshness(shown, votes, today, community));
  const after = indexIn(
    sortByFreshness(shown, [...votes.filter((v) => v.discountId !== vote.discountId), vote], today, community),
  );
  if (after === before) return null;
  return after < before ? 'up' : 'down';
}

/** The categories that have at least one discount, in the app's category order: the chips. */
export function discountCategoryIds(discounts: readonly Discount[]): string[] {
  return [...new Set(discounts.map((d) => d.categoryId))].sort((a, b) => orderOf(a) - orderOf(b));
}
