import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry } from '../src/db/types';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';

// Settings → Import and export (docs/superpowers/plans/2026-11-09-csv-import-export.md). Chunk 6: the entries as a CSV
// file for a spreadsheet, in the region's format. The import's own tests join this spec with chunk 7.

test.use({ viewport: { width: 375, height: 812 } });

/** Writes entries straight into the phone's database, as the import or the entry form would have saved them. */
async function addEntries(page: Page, entries: Entry[]) {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction('entries', 'readwrite');
          for (const row of rows) transaction.objectStore('entries').add(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    entries,
  );
}

/** Takes the download path on every browser: some have a share sheet for files, some pretend to (as backup.spec.ts). */
async function withoutShareSheet(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
}

test('Settings lists the page, which says there is nothing to export before any entry', async ({ page }) => {
  await seedSetup(page);
  await openApp(page, '/settings');
  await page.getByRole('link', { name: /^Import and export/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Import and export', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Export to a spreadsheet', exact: true })).toBeVisible();
  await expect(page.getByText('There are no entries to export yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export entries', exact: true })).toHaveCount(0);
});

test('exports every entry as a CSV file in the region’s format: a BOM, `;`, a decimal comma and the day first', async ({ page }) => {
  await withoutShareSheet(page);
  await seedSetup(page);
  const account = (await readStore<Account>(page, 'accounts')).find((candidate) => candidate.currency === 'EUR')!;
  await addEntries(page, [
    {
      id: 'e2e-rent',
      type: 'expense',
      date: '2026-10-16',
      accountId: account.id,
      amountMinor: 45050,
      eurMinor: 45050,
      categoryId: 'rent',
      note: 'Miete; Oktober',
      createdAt: '2026-10-16T10:00:00.000Z',
    },
  ]);

  await openApp(page, '/settings/import');
  const exportButton = page.getByRole('button', { name: 'Export entries', exact: true });
  await expect(exportButton).toBeEnabled();
  const downloading = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe('studentsbudget-entries-2026-10-16.csv');
  await expect(page.getByRole('status')).toHaveText('Download started: studentsbudget-entries-2026-10-16.csv');
  const text = readFileSync(await download.path(), 'utf8');
  expect(text.startsWith('﻿')).toBe(true);
  expect(text.slice(1).split('\r\n')).toEqual([
    'Date;Entry type;Category;Account;Amount;Currency;Amount in EUR;Note',
    `16.10.2026;Expense;Rent;${account.name};450,50;${account.currency};450,50;"Miete; Oktober"`,
    '',
  ]);
});
