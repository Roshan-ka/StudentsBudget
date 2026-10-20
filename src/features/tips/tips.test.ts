import { describe, expect, it } from 'vitest';
import type { Tip } from '@/data/tips';
import { sortTips, tipCategoryIds, tipChipIds, tipTag } from './tips';

function tip(id: string, categoryId: string, source = 'A page'): Tip {
  return { id, title: id, body: id, categoryId, source, url: 'https://example.org', checked: '2026-10-20' };
}

describe('sortTips', () => {
  it('puts the tips in category order and keeps the written order within a category', () => {
    const tips = [tip('bike', 'transport'), tip('mensa', 'food'), tip('ticket', 'transport'), tip('shop', 'food')];
    expect(sortTips(tips).map((t) => t.id)).toEqual(['mensa', 'shop', 'bike', 'ticket']);
  });

  it('leaves the input untouched', () => {
    const tips = [tip('bike', 'transport'), tip('mensa', 'food')];
    sortTips(tips);
    expect(tips.map((t) => t.id)).toEqual(['bike', 'mensa']);
  });
});

describe('tipCategoryIds', () => {
  it('lists each category with tips once, in category order', () => {
    const tips = [tip('a', 'study'), tip('b', 'food'), tip('c', 'study'), tip('d', 'rent')];
    expect(tipCategoryIds(tips)).toEqual(['food', 'study', 'rent']);
  });
});

describe('tipChipIds', () => {
  it('puts the original six up front and the other categories behind More', () => {
    const tips = [tip('a', 'rent'), tip('b', 'study'), tip('c', 'food'), tip('d', 'other'), tip('e', 'food')];
    expect(tipChipIds(tips)).toEqual({ main: ['food', 'other'], more: ['study', 'rent'] });
  });
});

describe('tipTag', () => {
  it('names the category', () => {
    expect(tipTag(tip('mensa', 'food'))).toBe('Food & groceries');
  });

  it('says when the number is an estimate', () => {
    expect(tipTag(tip('cinema', 'going-out', 'Estimate'))).toBe('Going out · Estimate');
  });
});
