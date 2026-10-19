import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { BUCKET_ID } from './aggregate';
import { BUCKET_LABEL, chartColor, chartLabel } from './colors';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

/** `--cat-<id>: #rrggbb` declarations in the block that follows `selector {`, by id. */
function categoryColors(selector: ':root' | '.dark'): Map<string, string> {
  const colors = new Map<string, string>();
  // Every rule with this selector that declares category colours; globals.css has other `:root` and `.dark` rules.
  for (const block of css.matchAll(new RegExp(`^${selector.replace('.', '\\.')} \\{([^}]*)\\}`, 'gm'))) {
    for (const [, id, hex] of (block[1] ?? '').matchAll(/--cat-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      if (id !== undefined && hex !== undefined) colors.set(id, hex.toLowerCase());
    }
  }
  return colors;
}

const light = categoryColors(':root');
const dark = categoryColors('.dark');

describe('category colours', () => {
  it('gives every built-in category a colour in light and in dark', () => {
    for (const { id } of CATEGORIES) {
      expect(light.get(id), `${id} in light`).toMatch(/^#[0-9a-f]{6}$/);
      expect(dark.get(id), `${id} in dark`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('points a category at its own variable', () => {
    expect(chartColor('food')).toBe('var(--cat-food)');
    expect(chartColor('income-parents')).toBe('var(--cat-income-parents)');
    for (const { id } of CATEGORIES) expect(chartColor(id)).toBe(`var(--cat-${id})`);
  });

  it('gives no two expense categories the same colour, and no two income categories', () => {
    for (const colors of [light, dark]) {
      for (const kinds of [
        CATEGORIES.filter((c) => c.kind !== 'income'),
        CATEGORIES.filter((c) => c.kind === 'income'),
      ]) {
        const hexes = kinds.map((c) => colors.get(c.id));
        expect(new Set(hexes).size).toBe(kinds.length);
      }
    }
  });

  it('makes the bucket a neutral grey in both, different from every category', () => {
    for (const colors of [light, dark]) {
      const grey = colors.get(BUCKET_ID);
      expect(grey).toMatch(/^#([0-9a-f]{2})\1\1$/);
      expect(CATEGORIES.map((c) => colors.get(c.id))).not.toContain(grey);
    }
  });

  it('falls back to the bucket grey for a category that is not built in', () => {
    expect(chartColor('not-a-category')).toBe(`var(--cat-${BUCKET_ID})`);
    expect(chartColor(BUCKET_ID)).toBe(`var(--cat-${BUCKET_ID})`);
  });
});

describe('chart labels', () => {
  it('shortens the long names', () => {
    expect(chartLabel('utilities')).toBe('Utilities');
    expect(chartLabel('transport-pass')).toBe('Transport pass');
  });

  it('keeps every other name, and fits every name in a chart', () => {
    expect(chartLabel('food')).toBe('Food & groceries');
    expect(chartLabel('income-job')).toBe('Job');
    for (const { id } of CATEGORIES) expect(chartLabel(id).length, id).toBeLessThanOrEqual(16);
  });

  it('names the bucket "Everything else", and an unknown category by its id', () => {
    expect(chartLabel(BUCKET_ID)).toBe('Everything else');
    expect(BUCKET_LABEL).toBe('Everything else');
    expect(chartLabel('not-a-category')).toBe('not-a-category');
  });
});
