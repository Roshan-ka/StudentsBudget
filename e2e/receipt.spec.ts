import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry } from '../src/db/types';
import { RECEIPTS } from '../src/features/receipts/fixtures';
import { OCR_BASE } from '../src/features/receipts/ocr-set';
import { formatDate } from '../src/lib/dates';
import { THEME_STORAGE_KEY } from '../src/theme/themes';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';

// Scan a receipt on Entries (receipt scan, chunk 4, docs/superpowers/plans/2026-11-13-receipt-scan.md). The text
// recognition is answered at the network, as mockAiFunction answers the AI: the engine's module in the reading set
// (`OCR_BASE`) is a stand-in that gives back what the test sets, so the card, the reader and the save run for real.

test.use({ viewport: { width: 375, height: 812 } });

/** The day the scans happen on: the fixture receipts are from the weeks before it. */
const SCAN_DAY = new Date('2026-11-16T12:00:00');

/** The REWE receipt of the reader's fixtures: €5.75 on 07.11.2026, Food & groceries. */
const REWE = RECEIPTS.find((receipt) => receipt.expected.shop === 'REWE')!;

/** A 1×1 PNG: the engine draws the photo on a canvas first, so it has to be a real image. */
const PHOTO = {
  name: 'receipt.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'),
};

/**
 * Tesseract.js as the engine loads it (`loadOcr`), standing in: its worker reports half the reading done, then gives
 * back the text in `globalThis.__receiptOcr` (`ocrReads`), fails, or never ends (`hang`, for Cancel).
 */
const ENGINE = `
export default {
  OEM: { LSTM_ONLY: 1 },
  createWorker: async (_langs, _oem, options) => ({
    recognize: async () => {
      const ocr = globalThis.__receiptOcr ?? { text: '' };
      options?.logger?.({ status: 'recognizing text', progress: 0.5 });
      if (ocr.hang) return new Promise(() => {});
      if (ocr.fail) throw new Error('The stand-in engine could not read this photo.');
      return { data: { text: ocr.text } };
    },
    terminate: async () => {},
  }),
};
`;

async function standInEngine(page: Page) {
  await page.route(`**${OCR_BASE}/tesseract.esm.min.js`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: ENGINE }),
  );
}

/** What the stand-in engine does with the next photo. */
async function ocrReads(page: Page, ocr: { text: string } | { fail: true } | { hang: true }) {
  await page.evaluate((value) => {
    (globalThis as { __receiptOcr?: unknown }).__receiptOcr = value;
  }, ocr);
}

/** The note on the first scan's download, as seen already. */
async function noteSeen(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('studentsbudget-receipt-note', 'seen');
    } catch {
      // A browser that blocks storage shows the note again; these tests don't run there.
    }
  });
}

/** A plan made on the scan day, the stand-in engine, and Entries open. */
async function openEntries(page: Page) {
  await page.clock.setFixedTime(SCAN_DAY);
  await standInEngine(page);
  await seedSetup(page);
  await openApp(page, '/entries');
}

const scanButton = (page: Page) => page.getByRole('button', { name: 'Scan a receipt', exact: true });
const checkCard = (page: Page) => page.getByRole('region', { name: 'Check the receipt', exact: true });
const entriesList = (page: Page) => page.getByRole('region', { name: 'Entries', exact: true });

/** Picks the photo from the picker that `open` opens. */
async function pickPhoto(page: Page, open: () => Promise<void>) {
  const chooser = page.waitForEvent('filechooser');
  await open();
  await (await chooser).setFiles(PHOTO);
}

