// Draws the app icon's two PNGs from scripts/icon/icon.svg (redesign, chunk 3). Usage: node scripts/export-icons.mjs
// sharp comes with Next (an optional dependency it installs for image optimisation), so the script adds nothing to
// package.json; it needs no browser.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const svg = fileURLToPath(new URL('./icon/icon.svg', import.meta.url));

for (const size of [192, 512]) {
  const out = fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url));
  // Drawn at twice the size, then scaled down, so the outline's edges stay smooth.
  await sharp(svg, { density: 144 }).resize(size, size).png().toFile(out);
  console.log(`wrote ${out}`);
}
