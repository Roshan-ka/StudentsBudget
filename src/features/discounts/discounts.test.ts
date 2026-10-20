import { describe, expect, it } from 'vitest';
import type { Discount } from '@/data/discounts';
import { DISCOUNTS } from '@/data/discounts';
import type { DiscountVote } from '@/db/types';
import { bundledDiscounts, discountCategoryIds, freshness, sortByFreshness } from './discounts';

function discount(id: string, overrides: Partial<Discount> = {}): Discount {
  return {
    id,
    place: id,
    address: 'Domplatz 1, 93047 Regensburg',
    offer: 'Free entry',
    conditions: 'Students with ID',
    categoryId: 'going-out',
    source: 'A page',
    url: 'https://example.org',
    checked: '2026-10-20',
    ...overrides,
  };
}

function vote(discountId: string, kind: DiscountVote['vote'], on: string): DiscountVote {
  return { discountId, vote: kind, on };
}

describe('bundledDiscounts', () => {
  it('lists the seeded discounts', async () => {
    expect(await bundledDiscounts.list()).toEqual(DISCOUNTS);
  });

  it('hands out copies, so a caller cannot change the seeded list or its entries', async () => {
    const list = await bundledDiscounts.list();
    const offer = DISCOUNTS[0].offer;
    list[0].offer = 'changed';
    list.pop();
    expect(await bundledDiscounts.list()).toHaveLength(DISCOUNTS.length);
    expect(DISCOUNTS[0].offer).toBe(offer);
  });
});

describe('freshness', () => {
  it('without a vote, the checked date is the last confirmation', () => {
    expect(freshness(discount('a'), undefined, '2026-11-01')).toEqual({
      lastConfirmed: '2026-10-20',
      outdated: false,
      mayBeOutdated: false,
    });
  });

  it('may be outdated once nobody has confirmed it for 8 weeks, and not a day before', () => {
    // 2026-12-14 is 55 days after the check, 2026-12-15 is 56: eight whole weeks.
    expect(freshness(discount('a'), undefined, '2026-12-14').mayBeOutdated).toBe(false);
    expect(freshness(discount('a'), undefined, '2026-12-15').mayBeOutdated).toBe(true);
  });

  it('a "still works" vote after the check is the last confirmation, and restarts the 8 weeks', () => {
    const works = vote('a', 'works', '2026-12-01');
    expect(freshness(discount('a'), works, '2026-12-20')).toEqual({
      lastConfirmed: '2026-12-01',
      outdated: false,
      mayBeOutdated: false,
    });
    expect(freshness(discount('a'), works, '2027-01-26').mayBeOutdated).toBe(true);
  });

  it('a "still works" vote from before a newer check leaves the check as the last confirmation', () => {
    const d = discount('a', { checked: '2027-01-10' });
    expect(freshness(d, vote('a', 'works', '2026-12-01'), '2027-01-20').lastConfirmed).toBe('2027-01-10');
  });

  it('a "still works" vote dated after today (a clock that ran ahead) counts as today\'s', () => {
    const ahead = vote('a', 'works', '2027-03-01');
    expect(freshness(discount('a'), ahead, '2026-11-02').lastConfirmed).toBe('2026-11-02');
    expect(freshness(discount('a'), ahead, '2026-12-28').mayBeOutdated).toBe(false);
  });

  it('a "doesn\'t work anymore" vote marks it outdated and confirms nothing', () => {
    expect(freshness(discount('a'), vote('a', 'outdated', '2026-11-05'), '2026-11-06')).toEqual({
      lastConfirmed: '2026-10-20',
      outdated: true,
      mayBeOutdated: false,
    });
  });

  it('an outdated vote stays outdated however long ago it was, rather than "may be outdated"', () => {
    const f = freshness(discount('a'), vote('a', 'outdated', '2026-11-05'), '2027-06-01');
    expect(f.outdated).toBe(true);
    expect(f.mayBeOutdated).toBe(false);
  });
});

describe('sortByFreshness', () => {
  const today = '2026-11-02';

  it('keeps category order, then the written order, while every entry was confirmed on the same day', () => {
    const list = [
      discount('cinema', { categoryId: 'going-out' }),
      discount('cafe', { categoryId: 'eating-out' }),
      discount('theatre', { categoryId: 'going-out' }),
    ];
    expect(sortByFreshness(list, [], today).map((row) => row.discount.id)).toEqual(['cafe', 'cinema', 'theatre']);
  });

  it('puts the most recently confirmed first', () => {
    const list = [discount('a'), discount('b'), discount('c')];
    const votes = [vote('c', 'works', '2026-11-02'), vote('b', 'works', '2026-10-30')];
    expect(sortByFreshness(list, votes, today).map((row) => row.discount.id)).toEqual(['c', 'b', 'a']);
  });

  it('sinks what may be outdated below the fresh ones, and what you marked as not working to the very end', () => {
    const list = [
      discount('marked', { checked: '2026-11-01' }),
      discount('old', { checked: '2026-08-01' }),
      discount('fresh', { checked: '2026-10-01' }),
    ];
    const rows = sortByFreshness(list, [vote('marked', 'outdated', '2026-11-02')], today);
    expect(rows.map((row) => row.discount.id)).toEqual(['fresh', 'old', 'marked']);
    expect(rows.map((row) => [row.freshness.mayBeOutdated, row.freshness.outdated])).toEqual([
      [false, false],
      [true, false],
      [false, true],
    ]);
  });

  it('a confirmation lifts an entry that may be outdated back to the top', () => {
    const list = [discount('a'), discount('b')];
    const rows = sortByFreshness(list, [vote('b', 'works', '2026-12-20')], '2026-12-20');
    expect(rows.map((row) => row.discount.id)).toEqual(['b', 'a']);
    expect(rows[0].freshness.mayBeOutdated).toBe(false);
    expect(rows[1].freshness.mayBeOutdated).toBe(true);
  });

  it('pairs each entry with its vote and ignores votes for discounts no longer listed', () => {
    const works = vote('a', 'works', '2026-11-01');
    const rows = sortByFreshness([discount('a'), discount('b')], [works, vote('gone', 'works', '2026-11-01')], today);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.discount.id === 'a')?.vote).toEqual(works);
    expect(rows.find((row) => row.discount.id === 'b')?.vote).toBeUndefined();
  });

  it('leaves the input untouched', () => {
    const list = [discount('b', { categoryId: 'going-out' }), discount('a', { categoryId: 'eating-out' })];
    sortByFreshness(list, [], today);
    expect(list.map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('discountCategoryIds', () => {
  it('lists each category with a discount once, in category order', () => {
    const list = [
      discount('a', { categoryId: 'going-out' }),
      discount('b', { categoryId: 'eating-out' }),
      discount('c', { categoryId: 'going-out' }),
      discount('d', { categoryId: 'gym' }),
    ];
    expect(discountCategoryIds(list)).toEqual(['eating-out', 'going-out', 'gym']);
  });
});
