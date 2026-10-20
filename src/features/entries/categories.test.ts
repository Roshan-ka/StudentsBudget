import { describe, expect, it } from 'vitest';
import { FLEXIBLE_CATEGORIES, GUESS_CATEGORIES, categoryName, orderOf } from './categories';

describe('orderOf', () => {
  it('follows the built-in list', () => {
    expect(orderOf('food')).toBe(0);
    expect(orderOf('eating-out')).toBe(1);
    expect(orderOf('food')).toBeLessThan(orderOf('rent'));
  });

  it('puts the new flexible categories before Other, and the new fixed ones after the ticket', () => {
    expect(orderOf('shopping')).toBeLessThan(orderOf('health'));
    expect(orderOf('gifts')).toBeLessThan(orderOf('other'));
    expect(orderOf('transport-pass')).toBeLessThan(orderOf('gym'));
    expect(orderOf('utilities')).toBeLessThan(orderOf('one-off'));
  });

  it('puts a category that is not built in last', () => {
    expect(orderOf('gone')).toBeGreaterThan(orderOf('income-other'));
  });
});

describe('GUESS_CATEGORIES', () => {
  it('are the six categories people guess, a part of the flexible ones', () => {
    expect(GUESS_CATEGORIES.map((c) => c.id)).toEqual([
      'food',
      'eating-out',
      'going-out',
      'transport',
      'shopping',
      'other',
    ]);
    expect(FLEXIBLE_CATEGORIES).toHaveLength(12);
    for (const c of GUESS_CATEGORIES) expect(FLEXIBLE_CATEGORIES).toContainEqual(c);
  });
});

describe('categoryName', () => {
  it('names a built-in category and falls back to the id', () => {
    expect(categoryName('eating-out')).toBe('Eating out');
    expect(categoryName('health')).toBe('Health & pharmacy');
    expect(categoryName('utilities')).toBe('Utilities & Rundfunkbeitrag');
    expect(categoryName('gone')).toBe('gone');
  });
});
