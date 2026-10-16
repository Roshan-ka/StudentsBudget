import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { CITIES } from './cities';

const { regensburg } = CITIES;

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

describe('Regensburg', () => {
  it('every Regensburg number has source, url, checked date and min ≤ max', () => {
    expect(regensburg.id).toBe('regensburg');
    expect(regensburg.ranges.length).toBeGreaterThan(0);
    expect(regensburg.prices.length).toBeGreaterThan(0);

    for (const r of regensburg.ranges) {
      expect(r.source.trim(), `${r.categoryId} source`).not.toBe('');
      expect(r.url, `${r.categoryId} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(r.checked), `${r.categoryId} checked`).toBe(true);
      expect(Number.isInteger(r.minMinor), `${r.categoryId} min is whole cents`).toBe(true);
      expect(Number.isInteger(r.maxMinor), `${r.categoryId} max is whole cents`).toBe(true);
      expect(r.minMinor, `${r.categoryId} min > 0`).toBeGreaterThan(0);
      expect(r.minMinor, `${r.categoryId} min ≤ max`).toBeLessThanOrEqual(r.maxMinor);
    }

    for (const p of regensburg.prices) {
      expect(p.label.trim(), 'price label').not.toBe('');
      expect(p.source.trim(), `${p.label} source`).not.toBe('');
      expect(p.url, `${p.label} url`).toMatch(/^https:\/\/\S+$/);
      expect(isRealIsoDate(p.checked), `${p.label} checked`).toBe(true);
      expect(Number.isInteger(p.minor), `${p.label} is whole cents`).toBe(true);
      expect(p.minor, `${p.label} > 0`).toBeGreaterThan(0);
    }
  });

  it('covers rent and the six flexible categories', () => {
    const flexible = CATEGORIES.filter((c) => c.kind === 'flexible').map((c) => c.id);
    expect(flexible).toHaveLength(6);
    const covered = regensburg.ranges.map((r) => r.categoryId);
    for (const id of ['rent', ...flexible]) {
      expect(covered, `range for ${id}`).toContain(id);
    }
  });

  it('has one range per category', () => {
    const ids = regensburg.ranges.map((r) => r.categoryId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
