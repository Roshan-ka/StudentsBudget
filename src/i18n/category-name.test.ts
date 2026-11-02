import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { categoryNameIn } from './category-name';
import { MESSAGES } from './messages';

describe('category names in the dictionaries', () => {
  it('names every built-in category in English exactly as the data does', () => {
    expect(MESSAGES.en.categories).toEqual(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name])));
  });

  it('gives a category that isn’t built in its id, as categoryName does', () => {
    expect(categoryNameIn(MESSAGES.en, 'eating-out')).toBe('Eating out');
    expect(categoryNameIn(MESSAGES.en, 'my-own')).toBe('my-own');
  });
});

describe('the Home dictionary', () => {
  it('says which rates are missing, one or more', () => {
    expect(MESSAGES.en.home.missingRates('INR', 1)).toBe('INR rate missing');
    expect(MESSAGES.en.home.missingRates('INR and USD', 2)).toBe('INR and USD rates missing');
  });
});
