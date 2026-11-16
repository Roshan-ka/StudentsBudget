import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import manifest from './manifest';

// The web app manifest's icons (maskable icon, docs/superpowers/plans/2026-11-16-maskable-icon.md): each file exists
// at its stated size, and the maskable ones keep their art inside the safe zone a launcher may crop to.

/** The page colour, `--background` in globals.css, which fills the icon to its edges. */
const PAGE = [0xfb, 0xf6, 0xec];
const icons = manifest().icons ?? [];
const fileOf = (src: string) => fileURLToPath(new URL(`../../public${src}`, import.meta.url));

describe('the manifest’s icons', () => {
  it('lists a 192 and a 512 icon for any use and for a maskable crop', () => {
    for (const purpose of ['any', 'maskable'] as const) {
      expect(icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
    }
  });

  it('points every icon at a file of the size it states', async () => {
    for (const icon of icons) {
      const { width, height } = await sharp(fileOf(icon.src)).metadata();
      expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
    }
  });

  it('keeps a maskable icon’s art inside the central 80 %, with the page colour around it', async () => {
    for (const icon of icons.filter((i) => i.purpose === 'maskable')) {
      const { data, info } = await sharp(fileOf(icon.src)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const centre = info.width / 2;
      // The safe zone is a circle of radius 40 % of the size; one pixel more for the edge's smoothing.
      const safe = info.width * 0.4 + 1;
      let outside = 0;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          if (Math.hypot(x + 0.5 - centre, y + 0.5 - centre) <= safe) continue;
          const at = (y * info.width + x) * info.channels;
          if (PAGE.some((value, c) => Math.abs(data[at + c] - value) > 2)) outside += 1;
        }
      }
      expect(outside, `${icon.src}: pixels of art outside the safe zone`).toBe(0);
    }
  });
});
