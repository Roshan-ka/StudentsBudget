// Draws every app icon from scripts/icon/icon.svg (redesign, chunk 3; our own mark, 17-11-2026):
// public/icon-192.png and icon-512.png (the manifest's, for any use and maskable), src/app/apple-icon.png (180 px, for
// iOS) and src/app/favicon.ico (16, 32 and 48 px). Usage: node scripts/export-icons.mjs
// sharp comes with Next (an optional dependency it installs for image optimisation), so the script adds nothing to
// package.json; it needs no browser.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const svg = fileURLToPath(new URL('./icon/icon.svg', import.meta.url));
const out = (path) => fileURLToPath(new URL(path, import.meta.url));

/** The icon at `size` px as PNG bytes, drawn at twice the size, then scaled down, so the outline's edges stay smooth. */
const png = (size) => sharp(svg, { density: Math.max(144, Math.ceil((size * 2 * 72) / 512)) }).resize(size, size).png().toBuffer();

for (const [size, path] of [
  [192, '../public/icon-192.png'],
  [512, '../public/icon-512.png'],
  [180, '../src/app/apple-icon.png'],
]) {
  await writeFile(out(path), await png(size));
  console.log(`wrote ${out(path)}`);
}

/**
 * An .ico holding PNG images, which every current browser reads: a 6-byte header, one 16-byte entry per image, then
 * the images. A width or height of 256 is written as 0, as the format asks.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1: an icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, bytes }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(bytes.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += bytes.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.bytes)]);
}

const favicon = out('../src/app/favicon.ico');
await writeFile(favicon, ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, bytes: await png(size) })))));
console.log(`wrote ${favicon}`);
