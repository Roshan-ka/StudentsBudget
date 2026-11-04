import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The theme's colours as the browser gets them, read from globals.css (redesign plan, chunk 1). WCAG 2.2 AA: text
// needs 4.5:1 against what it sits on, an outline or a focus ring 3:1. The dark theme's pairs join in chunk 8, the
// category blocks' in chunk 4.
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

/** Every `--name: #rrggbb;` in the stylesheet's `:root` blocks. */
function rootTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const block of source.matchAll(/^:root\s*\{([^}]*)\}/gm)) {
    for (const [, name, hex] of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
      tokens.set(name, hex.toLowerCase());
    }
  }
  return tokens;
}

/** WCAG's relative luminance of an sRGB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Text and the surface it is read on. `primary` is also the colour of links; `destructive` of form errors. */
const TEXT: [text: string, surface: string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'muted'],
  ['foreground', 'nav'],
  ['foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'nav'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['secondary-foreground', 'secondary'],
  ['primary-foreground', 'primary'],
  ['accent-foreground', 'accent'],
  ['nav-foreground', 'nav'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['destructive', 'background'],
  ['destructive', 'card'],
];

/** Outlines, the focus ring and the ring's arc on Home, and what they sit on. */
const GRAPHICS: [mark: string, surface: string][] = [
  ['outline', 'background'],
  ['outline', 'card'],
  ['ring', 'background'],
  ['ring', 'card'],
  ['ring', 'muted'],
  ['ring', 'nav'],
  ['ring', 'accent'],
  ['primary', 'accent'],
];

const light = rootTokens(css);

describe('the light theme', () => {
  it('defines every colour the pairs below name', () => {
    const named = new Set([...TEXT, ...GRAPHICS].flat());
    for (const name of named) expect(light.get(name), `--${name}`).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('gives text at least 4.5:1 on every surface it is read on', () => {
    for (const [text, surface] of TEXT) {
      const ratio = contrast(light.get(text) ?? '', light.get(surface) ?? '');
      expect(ratio, `--${text} on --${surface}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives outlines and focus rings at least 3:1 against what they sit on', () => {
    for (const [mark, surface] of GRAPHICS) {
      const ratio = contrast(light.get(mark) ?? '', light.get(surface) ?? '');
      expect(ratio, `--${mark} on --${surface}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('contrast', () => {
  it('matches WCAG: black on white is 21:1, a colour on itself 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#3046c8', '#3046c8')).toBe(1);
  });
});
