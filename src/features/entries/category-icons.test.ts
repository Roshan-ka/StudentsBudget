import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { CATEGORY_ICONS, OTHER_ICON } from './category-icons';

describe('category icons', () => {
  it('has an icon for every category, expense and income, and none for a category that does not exist', () => {
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual(CATEGORIES.map((c) => c.id).sort());
  });

  it('gives each category an icon of its own, none of them the one for everything else', () => {
    const icons = Object.values(CATEGORY_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
    expect(icons).not.toContain(OTHER_ICON);
  });
});
