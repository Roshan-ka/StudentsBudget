import { describe, expect, it } from 'vitest';
import { hasSimd, MAX_SIDE, ocrPaths, scaledSize } from './ocr';
import { OCR_BASE } from './ocr-set';

// The receipt scan's reading engine (chunk 1): what can be checked without a browser.

describe('scaledSize', () => {
  it('shrinks a photo to MAX_SIDE on its long side, keeping its shape, in whole pixels', () => {
    expect(scaledSize(4_000, 3_000)).toEqual({ width: MAX_SIDE, height: 1_500 });
    expect(scaledSize(3_024, 4_032)).toEqual({ width: 1_500, height: MAX_SIDE });
    expect(scaledSize(1_001, 3_000, 1_000)).toEqual({ width: 334, height: 1_000 });
  });

  it('never enlarges a small photo, and never gives a side of 0', () => {
    expect(scaledSize(800, 1_200)).toEqual({ width: 800, height: 1_200 });
    expect(scaledSize(10_000, 1)).toEqual({ width: MAX_SIDE, height: 1 });
  });
});

describe('the core build a browser runs', () => {
  it('asks WebAssembly whether it runs SIMD, and takes a refusal or a failure as no', () => {
    // Node's WebAssembly runs SIMD, as every current browser does.
    expect(hasSimd()).toBe(true);
    expect(hasSimd(() => false)).toBe(false);
    expect(
      hasSimd(() => {
        throw new Error('no WebAssembly');
      }),
    ).toBe(false);
  });

  it('loads every file from the set’s own folder, with the SIMD build only where it runs', () => {
    const simd = ocrPaths(true);
    expect(simd.corePath).toBe(`${OCR_BASE}/tesseract-core-simd-lstm.wasm.js`);
    expect(ocrPaths(false).corePath).toBe(`${OCR_BASE}/tesseract-core-lstm.wasm.js`);
    for (const path of Object.values(simd)) expect(path.startsWith(`${OCR_BASE}/`), path).toBe(true);
  });
});
