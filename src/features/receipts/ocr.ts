import type * as TesseractModule from 'tesseract.js';
import { OCR_BASE } from './ocr-set';

// How a receipt photo becomes text, on the phone (receipt scan, chunk 1, docs/superpowers/plans/2026-11-13-receipt-scan.md).
// Tesseract.js runs from the app's own copy (`public/ocr/<set>/`, `scripts/copy-ocr-vendor.mjs`), loaded only when a
// receipt is scanned: its module with a native import() the bundler leaves alone, its worker, the WebAssembly core
// this browser runs, and the German and English language data. Nothing leaves the app's origin: no photo, no text.

type Tesseract = typeof TesseractModule;

/** What a scan is doing: loading its files (the first time, several MB) or reading the photo; progress 0 to 1. */
export type OcrProgress = { stage: 'loading' | 'reading'; progress: number };

/** The longest side a photo is read at: enough for a receipt's print, and light on the phone's memory. */
export const MAX_SIDE = 2_000;

/** The size a photo is read at: its long side at most `max`, never enlarged, in whole pixels. */
export function scaledSize(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * A WebAssembly module that needs SIMD: wasm-feature-detect's `simd` probe (Apache-2.0), the check Tesseract.js runs
 * itself. Asked here so the set needs only the two builds it ships, with and without SIMD.
 */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

/** Whether this browser runs WebAssembly SIMD. */
export function hasSimd(validate: (bytes: Uint8Array) => boolean = (bytes) => WebAssembly.validate(bytes)): boolean {
  try {
    return validate(SIMD_PROBE);
  } catch {
    return false;
  }
}

/** The files a scan loads, all from the set's folder, with the core build this browser runs (LSTM only). */
export function ocrPaths(simd: boolean) {
  return {
    module: `${OCR_BASE}/tesseract.esm.min.js`,
    workerPath: `${OCR_BASE}/worker.min.js`,
    corePath: `${OCR_BASE}/${simd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'}`,
    langPath: `${OCR_BASE}/lang`,
  };
}

let loading: Promise<Tesseract> | null = null;

/** Tesseract.js, loaded once from the app's own copy. A failed load can be tried again. */
export function loadOcr(): Promise<Tesseract> {
  loading ??= (async () => {
    try {
      const loaded = (await import(/* webpackIgnore: true */ `${OCR_BASE}/tesseract.esm.min.js`)) as { default: Tesseract };
      return loaded.default;
    } catch (error) {
      loading = null;
      throw error;
    }
  })();
  return loading;
}

/** The photo, scaled for reading (`scaledSize`, upright as the camera took it), as a PNG. */
export async function prepareImage(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('The photo could not be drawn.');
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The photo could not be prepared.'))), 'image/png'),
    );
  } finally {
    bitmap.close();
  }
}

/**
 * The text of a receipt photo, read on the phone. One worker per scan, ended after it or on abort, so a scan holds the
 * phone's memory only while it runs. Throws the signal's reason when aborted.
 */
export async function readImageText(
  photo: Blob,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (progress: OcrProgress) => void } = {},
): Promise<string> {
  signal?.throwIfAborted();
  const Tesseract = await loadOcr();
  const image = await prepareImage(photo);
  signal?.throwIfAborted();
  const paths = ocrPaths(hasSimd());
  const worker = await Tesseract.createWorker(['deu', 'eng'], Tesseract.OEM.LSTM_ONLY, {
    workerPath: paths.workerPath,
    corePath: paths.corePath,
    langPath: paths.langPath,
    gzip: true,
    // The service worker keeps the files; a second copy in IndexedDB would only take the phone's space.
    cacheMethod: 'none',
    logger: (message) =>
      onProgress?.({ stage: message.status === 'recognizing text' ? 'reading' : 'loading', progress: message.progress }),
  });
  try {
    signal?.throwIfAborted();
    const reading = worker.recognize(image);
    if (signal === undefined) return (await reading).data.text;
    const aborted = new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
    );
    aborted.catch(() => undefined);
    return (await Promise.race([reading, aborted])).data.text;
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
