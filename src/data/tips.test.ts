import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { TIPS } from './tips';

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

describe('Regensburg tips', () => {
  it('every tip has a title, a body, a known category, a source, a url and a checked date', () => {
    expect(TIPS.length).toBeGreaterThan(0);
    const categoryIds = new Set(CATEGORIES.map((c) => c.id));

    for (const t of TIPS) {
      expect(t.id, 'id').toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(t.title.trim(), `${t.id} title`).not.toBe('');
      expect(t.body.trim(), `${t.id} body`).not.toBe('');
      expect(categoryIds.has(t.categoryId), `${t.id} category ${t.categoryId}`).toBe(true);
      expect(t.source.trim(), `${t.id} source`).not.toBe('');
      expect(t.url, `${t.id} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(t.checked), `${t.id} checked`).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
