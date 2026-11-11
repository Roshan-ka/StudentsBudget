// Copies MapLibre's built modules and stylesheet into public/maps/vendor/maplibre-gl-<version>/ (discount map,
// chunk 1; docs/superpowers/plans/2026-11-11-discount-map.md). maplibre-gl 6 ships ES modules only: the map module
// starts its worker from maplibre-gl-worker.mjs beside it, which, served from this origin, is a worker the service
// worker controls. The page imports the module from there at runtime (`loadMapLibre`), so the service worker keeps
// it in the map's own cache, which outlives a deploy; a bundled chunk would sit in the per-commit cache and be gone
// offline after every deploy. Run after changing maplibre-gl's version: node scripts/copy-map-vendor.mjs
// (`map-vendor.test.ts` fails while the copy and package.json disagree).
import { copyFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';

const ROOT = 'public/maps/vendor';
const { version } = JSON.parse(await readFile('node_modules/maplibre-gl/package.json', 'utf8'));
const out = `${ROOT}/maplibre-gl-${version}`;

await mkdir(ROOT, { recursive: true });
for (const name of await readdir(ROOT)) {
  if (name.startsWith('maplibre-gl-')) await rm(`${ROOT}/${name}`, { recursive: true });
}
await mkdir(out);
for (const file of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  await copyFile(`node_modules/maplibre-gl/dist/${file}`, `${out}/${file}`);
}
await copyFile('node_modules/maplibre-gl/LICENSE.txt', `${out}/LICENSE.txt`);
console.log(`Copied maplibre-gl ${version} to ${out}.`);
