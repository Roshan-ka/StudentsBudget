// Copies the receipt scan's reading files into public/ocr/<OCR_SET.id>/ (receipt scan, chunk 1;
// docs/superpowers/plans/2026-11-13-receipt-scan.md): Tesseract.js's ES module and worker, its WebAssembly core with
// and without SIMD (LSTM only: the scan reads with the neural engine alone, and `ocrPaths` picks the build the browser
// runs), and the German and English language data (tessdata's best_int models, gzipped). The page imports the module
// from there at runtime (`loadOcr`), so the service worker keeps every file in the scan's own cache, named by the set,
// which outlives a deploy; a bundled chunk would sit in the per-commit cache.
// Run after changing any of the four packages, with a new OCR_SET id: node scripts/copy-ocr-vendor.mjs. It refuses a
// set id whose folder holds other versions (phones would keep the old files), and `ocr-vendor.test.ts` fails while the
// copy and package.json disagree.
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { OCR_SET } from '../src/features/receipts/ocr-set.ts';

const ROOT = 'public/ocr';
const out = `${ROOT}/${OCR_SET.id}`;

const installed = {};
for (const [name, version] of Object.entries(OCR_SET.packages)) {
  installed[name] = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8')).version;
  if (installed[name] !== version) {
    throw new Error(`${name} is ${installed[name]} in node_modules, but OCR_SET names ${version}: update ocr-set.ts, with a new id`);
  }
}
if (existsSync(`${out}/versions.json`)) {
  const before = JSON.parse(await readFile(`${out}/versions.json`, 'utf8'));
  if (JSON.stringify(before) !== JSON.stringify(installed)) {
    throw new Error(`${out} was copied from other versions: give OCR_SET a new id, so phones fetch the new files`);
  }
}

await mkdir(ROOT, { recursive: true });
for (const name of await readdir(ROOT)) await rm(`${ROOT}/${name}`, { recursive: true });
await mkdir(`${out}/lang`, { recursive: true });

const FILES = [
  ['tesseract.js/dist/tesseract.esm.min.js', 'tesseract.esm.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz', 'lang/deu.traineddata.gz'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
  ['tesseract.js/LICENSE.md', 'LICENSE-tesseract.js.md'],
  ['tesseract.js-core/LICENSE', 'LICENSE-tesseract.js-core.txt'],
];
for (const [from, to] of FILES) await copyFile(`node_modules/${from}`, `${out}/${to}`);

await writeFile(`${out}/versions.json`, `${JSON.stringify(installed, null, 2)}\n`);
await writeFile(
  `${out}/README.md`,
  [
    `# ${OCR_SET.id}`,
    '',
    'The receipt scan\'s reading files, copied by `scripts/copy-ocr-vendor.mjs` from the packages in `versions.json`:',
    '',
    '- `tesseract.esm.min.js`, `worker.min.js`: Tesseract.js, Apache License 2.0 (`LICENSE-tesseract.js.md`).',
    '- `tesseract-core-*.wasm.js`: Tesseract.js-core, Tesseract compiled to WebAssembly, Apache License 2.0',
    '  (`LICENSE-tesseract.js-core.txt`).',
    '- `lang/*.traineddata.gz`: the German and English models of tesseract-ocr/tessdata_best (integer versions),',
    '  Apache License 2.0, packaged by @tesseract.js-data (MIT).',
    '',
  ].join('\n'),
);
console.log(`Copied the OCR set ${OCR_SET.id} (${Object.entries(installed).map(([name, version]) => `${name} ${version}`).join(', ')}) to ${out}.`);
