import type { Page } from '@playwright/test';

// The receipt scan with the real engine (receipt scan, chunk 5, docs/superpowers/plans/2026-11-13-receipt-scan.md):
// a receipt drawn in the page, so Tesseract.js reads real print, and the steps around a scan. `receipt.spec.ts` keeps
// its stand-in engine; these are for the specs that read for real (`receipt-engine.spec.ts`, the offline check).

/**
 * A receipt the real engine reads reliably: large, high-contrast monospace print, as a phone photo of a clean receipt
 * would be. `readReceipt` takes the SUMME line's 12,34 as the total and REWE as the shop (Food & groceries).
 */
export const DRAWN_RECEIPT = ['REWE Markt', 'Brot           2,49', 'Milch          1,19', 'SUMME EUR     12,34', '14.11.2026  10:12'];

/** `lines` drawn black on white, as a PNG file the scan's picker takes. */
export async function drawnReceipt(page: Page, lines: readonly string[] = DRAWN_RECEIPT) {
  const base64 = await page.evaluate(async (text) => {
    const canvas = new OffscreenCanvas(960, 120 + text.length * 96);
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2d canvas to draw the receipt on.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = '56px monospace';
    context.textBaseline = 'top';
    text.forEach((line, at) => context.fillText(line, 48, 60 + at * 96));
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, [...lines]);
  return { name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

/** The note on the first scan's download, as seen already (`studentsbudget-receipt-note`, scan-receipt.tsx). */
export async function receiptNoteSeen(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('studentsbudget-receipt-note', 'seen');
    } catch {
      // A browser that blocks storage shows the note again; these tests don't run there.
    }
  });
}

/** Taps "Scan a receipt" and picks `photo` in the picker it opens. */
export async function scanPhoto(page: Page, photo: Awaited<ReturnType<typeof drawnReceipt>>) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Scan a receipt', exact: true }).click();
  await (await chooser).setFiles(photo);
}
