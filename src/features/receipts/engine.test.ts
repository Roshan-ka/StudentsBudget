import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OCR_DOWNLOAD_MB, shareOf } from './engine';
import { ocrPaths } from './ocr';
import { OCR_BASE } from './ocr-set';

// The scan card's engine: the download its note names, and one bar from the engine's stages.

describe('the receipt engine', () => {
  it('names the first scan’s download as the files add up: module, worker, the larger core and both languages', () => {
    const bytes = (path: string) => statSync(`public${path}`).size;
    const core = Math.max(...[true, false].map((simd) => bytes(ocrPaths(simd).corePath)));
    const { module, workerPath } = ocrPaths(true);
    const total = bytes(module) + bytes(workerPath) + core + bytes(`${OCR_BASE}/lang/deu.traineddata.gz`) + bytes(`${OCR_BASE}/lang/eng.traineddata.gz`);
    expect(Math.round(total / 100_000) / 10).toBe(OCR_DOWNLOAD_MB);
  });

  it('turns the stages into one bar that never goes back', () => {
    expect(shareOf({ stage: 'loading', progress: 0.5 }, 0)).toBeCloseTo(0.1);
    // A new loading step starts at 0 again: the bar stays where it was.
    expect(shareOf({ stage: 'loading', progress: 0 }, 0.2)).toBeCloseTo(0.2);
    expect(shareOf({ stage: 'reading', progress: 0 }, 0.2)).toBeCloseTo(0.2);
    expect(shareOf({ stage: 'reading', progress: 0.5 }, 0.2)).toBeCloseTo(0.6);
    expect(shareOf({ stage: 'reading', progress: 1 }, 0.6)).toBeCloseTo(1);
    expect(shareOf({ stage: 'reading', progress: 7 }, 0)).toBeCloseTo(1);
  });
});
