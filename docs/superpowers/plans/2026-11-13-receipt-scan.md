# AI part 2, first piece: receipt scan, read on the phone (13-11-2026)

## Context

The AI phase's first part (quick add, Ask, the setup chat) is live on Groq's free plan. The Concept also lists a receipt scan, and Roshan picked it as the first piece of part 2.

**What the research found:** Groq's only vision model, `qwen/qwen3.8-27b`, is a **Preview** model, read 13-11-2026:
- Groq's models page says preview models are "for evaluation purposes only" and "should not be used in production".
- Groq's Services Agreement § 3.6 says its DPA does not apply to services "designated as … preview".

So students' receipt photos can't go to Groq.

**Decided (Roshan, 13-11-2026):**
- **Read the receipt on the phone.** Text recognition runs in the browser, and local rules find the total, the date and the shop. No photo or text leaves the phone.
- **One receipt becomes one expense:** its total, with the shop as the note and the shop's category. The student checks and can change it before it saves.

**Outcome:** on Entries, "Scan a receipt" opens the camera or a photo. After a few seconds, a filled-in entry appears to check and save.
- It works for guests and offline, after the first scan.
- It uses no AI allowance and has no data-protection note, because nothing is sent anywhere.

## Approach

- **Text recognition: Tesseract.js, self-hosted, loaded at runtime like MapLibre.**
  - A copy script puts the files under `public/ocr/tesseract-<version>/`:
    - the ESM build;
    - the worker;
    - the two LSTM core builds (with and without SIMD);
    - the German and English trained data (gzipped).
  - The files are committed, as `public/maps/` is, and a test holds the copy to the installed version.
  - `loadOcr()` imports the self-hosted ESM with `webpackIgnore`, as `loadMapLibre` does (`src/features/discounts/map/load-maplibre.ts`).
  - Each scan gets one worker, which is terminated after the scan to free the phone's memory.
  - The download is about 8–10 MB on the first scan (measured in chunk 1). It is cached for offline under its own service-worker cache, like the map's.
- **Image preparation on the phone:**
  - `createImageBitmap`, then a canvas.
  - The long side becomes at most 2,000 px, in grey.
  - The photo itself is never stored; its preview is a `blob:` URL, revoked after.
- **The reader, `readReceipt(text, ctx)`:** pure and tested with fixture texts.
  - **Total:** the amount on a total line (`SUMME`, `Gesamt`, `zu zahlen`, `Total`, `Betrag`, `EC`/`Karte`/`Bar`). It never takes a tax line (`MwSt`, `Netto`, `Brutto` blocks), `Gegeben` or `Rückgeld`. Without a total line, it takes the largest amount in the lower half.
  - **Date:** `dd.mm.yy(yy)` or `yyyy-mm-dd`, not in the future and within 60 days; else today.
  - **Shop:** the CSV import's chain list (`merchants.ts`, `merchantKey`), else the first meaningful line.
  - **Category:** `categorize` (`src/features/import/categorize.ts`): the student's own earlier choice first, then the chain list, else Other.
  - **Note:** cleaned with `importNote` (`src/features/import/note.ts`), so no card or IBAN digits are kept.
  - **Amounts:** read with `parseAmount` (`src/lib/money.ts`).
