import { describe, expect, it } from 'vitest';
import { CATEGORIES, GUESS_CATEGORY_IDS } from './categories';

const idsOf = (kind: string) => CATEGORIES.filter((c) => c.kind === kind).map((c) => c.id);

describe('CATEGORIES', () => {
  it('has 26 built-in categories with unique ids', () => {
    expect(CATEGORIES).toHaveLength(26);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(26);
  });

  it('numbers each category by its position in the list', () => {
    expect(CATEGORIES.map((c) => c.order)).toEqual(CATEGORIES.map((_, index) => index));
  });

  it('puts the new flexible categories between Shopping and Other, so Other stays last', () => {
    expect(idsOf('flexible')).toEqual([
      'food',
      'eating-out',
      'going-out',
      'transport',
      'shopping',
      'health',
      'personal-care',
      'study',
      'household',
      'travel',
      'gifts',
      'other',
    ]);
  });

  it('puts the new fixed categories after the Deutschlandticket', () => {
    expect(idsOf('fixed')).toEqual(['rent', 'phone', 'insurance', 'subscriptions', 'transport-pass', 'gym', 'utilities']);
  });

  it('names the new categories', () => {
    const name = (id: string) => CATEGORIES.find((c) => c.id === id)?.name;
    expect(name('health')).toBe('Health & pharmacy');
    expect(name('personal-care')).toBe('Personal care');
    expect(name('study')).toBe('Study materials');
    expect(name('household')).toBe('Household');
    expect(name('travel')).toBe('Travel');
    expect(name('gifts')).toBe('Gifts');
    expect(name('gym')).toBe('Gym & sports');
    expect(name('utilities')).toBe('Utilities & Rundfunkbeitrag');
  });
});

describe('GUESS_CATEGORY_IDS', () => {
  it('are the six categories of the first version, all flexible', () => {
    expect(GUESS_CATEGORY_IDS).toEqual(['food', 'eating-out', 'going-out', 'transport', 'shopping', 'other']);
    for (const id of GUESS_CATEGORY_IDS) expect(idsOf('flexible')).toContain(id);
  });
});
