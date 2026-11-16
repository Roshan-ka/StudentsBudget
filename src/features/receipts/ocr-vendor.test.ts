import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ocrPaths } from './ocr';
import { OCR_BASE, OCR_SET } from './ocr-set';

// What the receipt scan ships in public/ocr (chunk 1): run `node scripts/copy-ocr-vendor.mjs`, with a new OCR_SET id,
// after a bump of any of the four packages.

describe('what the receipt scan ships in public/ocr', () => {
  it('pins the packages OCR_SET names, and its folder was copied from them', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { devDependencies: Record<string, string> };
    for (const [name, version] of Object.entries(OCR_SET.packages)) expect(pkg.devDependencies[name], name).toBe(version);
    expect(JSON.parse(readFileSync(`public${OCR_BASE}/versions.json`, 'utf8'))).toEqual(OCR_SET.packages);
  });

  it('has every file a scan loads, for both core builds, and only the current set', () => {
    for (const simd of [true, false]) {
      for (const path of Object.values(ocrPaths(simd)).filter((path) => path.endsWith('.js'))) {
        expect(existsSync(`public${path}`), path).toBe(true);
      }
    }
    for (const lang of ['deu', 'eng']) expect(existsSync(`public${OCR_BASE}/lang/${lang}.traineddata.gz`), lang).toBe(true);
    expect(readFileSync(`public${OCR_BASE}/README.md`, 'utf8')).toContain('Apache License 2.0');
    expect(readdirSync('public/ocr')).toEqual([OCR_SET.id]);
  });
});
