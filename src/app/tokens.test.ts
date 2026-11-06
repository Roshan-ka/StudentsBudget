import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BAR_SHARE, TINT_SHARE } from '@/features/charts/colors';

// The themes' colours as the browser gets them, read from globals.css (redesign plan, chunks 1, 4 and 8). WCAG 2.2 AA:
// text needs 4.5:1 against what it sits on, an outline or a focus ring 3:1, in the light theme and in the dark one,
// on the plain surfaces and on every category tint.
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

/** Every `--name: #rrggbb;` in the stylesheet's blocks for `selector` (`:root` is light, `.dark` dark). */
function tokensOf(source: string, selector: ':root' | '.dark'): Map<string, string> {
  const tokens = new Map<string, string>();
  const blocks = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'gm');
  for (const block of source.matchAll(blocks)) {
    for (const [, name, hex] of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
      tokens.set(name, hex.toLowerCase());
    }
  }
  return tokens;
}

/** An sRGB colour as linear channels, 0 to 1. */
function linear(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return [r, g, b];
}

/** WCAG's relative luminance, from linear channels. */
function luminanceOf([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function luminance(hex: string): number {
  return luminanceOf(linear(hex));
}

function ratio(a: number, b: number): number {
  const [lighter, darker] = [a, b].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrast(a: string, b: string): number {
  return ratio(luminance(a), luminance(b));
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

/** OKLCH: lightness, chroma, and hue in degrees. */
function toOklch(hex: string): [number, number, number] {
  const [L, a, b] = toOklab(linear(hex));
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

/** Below this chroma a colour has no hue to speak of (white, the greys): CSS treats its hue as missing. */
const ACHROMATIC = 0.0002;

/**
 * `color-mix(in oklch, <tint> <share>%, <base>)` as linear channels, as CSS Color 5 mixes: lightness and chroma
 * linearly, the hue along the shorter arc, and a colour without a hue taking the other's.
 */
function mixed(tint: string, share: number, base: string): [number, number, number] {
  const [tl, tc, th] = toOklch(tint);
  const [bl, bc, bh] = toOklch(base);
  const w = share / 100;
  let hue: number;
  if (bc < ACHROMATIC) hue = th;
  else if (tc < ACHROMATIC) hue = bh;
  else {
    let turn = bh - th;
    if (turn > 180) turn -= 360;
    if (turn < -180) turn += 360;
    hue = th + turn * (1 - w);
  }
  const L = tl * w + bl * (1 - w);
  const C = tc * w + bc * (1 - w);
  const radians = (hue * Math.PI) / 180;
  return fromOklab([L, C * Math.cos(radians), C * Math.sin(radians)]);
}

function mixedLuminance(tint: string, share: number, base: string): number {
  return luminanceOf(mixed(tint, share, base));
}

/** A linear channel as sRGB, 0 to 1. */
function encode(channel: number): number {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function decode(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** `color` at `alpha` over `under` (linear channels), blended as the browser blends: in sRGB. */
function over(color: [number, number, number], alpha: number, under: [number, number, number]): number {
  const blended = color.map((channel, i) => decode(alpha * encode(channel) + (1 - alpha) * encode(under[i])));
  return luminanceOf(blended as [number, number, number]);
}

/** How much of the text colour `--track` lays over what is under it: `color-mix(in oklch, var(--foreground) N%, transparent)`. */
function trackShareOf(source: string, selector: ':root' | '.dark'): number {
  const blocks = new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'gm');
  for (const block of source.matchAll(blocks)) {
    const share = /--track:\s*color-mix\(in oklch, var\(--foreground\) (\d+)%, transparent\)/.exec(block[1]);
    if (share) return Number(share[1]) / 100;
  }
  throw new Error(`no --track in ${selector}`);
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

const THEMES = { light: tokensOf(css, ':root'), dark: tokensOf(css, '.dark') };
const TRACK_SHARES = { light: trackShareOf(css, ':root'), dark: trackShareOf(css, '.dark') };

describe.each(Object.entries(THEMES))('the %s theme', (theme, tokens) => {
  it('defines every colour the pairs below name', () => {
    const named = new Set([...TEXT, ...GRAPHICS].flat());
    for (const name of named) expect(tokens.get(name), `--${name}`).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('gives text at least 4.5:1 on every surface it is read on', () => {
    for (const [text, surface] of TEXT) {
      const value = contrast(tokens.get(text) ?? '', tokens.get(surface) ?? '');
      expect(value, `--${text} on --${surface}: ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives outlines and focus rings at least 3:1 against what they sit on', () => {
    for (const [mark, surface] of GRAPHICS) {
      const value = contrast(tokens.get(mark) ?? '', tokens.get(surface) ?? '');
      expect(value, `--${mark} on --${surface}: ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps text and secondary text at 4.5:1 on every category tint, with a margin for rounding', () => {
    const categories = [...tokens.keys()].filter((name) => name.startsWith('cat-'));
    expect(categories.length).toBeGreaterThanOrEqual(20);
    for (const category of categories) {
      const tint = mixedLuminance(tokens.get(category) ?? '', TINT_SHARE, tokens.get('card') ?? '');
      for (const text of ['foreground', 'muted-foreground']) {
        const value = ratio(luminance(tokens.get(text) ?? ''), tint);
        expect(value, `--${text} on the ${category} tint: ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.6);
      }
    }
  });

  // An envelope on Home: its bar's deeper fill against the track, which lies over the envelope's own tint
  // (accessibility, chunk 7). The chart marks have an outline instead, which GRAPHICS holds to 3:1 on the card.
  it('keeps every envelope bar at 3:1 on its track and tint, with a margin for rounding', () => {
    const card = tokens.get('card') ?? '';
    const foreground = tokens.get('foreground') ?? '';
    const share = TRACK_SHARES[theme as keyof typeof TRACK_SHARES];
    for (const category of [...tokens.keys()].filter((name) => name.startsWith('cat-'))) {
      const color = tokens.get(category) ?? '';
      const track = over(linear(foreground), share, mixed(color, TINT_SHARE, card));
      const value = ratio(luminanceOf(mixed(color, BAR_SHARE, foreground)), track);
      expect(value, `the ${category} bar on its track: ${value.toFixed(2)}:1`).toBeGreaterThanOrEqual(3.05);
    }
  });
});

describe('the colour maths', () => {
  it('matches WCAG: black on white is 21:1, a colour on itself 1:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#3046c8', '#3046c8')).toBe(1);
  });

  it('mixes as the browser does: no share of a colour leaves the base, all of it gives the colour', () => {
    expect(mixedLuminance('#ffffff', 50, '#ffffff')).toBeCloseTo(1, 4);
    expect(mixedLuminance('#3046c8', 0, '#ffffff')).toBeCloseTo(1, 4);
    expect(mixedLuminance('#3046c8', 100, '#ffffff')).toBeCloseTo(luminance('#3046c8'), 3);
    expect(mixedLuminance('#3046c8', 0, '#25221c')).toBeCloseTo(luminance('#25221c'), 3);
  });
});
