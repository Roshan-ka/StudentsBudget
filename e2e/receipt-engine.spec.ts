import { expect, test, type Page } from '@playwright/test';
import { OCR_BASE } from '../src/features/receipts/ocr-set';
import { openApp } from './helpers/app';
import { drawnReceipt, receiptNoteSeen, scanPhoto } from './helpers/receipt';
import { seedSetup } from './helpers/seed-setup';

// The receipt scan with its real engine (receipt scan, chunk 5, docs/superpowers/plans/2026-11-13-receipt-scan.md):
// Tesseract.js from the app's own copy reads a receipt drawn in the page, under the production build's real
// Content-Security-Policy. `receipt.spec.ts` covers the card with a stand-in engine; this proves what it can't: that the
// engine's files are the ones the set ships, that its WebAssembly may run, and that nothing goes to another host.

/** The day of the scan: the drawn receipt is from two days before. */
const SCAN_DAY = new Date('2026-11-16T12:00:00');

/** Every CSP violation the page or the engine's worker reports, as security-headers.spec.ts watches them. */
async function watchViolations(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.exposeFunction('__reportCspViolation', (line: string) => {
    seen.push(line);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __reportCspViolation: (line: string) => void }).__reportCspViolation;
      report(`${event.effectiveDirective}: ${event.blockedURI} (${event.sourceFile}:${event.lineNumber})`);
    });
  });
  // The worker's own refusals (a blocked WebAssembly compile) reach the console only.
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) seen.push(`console: ${message.text()}`);
  });
  return seen;
}

test('the real engine reads a drawn receipt from the app’s own files, under the real policy', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'One real-engine run is enough: the iPhone is checked by hand');
  // Loading the engine (about 8.4 MB from the e2e server) and reading one receipt: in CI (run 43855516727, 16-11-2026,
  // two workers side by side) the amount showed under 5 s after the run began, setup included. 20 s for the reading and
  // 45 s for the test leave about four times that for a busy runner.
  test.setTimeout(45_000);
  const violations = await watchViolations(page);
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await receiptNoteSeen(page);
  await page.clock.setFixedTime(SCAN_DAY);
  await seedSetup(page);
  await openApp(page, '/entries');

  await scanPhoto(page, await drawnReceipt(page));

  const card = page.getByRole('region', { name: 'Check the receipt', exact: true });
  await expect(card.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('12.34', { timeout: 20_000 }); // proof: real-engine-reads
  // The note is the shop line as the receipt writes it (readReceipt keeps it whole), not the chain's name alone.
  await expect(card.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('REWE Markt');
  await expect(card.getByRole('button', { name: 'Food & groceries', exact: true })).toHaveAttribute('aria-pressed', 'true');

  expect(violations).toEqual([]);
  // The page loaded the engine from the set's folder, and asked no other host for anything. What the engine's worker
  // loads (the core, the languages) the policy keeps to this origin too: a request elsewhere would be a violation, and
  // the offline check finds those files in the worker's cache.
  const origin = new URL(page.url()).origin;
  expect(requested).toContain(`${origin}${OCR_BASE}/tesseract.esm.min.js`);
  expect(requested.filter((url) => !url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:'))).toEqual([]);
});