test('the first scan says what it downloads once; Continue opens the picker from the same tap', async ({ page }) => {
  await openEntries(page);
  await ocrReads(page, { text: REWE.text });
  const note = page.getByRole('group', { name: 'Scan a receipt', exact: true });
  const text = 'Your first scan downloads the receipt reader once, about 8.4 MB. After that, scanning works offline.';

  await scanButton(page).click();
  await expect(note.getByText(text, { exact: true })).toBeFocused(); // proof: first-scan-note
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(scanButton(page)).toBeFocused();

  await scanButton(page).click();
  await pickPhoto(page, () => note.getByRole('button', { name: 'Continue', exact: true }).click());
  await expect(checkCard(page)).toBeVisible();

  // Seen once: the next scan opens the picker straight away.
  await checkCard(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await pickPhoto(page, () => scanButton(page).click());
  await expect(checkCard(page)).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('a read receipt fills the check card; an edit saves as an expense, with the Saved line and Undo', async ({ page }) => {
  await noteSeen(page);
  await openEntries(page);
  await ocrReads(page, { text: REWE.text });
  await pickPhoto(page, () => scanButton(page).click());

  const card = checkCard(page);
  await expect(card.getByRole('heading', { level: 3, name: 'Check the receipt', exact: true })).toBeFocused(); // proof: check-heading-focused
  await expect(card.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('5.75');
  await expect(card.getByRole('textbox', { name: 'Date', exact: true })).toHaveValue(formatDate('2026-11-07'));
  await expect(card.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('REWE');
  await expect(card.getByRole('button', { name: 'Food & groceries', exact: true })).toHaveAttribute('aria-pressed', 'true'); // proof: read-category-pressed
  const localBank = (await readStore<Account>(page, 'accounts')).find((account) => account.name === 'Local bank')!;
  await expect(card.getByRole('combobox', { name: 'Account', exact: true })).toHaveValue(localBank.id);

  // The student corrects the total, then saves.
  await card.getByRole('textbox', { name: 'Amount', exact: true }).fill('6.10');
  await card.getByRole('button', { name: 'Save expense', exact: true }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Saved €6.10 · REWE · Food & groceries · 07.11.2026' })).toBeVisible(); // proof: saved-line
  await expect(scanButton(page)).toBeFocused(); // proof: focus-back-after-save
  await expect(card).toHaveCount(0);
  const row = entriesList(page).getByRole('listitem').filter({ hasText: 'REWE' });
  await expect(row).toBeVisible();
  const saved = (await readStore<Entry>(page, 'entries')).find((entry) => entry.note === 'REWE');
  expect(saved).toMatchObject({ type: 'expense', amountMinor: 610, date: '2026-11-07', categoryId: 'food', accountId: localBank.id });

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(row).toHaveCount(0); // proof: undo-removes
  await expect(scanButton(page)).toBeFocused();
});

test("a receipt it couldn't read opens the card empty, and another photo can be tried", async ({ page }) => {
  await noteSeen(page);
  await openEntries(page);
  await ocrReads(page, { fail: true });
  await pickPhoto(page, () => scanButton(page).click());

  const card = page.getByRole('region', { name: 'Couldn’t read this receipt', exact: true });
  await expect(card.getByRole('heading', { level: 3, name: 'Couldn’t read this receipt', exact: true })).toBeFocused(); // proof: couldnt-read
  await expect(card.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('');
  await expect(card.getByRole('textbox', { name: 'Date', exact: true })).toHaveValue(formatDate('2026-11-16'));
  await expect(card.getByRole('button', { pressed: true })).toHaveCount(0);

  // Saving without a category says so, at the chips.
  await card.getByRole('textbox', { name: 'Amount', exact: true }).fill('4.20');
  await card.getByRole('button', { name: 'Save expense', exact: true }).click();
  await expect(card.getByRole('alert')).toHaveText('Pick a category.');

  await ocrReads(page, { text: REWE.text });
  await pickPhoto(page, () => card.getByRole('button', { name: 'Try another photo', exact: true }).click());
  await expect(checkCard(page).getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('5.75');
});

test('Cancel stops a scan while it reads, and Discard leaves nothing saved', async ({ page }) => {
  await noteSeen(page);
  await openEntries(page);
  await ocrReads(page, { hang: true });
  await pickPhoto(page, () => scanButton(page).click());

  const reading = page.getByRole('region', { name: 'Scan a receipt', exact: true });
  await expect(reading.getByRole('status')).toHaveText('Reading the receipt…');
  // The engine reported half the reading: the bar's first fifth is the loading, so 60 %.
  await expect(reading.getByRole('progressbar', { name: 'Reading progress', exact: true })).toHaveAttribute('aria-valuenow', '60'); // proof: progress-bar
  await reading.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(scanButton(page)).toBeFocused(); // proof: cancel-focus
  await expect(reading).toHaveCount(0);

  await ocrReads(page, { text: REWE.text });
  await pickPhoto(page, () => scanButton(page).click());
  await checkCard(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(scanButton(page)).toBeFocused();
  await expect(entriesList(page).getByRole('listitem').filter({ hasText: 'REWE' })).toHaveCount(0);
  expect((await readStore<Entry>(page, 'entries')).filter((entry) => entry.note === 'REWE')).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`the check card passes axe's WCAG AA checks in ${theme}`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Without storage the page stays light.
        }
      },
      [THEME_STORAGE_KEY, theme] as const,
    );
    await noteSeen(page);
    await openEntries(page);
    await ocrReads(page, { text: REWE.text });
    await pickPhoto(page, () => scanButton(page).click());
    await expect(checkCard(page)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blocking = results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
}
