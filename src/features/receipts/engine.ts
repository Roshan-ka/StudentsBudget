import { readImageText, type OcrProgress } from './ocr';
import type { ReceiptEngine } from './scan';

// The scan card's engine (chunk 4): chunk 1's `readImageText`, with its stages turned into one bar.

/**
 * What the first scan downloads, in MB: the module, the worker, the larger of the two core builds and the German and
 * English data, rounded to a tenth (`engine.test.ts` adds up the files, so a new set changes it).
 */
export const OCR_DOWNLOAD_MB = 8.4;

/** The bar's share for loading the files: the first scan's download, then a quick start on later scans. */
const LOADING_SHARE = 0.2;

/**
 * One bar from the engine's stages: each loading step runs 0 to 1 in the first fifth, the reading 0 to 1 over the
 * rest. Never back: a new loading step starts at 0 again, and the bar waits until it has gone past where it was.
 */
export function shareOf({ stage, progress }: OcrProgress, last: number): number {
  const done = Math.min(Math.max(progress, 0), 1);
  const share = stage === 'loading' ? LOADING_SHARE * done : LOADING_SHARE + (1 - LOADING_SHARE) * done;
  return Math.max(last, share);
}

/** Reads a receipt photo on the phone, for the scan card. */
export const receiptEngine: ReceiptEngine = {
  downloadMb: OCR_DOWNLOAD_MB,
  read: (image, { signal, onProgress }) => {
    let last = 0;
    return readImageText(image, {
      signal,
      onProgress: (progress) => {
        last = shareOf(progress, last);
        onProgress(last);
      },
    });
  },
};
