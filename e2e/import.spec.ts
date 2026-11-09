import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry } from '../src/db/types';
import { REVOLUT, SPARKASSE_CAMT } from '../src/features/import/fixtures';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';

// Settings → Import and export (docs/superpowers/plans/2026-11-09-csv-import-export.md): a bank statement in (chunk 7),
// the entries out as a CSV file for a spreadsheet, in the region's format (chunk 6). The statements are the unit tests'
// fixtures (src/features/import/fixtures.ts): Sparkasse 30.10.–04.11.2026, Revolut 01.–05.11.2026.

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

/** The day the import tests run on: after both fixtures' rows, with the plan made the same day (November). */
const IMPORT_DAY = new Date('2026-11-06T12:00:00');

/** Picks a statement file on the page, and waits until its bank and rows are shown. */
async function pickStatement(page: Page, name: string, bytes: Uint8Array, shown: string) {
  await page.getByLabel('Statement file (CSV)', { exact: true }).setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(bytes) });
  await expect(page.getByRole('status')).toHaveText(shown);
}

const importedEntries = async (page: Page) => (await readStore<Entry>(page, 'entries')).filter((entry) => entry.imported !== undefined);
const openingOf = async (page: Page, name: string) => (await readStore<Account>(page, 'accounts')).find((a) => a.name === name)?.openingMinor;

test('imports a Sparkasse statement into the default account, lists what it left out, and Undo takes it back', async ({ page }) => {
  await page.clock.setFixedTime(IMPORT_DAY);
  await seedSetup(page);
  await openApp(page, '/settings/import');
  const card = page.getByRole('region', { name: 'Import a bank statement', exact: true });

  await pickStatement(page, 'Umsaetze.csv', SPARKASSE_CAMT, 'Sparkasse: 6 rows, 30.10.2026 to 04.11.2026');
  // No account is named after the bank: the default one is chosen.
  const localBank = (await readStore<Account>(page, 'accounts')).find((a) => a.name === 'Local bank')!;
  await expect(card.getByRole('combobox', { name: 'Import into', exact: true })).toHaveValue(localBank.id);
  await card.getByRole('button', { name: 'Import', exact: true }).click();

  // The summary replaces the form, with the focus on its heading.
  await expect(card.getByRole('heading', { level: 4, name: 'Import finished', exact: true })).toBeFocused();
  // Rent, the cash withdrawal (a transfer to Cash) and the payment to Revolut, which has no account here.
  await expect(card.getByText('3 entries added, 1 of them a transfer.', { exact: true })).toBeVisible();
  // All three came before the accounts were added today: their starts move, so today's balances stay.
  await expect(card.getByText(/^The starting balance of Local bank moved by/)).toBeVisible();
  await expect(card.getByText(/^The starting balance of Cash moved by/)).toBeVisible();
  await expect(card.getByRole('heading', { level: 5, name: 'Left out (3)', exact: true })).toBeVisible();
  await expect(card.getByText('Still pending at the bank', { exact: true })).toBeVisible();
  await expect(card.getByText('From before your plan started', { exact: true })).toBeVisible();
  await expect(card.getByRole('listitem').filter({ hasText: 'REWE Markt GmbH' })).toHaveText(/^30\.10\.2026 · /);
  expect((await importedEntries(page)).map((entry) => [entry.date, entry.type, entry.amountMinor]).sort()).toEqual([
    ['2026-11-01', 'expense', 125000],
    ['2026-11-02', 'transfer', 5000],
    ['2026-11-04', 'expense', 10000],
  ]);
  expect(await openingOf(page, 'Local bank')).toBe(100000 + 140000);
  expect(await openingOf(page, 'Cash')).toBe(5000 - 5000);

  // Undo: the entries go, the starts come back, and the file can be picked again.
  await card.getByRole('button', { name: 'Undo this import', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Import undone: 3 entries removed.');
  await expect(card.getByLabel('Statement file (CSV)', { exact: true })).toBeFocused();
  expect(await importedEntries(page)).toEqual([]);
  expect(await openingOf(page, 'Local bank')).toBe(100000);
  expect(await openingOf(page, 'Cash')).toBe(5000);
});

test('adds nothing when the same statement is imported again: every row is already in the app', async ({ page }) => {
  await page.clock.setFixedTime(IMPORT_DAY);
  await seedSetup(page);
  await openApp(page, '/settings/import');
  const card = page.getByRole('region', { name: 'Import a bank statement', exact: true });

  await pickStatement(page, 'Umsaetze.csv', SPARKASSE_CAMT, 'Sparkasse: 6 rows, 30.10.2026 to 04.11.2026');
  await card.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(card.getByRole('heading', { level: 4, name: 'Import finished', exact: true })).toBeFocused();
  await card.getByRole('button', { name: 'Import another file', exact: true }).click();

  await pickStatement(page, 'Umsaetze.csv', SPARKASSE_CAMT, 'Sparkasse: 6 rows, 30.10.2026 to 04.11.2026');
  await card.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(card.getByText('Nothing new: every row was already in the app, or was left out.', { exact: true })).toBeVisible();
  await expect(card.getByText('Already in the app', { exact: true })).toBeVisible();
  // Nothing added, so nothing to undo.
  await expect(card.getByRole('button', { name: 'Undo this import', exact: true })).toHaveCount(0);
  expect(await importedEntries(page)).toHaveLength(3);
});

test('lists Revolut rows in another currency, moves inside Revolut and pending ones as left out', async ({ page }) => {
  await page.clock.setFixedTime(IMPORT_DAY);
  await seedSetup(page);
  await openApp(page, '/settings/import');
  const card = page.getByRole('region', { name: 'Import a bank statement', exact: true });

  await pickStatement(page, 'account-statement.csv', REVOLUT, 'Revolut: 9 rows, 01.11.2026 to 05.11.2026');
  await card.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(card.getByRole('heading', { level: 4, name: 'Import finished', exact: true })).toBeFocused();
  // Lieferando, and the cash withdrawal as a transfer to Cash.
  await expect(card.getByText('2 entries added, 1 of them a transfer.', { exact: true })).toBeVisible();
  const group = (reason: string) => card.getByText(reason, { exact: true }).locator('xpath=..');
  await expect(group("Not in the account's currency")).toContainText('Chai Point');
  await expect(group('A move inside the bank')).toContainText('Exchanged to INR');
  await expect(group('Still pending at the bank')).toContainText('Amazon');
  // The top-ups: no other euro bank account in the app for the money to come from.
  await expect(group('No account in the app to transfer to')).toContainText('Top-Up by');
});

test('says what is wrong with a file it cannot import', async ({ page }) => {
  await page.clock.setFixedTime(IMPORT_DAY);
  await seedSetup(page);
  await openApp(page, '/settings/import');
  const file = page.getByLabel('Statement file (CSV)', { exact: true });

  await file.setInputFiles({ name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('Datum;Text;Soll\n01.11.2026;Edeka;12,30\n') });
  // Inside the page: Next's route announcer (#__next-route-announcer__, outside <main>) is a role="alert" too.
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    "The app doesn't recognise this file's columns. Statements from Sparkasse, DKB, N26 and Revolut work.",
  );
  await expect(file).toHaveAttribute('aria-invalid', 'true');
});
