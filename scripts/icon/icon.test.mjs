import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The app icon is our own drawing (Roshan, 17-11-2026): no path in it may come from an icon set. Lucide, whose icons the
// app's buttons use, asks for its licence notice in every copy, which an app icon can't carry; the wallet the icon
// had until then was Lucide's. This holds every path in icon.svg against every path lucide-react ships.

const ICON = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const LUCIDE = new URL('../../node_modules/lucide-react/dist/esm/icons/', import.meta.url);

/** A path's drawing commands with spaces and commas evened out, so a copy can't hide behind formatting. */
const normal = (d) => d.replace(/[\s,]+/g, ' ').trim();

function lucidePaths() {
  const paths = new Set();
  for (const file of readdirSync(LUCIDE).filter((name) => name.endsWith('.mjs'))) {
    for (const [, d] of readFileSync(new URL(file, LUCIDE), 'utf8').matchAll(/\bd: "([^"]+)"/g)) paths.add(normal(d));
  }
  return paths;
}

describe('the app icon', () => {
  it('holds no path copied from lucide', () => {
    const lucide = lucidePaths();
    // The scan reads something: lucide's own wallet is among its paths.
    expect(lucide.has(normal('M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'))).toBe(true);
    const ours = [...ICON.matchAll(/\bd="([^"]+)"/g)].map(([, d]) => normal(d));
    expect(ours.length).toBeGreaterThan(0);
    expect(ours.filter((d) => lucide.has(d))).toEqual([]);
  });

  it('scales nothing in from an icon set’s 24-unit grid', () => {
    // The old icon placed lucide's 24-unit paths with `scale(8.5) translate(-12 -12)`; our own shapes are drawn on the
    // 512 grid.
    expect(ICON).not.toMatch(/translate\(-12 -12\)/);
  });
});
