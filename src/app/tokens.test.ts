import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TINT_SHARE } from '@/features/charts/colors';

// The theme's colours as the browser gets them, read from globals.css (redesign plan, chunk 1). WCAG 2.2 AA: text
// needs 4.5:1 against what it sits on, an outline or a focus ring 3:1. The category tints joined in chunk 4; the dark
// theme's pairs join in chunk 8.
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
  return ratio(luminance(a), luminance(b));
}

function ratio(a: number, b: number): number {
  const [lighter, darker] = [a, b].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** An sRGB colour as linear channels, 0 to 1. */
function linear(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return [r, g, b];
}

/** Linear sRGB to OKLab and back (Björn Ottosson's matrices, as CSS Color 4 uses them). */
function toOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * The luminance of `color-mix(in oklch, <tint> <share>%, <base>)` with an achromatic base (the white card): white has
 * no hue, so the mix keeps the tint's, and mixing lightness and chroma in OKLCH is mixing L, a and b in OKLab.
 */
function mixedLuminance(tint: string, share: number, base: string): number {
  const [tl, ta, tb] = toOklab(linear(tint));
  const [bl, ba, bb] = toOklab(linear(base));
  const w = share / 100;
  const [r, g, b] = fromOklab([tl * w + bl * (1 - w), ta * w + ba * (1 - w), tb * w + bb * (1 - w)]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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

describe('the category tints (an envelope on Home, a tag)', () => {
  const categories = [...light.keys()].filter((name) => name.startsWith('cat-'));

  it('finds the category colours', () => {
    expect(categories.length).toBeGreaterThanOrEqual(20);
  });

  it('keeps text and secondary text at 4.5:1 on every tint, with a margin for rounding', () => {
    for (const category of categories) {
      const tint = mixedLuminance(light.get(category) ?? '', TINT_SHARE, light.get('card') ?? '');
      for (const text of ['foreground', 'muted-foreground']) {
        const value = ratio(luminance(light.get(text) ?? ''), tint);
        expect(value, `--${text} on the ${category} tint: ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.6);
      }
    }
  });

  it('mixes as the browser does: white with any share of white is white, and no share of a colour leaves the card', () => {
    expect(mixedLuminance('#ffffff', 50, '#ffffff')).toBeCloseTo(1, 4);
    expect(mixedLuminance('#3046c8', 0, '#ffffff')).toBeCloseTo(1, 4);
    expect(mixedLuminance('#3046c8', 100, '#ffffff')).toBeCloseTo(luminance('#3046c8'), 3);
  });
});

describe('contrast', () => {
  it('matches WCAG: black on white is 21:1, a colour on itself 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#3046c8', '#3046c8')).toBe(1);
  });
});
