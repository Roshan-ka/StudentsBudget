import { describe, expect, it } from 'vitest';
import { categoryName, orderOf } from './categories';

describe('orderOf', () => {
  it('follows the built-in list', () => {
    expect(orderOf('food')).toBe(0);
    expect(orderOf('eating-out')).toBe(1);
    expect(orderOf('food')).toBeLessThan(orderOf('rent'));
  });

  it('puts a category that is not built in last', () => {
    expect(orderOf('gone')).toBeGreaterThan(orderOf('income-other'));
  });
});

describe('categoryName', () => {
  it('names a built-in category and falls back to the id', () => {
    expect(categoryName('eating-out')).toBe('Eating out');
    expect(categoryName('gone')).toBe('gone');
  });
});