- **The check card:**
  - amount, date (`DateField`), shop note, category (quick add's chips), account (`defaultAccount`, `src/features/accounts/balances.ts`);
  - Save goes through `buildEntry` (`src/features/entries/build-entry.ts`) and `saveEntry`, then the Saved line with Undo, as in quick add;
  - "Couldn't read it" opens the same card empty, with the photo's preview beside it.
- **Where it goes:** a "Scan a receipt" link beside "Import a bank statement" (`ImportLink`), above quick add on Entries only. Never under quick add (CLAUDE.md), and not on Home, which every spec reaches.
- **Security headers:**
  - `script-src` gains `'wasm-unsafe-eval'` (WebAssembly needs it), with its unit test. Every path, `/ocr/` included, carries the headers.
  - `worker-src 'self' blob:` and `img-src blob:` are already there.
  - `camera=()` stays: a file input with `capture` hands over to the phone's camera app.
- **Privacy notice:** one sentence in "What stays on your phone": a receipt photo is read on the phone, never stored or sent, and the reading files come from the app's own address.

## Chunks (about 1 h each, a draft PR each, quick CI on push, none run locally)

1. **The engine:**
   - this plan into `docs/superpowers/plans/2026-11-13-receipt-scan.md`;
   - `tesseract.js` and `@tesseract.js-data/{deu,eng}` as pinned dev dependencies, at least two weeks old (heavy lane, `--package-lock-only --before=…`), checking which `tesseract.js-core` the 7.0.0 release needs;
   - `scripts/copy-ocr-vendor.mjs` and `ocr-vendor.test.ts`, modelled on `copy-map-vendor.mjs` and `map-vendor.test.ts`;
   - `src/features/receipts/ocr.ts`: `loadOcr`, `prepareImage`, and `readImageText(file, { signal, onProgress })`;
   - `'wasm-unsafe-eval'` and its test;
   - `/ocr/` cache-first in `public/sw.js`.
2. **The reader:** `src/features/receipts/read-receipt.ts` and its tests.
   - At least 10 fixture texts: REWE, Lidl, Aldi, Edeka, dm, Rossmann, a bakery, a kebab shop, an English receipt, one with misread characters.
   - Each holds total, date, shop and category. Tax and change lines are never the total, no future or old date is taken, and no card digits reach the note.
3. **Mockups**, one or two rounds, as Roshan approves looks: the link on Entries, the reading state with Cancel, the check card, and "couldn't read it", at 375 px in light and dark.
4. **The UI:** built on the approved mockups.
   - **Component:** `ScanReceipt`, with texts in English, German, French and Spanish (`messages/<code>/entries.ts`) and the privacy notice's sentence.
   - **Focus and status:** the card opens on its heading; progress and problems go through `StatusLine` and alerts.
   - **e2e:** `e2e/receipt.spec.ts` with the OCR module answered by `page.route` (the seam is the network, as with `mockAiFunction`).
   - **What the spec covers:** filled card, an edit and save, Undo, couldn't read, Cancel; its mutations and `// proof:` lines; the `/entries` entry in `e2e/affected-map.json`; axe in both themes.
5. **The real proof and offline:**
   - a Chromium e2e that draws a receipt in the page and reads it with the real engine under the real CSP;
   - an offline case, the OCR files cached after the first scan;
   - CLAUDE.md;
   - then Roshan's real try with real receipts, whose misses feed a tuning chunk if needed.

## Verification

- **Quick CI per chunk:** lint, typecheck, build and unit tests (the reader's fixtures, the vendor copy, the headers).
- **e2e:** a `changed` run on Roshan's OK for chunks 4 and 5 (the receipt spec, axe, security headers, offline).
- **The real try on the phone** (`npm run start:https` for the LAN, or Production after merge):
  - several real receipts, crumpled ones included;
  - in German and English;
  - offline after the first scan;
  - a low-end phone's time and memory.

## Risks

- **Accuracy:** phone-side recognition misreads faded or crumpled receipts. The check card and the empty fallback keep a misread from ever saving by itself. A later chunk can send the recognised text (never the photo) to gpt-oss-20b, a production model under the DPA, if the real try shows the rules miss too often.
- **The first scan downloads about 8–10 MB.** The card says so before it starts. The files then work offline.
- **Repository size:** about 8–10 MB more under `public/ocr/`, like the map. A Tesseract update replaces the folder.
- **iPhone Safari:** WebAssembly SIMD and memory may be limited there. The non-SIMD core build is the fallback, and the real try checks an iPhone.

## As built

- **Chunk 1** (16-11-2026), the engine, on `feat/receipt-ocr`:
  - **Packages** (dev dependencies, pinned; installed through the heavy lane with `--before=2026-11-02`): `tesseract.js` 7.0.0 and `tesseract.js-core` 7.0.0 (both 15-12-2025; 7.0.0 needs core ^7.0.0), `@tesseract.js-data/eng` and `deu` 1.0.0 (2023).
  - **`public/ocr/ocr-20261116/`** (`scripts/copy-ocr-vendor.mjs`), 12.3 MB in the repo:
    - `tesseract.esm.min.js` (63 KB) and `worker.min.js` (111 KB);
    - the LSTM core with and without SIMD (3.9 MB each);
    - `lang/deu.traineddata.gz` and `lang/eng.traineddata.gz`, tessdata's best_int models (1.3 and 3.0 MB);
    - the licences, `versions.json` and a README.
    - A phone downloads about 8.4 MB on its first scan: one core, both languages and the two scripts.
  - **Why only two core builds:** Tesseract.js's own choice, given a folder, asks for a relaxed-SIMD build first on browsers that have it (a third 3.9 MB file). `ocrPaths(hasSimd())` names the exact file instead, with the SIMD probe Tesseract.js uses itself (wasm-feature-detect's bytes).
  - **`ocr-set.ts`:** `OCR_SET` (`id`, the four package versions) and `OCR_BASE`, kept apart so AppInit names the set without loading the scan.
    - The copy script refuses an id whose folder holds other versions, and removes older sets.
    - `ocr-vendor.test.ts` holds the pins, `versions.json` and every file a scan loads.
  - **`ocr.ts`:** `loadOcr` (once, retried after a failure), `scaledSize`, `prepareImage` (`createImageBitmap`, upright from the photo's EXIF, a PNG), `hasSimd`, `ocrPaths` and `readImageText`.
    - Progress comes as `loading` or `reading`.
    - An abort rejects at once, and the worker is terminated either way.
    - Tesseract.js unpacks the data only when it is still gzipped (it checks the first bytes), so a host that sends `.gz` with `Content-Encoding: gzip` works too.
  - **Security headers:** `script-src` gains `'wasm-unsafe-eval'`. The live policy's test now checks for the exact `'unsafe-eval'` keyword, which the WebAssembly one doesn't contain.
  - **Service worker:** `/ocr/` is served cache-first from `studentsbudget-ocr-<set>` (`sw.js?ocr=`, `registerServiceWorker`'s `ocrSet`, AppInit), kept on activate like the map's.
    - `sw.test.ts`: the cache kept and an older set dropped, and a file served first from its cache.
    - `sw-register.test.ts`: the URL.
  - **ESLint** ignores `public/ocr/**`, as it does `public/maps/**`.
  - **Not yet:** nothing calls `readImageText` until chunk 4, and the real engine under the real CSP is proved in chunk 5's Chromium e2e.

