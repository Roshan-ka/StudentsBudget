// Builds the Regensburg map shipped with the app (discount map, chunk 1;
// docs/superpowers/plans/2026-11-11-discount-map.md), from what `MAP_SET` names:
//   - every vector tile of its box, from minZoom to maxZoom, read from the Protomaps build with range requests and
//     written uncompressed as public/maps/<id>/tiles/{z}/{x}/{y}.pbf (plain files: no Range requests at runtime);
//   - the Noto Sans glyphs and the light and dark sprites from basemaps-assets at its pinned commit;
//   - the licences: the fonts' OFL, and a note on the map data (ODbL).
// It downloads data, so it is run by hand, with Roshan's OK: node scripts/build-map-tiles.mjs
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FetchSource, PMTiles } from 'pmtiles';
import { MAP_SET } from '../src/features/discounts/map/map-set.ts';

const OUT = `public/maps/${MAP_SET.id}`;
// The fonts the Protomaps style names, and the Unicode ranges German, French and Spanish street names need.
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const RANGES = ['0-255', '256-511', '512-767', '768-1023', '8192-8447'];
const SPRITES = ['light', 'dark'].flatMap((flavor) => [`${flavor}.json`, `${flavor}.png`, `${flavor}@2x.json`, `${flavor}@2x.png`]);

/** The tiles a box covers at zoom z, in the web-mercator scheme the build uses. */
function tilesAt(z, [west, south, east, north]) {
  const n = 2 ** z;
  const x = (lon) => Math.floor(((lon + 180) / 360) * n);
  const y = (lat) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const tiles = [];
  for (let tx = x(west); tx <= x(east); tx++) for (let ty = y(north); ty <= y(south); ty++) tiles.push([z, tx, ty]);
  return tiles;
}

async function write(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

/** Runs `work` over `items`, `limit` at a time. */
async function inBatches(items, limit, work) {
  for (let i = 0; i < items.length; i += limit) await Promise.all(items.slice(i, i + limit).map(work));
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

await rm(OUT, { recursive: true, force: true });

const archive = new PMTiles(new FetchSource(MAP_SET.build));
const header = await archive.getHeader();
if (header.minZoom > MAP_SET.minZoom || header.maxZoom < MAP_SET.maxZoom) {
  throw new Error(`The build covers zooms ${header.minZoom}–${header.maxZoom}, not ${MAP_SET.minZoom}–${MAP_SET.maxZoom}.`);
}

const wanted = [];
for (let z = MAP_SET.minZoom; z <= MAP_SET.maxZoom; z++) wanted.push(...tilesAt(z, MAP_SET.bounds));
let tileBytes = 0;
let written = 0;
await inBatches(wanted, 8, async ([z, x, y]) => {
  // getZxy hands the tile back uncompressed; a tile the build doesn't have stays missing (MapLibre draws it empty).
  const tile = await archive.getZxy(z, x, y);
  if (tile === undefined) return;
  const bytes = new Uint8Array(tile.data);
  tileBytes += bytes.length;
  written += 1;
  await write(`${OUT}/tiles/${z}/${x}/${y}.pbf`, bytes);
});

const raw = `https://raw.githubusercontent.com/${MAP_SET.assets.repo}/${MAP_SET.assets.commit}`;
let assetBytes = 0;
const assets = [
  ...FONTS.flatMap((font) => RANGES.map((range) => [`fonts/${font}/${range}.pbf`, `fonts/${encodeURIComponent(font)}/${range}.pbf`])),
  ...SPRITES.map((name) => [`sprites/${name}`, `sprites/v4/${name}`]),
  ['fonts/OFL.txt', 'fonts/OFL.txt'],
];
await inBatches(assets, 8, async ([to, from]) => {
  const bytes = await fetchBytes(`${raw}/${from}`);
  assetBytes += bytes.length;
  await write(`${OUT}/${to}`, bytes);
});

await write(
  `${OUT}/LICENSE.md`,
  [
    '# The Regensburg map',
    '',
    `- **Map data:** © OpenStreetMap contributors, under the Open Database License (ODbL 1.0, https://opendatacommons.org/licenses/odbl/). The tiles were cut from the Protomaps build ${MAP_SET.build} (built ${MAP_SET.built}) by scripts/build-map-tiles.mjs.`,
    `- **Fonts:** Noto Sans glyphs from https://github.com/${MAP_SET.assets.repo} at ${MAP_SET.assets.commit}, under the SIL Open Font License (fonts/OFL.txt).`,
    `- **Icons:** the Protomaps basemaps sprites from the same commit.`,
    '',
  ].join('\n'),
);

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`Tiles: ${written} of ${wanted.length} written, ${mb(tileBytes)}. Fonts, icons and licences: ${assets.length} files, ${mb(assetBytes)}.`);
