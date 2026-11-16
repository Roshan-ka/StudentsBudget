// The receipt scan's reading files (docs/superpowers/plans/2026-11-13-receipt-scan.md): Tesseract.js, its WebAssembly
// core and the German and English language data, copied from node_modules by `scripts/copy-ocr-vendor.mjs` into
// `public/ocr/<set>/` and loaded at runtime from there, so no outside service is asked for anything while a receipt is
// read. The service worker keeps one cache per set (`sw.js?ocr=<set>`): a bump of any of the four packages takes a new
// set id, so phones swap the old files for the new ones (the copy script refuses to rewrite a set with other versions).
// Kept apart from `ocr.ts`, so AppInit can name the set without loading anything else of the scan.

export const OCR_SET = {
  id: 'ocr-20261116',
  /** The packages the set was copied from, equal to package.json's pins (`ocr-vendor.test.ts`). */
  packages: {
    'tesseract.js': '7.0.0',
    'tesseract.js-core': '7.0.0',
    '@tesseract.js-data/eng': '1.0.0',
    '@tesseract.js-data/deu': '1.0.0',
  },
} as const;

/** Where the set's files are served from. */
export const OCR_BASE = `/ocr/${OCR_SET.id}`;
