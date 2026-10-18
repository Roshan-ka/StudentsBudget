import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry } from '../src/db/types';
import { FRANKFURTER, completeSetup, mockFrankfurter, readStore } from './helpers/setup';

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

async function openSettings(page: Page) {
  await page.goto('/settings');
  // The empty-state text only renders once the page has hydrated and the live query has answered,
  // so clicking after it cannot hit the server-rendered buttons before React is listening.
  await expect(page.getByText('No accounts yet')).toBeVisible();
}

async function addAccount(
  page: Page,
  account: { name: string; currency: string; opening: string; kind?: 'bank' | 'cash' },
) {
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Name', { exact: true }).fill(account.name);
  await page.getByLabel('Type').selectOption(account.kind ?? 'bank');
  await page.getByLabel('Currency').selectOption(account.currency);
  await page.getByLabel('Opening balance').fill(account.opening);
  await page.getByRole('button', { name: 'Save account' }).click();
}

test('a new INR account shows its balance and the ECB rate', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();

  await addAccount(page, { name: 'Home bank', currency: 'INR', opening: '50000' });

  await expect(page.getByText('Home bank', { exact: true })).toBeVisible();
  await expect(page.getByText('50,000.00')).toBeVisible();
  await expect(page.getByText('1 € = 95 INR')).toBeVisible();
  await expect(page.getByText('ECB, 16 Oct')).toBeVisible();
});

test('without a rate the panel asks for one', async ({ page }) => {
  await page.route(FRANKFURTER, (route) => route.abort());
  await openSettings(page);

  await addAccount(page, { name: 'Home bank', currency: 'INR', opening: '50000' });

  await expect(page.getByText('50,000.00')).toBeVisible();
  await expect(page.getByText('No rate yet. Enter one to log INR spending.')).toBeVisible();
  await expect(page.getByText('Without INR: no exchange rate yet.')).toBeVisible();
  // Nothing could be converted, so there is no total to show; €0.00 would look like one.
  await expect(page.getByText('€0.00')).toHaveCount(0);
  await expect(page.getByText('—', { exact: true })).toBeVisible();
});

test('a manual rate replaces the ECB rate until the person switches back', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await addAccount(page, { name: 'Home bank', currency: 'INR', opening: '50000' });
  await expect(page.getByText('1 € = 95 INR · ECB, 16 Oct')).toBeVisible();

  await page.getByLabel('Your rate for INR per €1').fill('0');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(inlineAlert(page)).toHaveText('Enter a rate greater than zero, like 95.12.');

  await page.getByLabel('Your rate for INR per €1').fill('90,5');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('1 € = 90.5 INR · set by you')).toBeVisible();

  await page.getByRole('button', { name: 'Use ECB rate again' }).click();
  await expect(page.getByText('1 € = 95 INR · ECB, 16 Oct')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use ECB rate again' })).toHaveCount(0);
});

test('moving money updates both balances', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await addAccount(page, { name: 'Bank', currency: 'EUR', opening: '200' });
  await addAccount(page, { name: 'Home bank', currency: 'INR', opening: '50000' });
  await expect(page.getByText('50,000.00')).toBeVisible();

  await page.getByRole('button', { name: 'Move money between accounts' }).click();
  await page.getByLabel('Amount', { exact: true }).fill('50');
  await page.getByLabel('Amount received').fill('4750');
  await page.getByRole('button', { name: 'Move money', exact: true }).click();

  await expect(page.getByRole('status')).toHaveText('Transfer saved.');
  await expect(page.getByText('€150.00')).toBeVisible();
  await expect(page.getByText('54,750.00')).toBeVisible();
});

test('the transfer form starts with two different accounts and keeps them different', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await addAccount(page, { name: 'Bank', currency: 'EUR', opening: '200' });
  await addAccount(page, { name: 'Home bank', currency: 'INR', opening: '50000' });
  await page.getByRole('button', { name: 'Move money between accounts' }).click();

  const from = page.getByLabel('From', { exact: true });
  const to = page.getByLabel('To', { exact: true });
  await expect(from.locator('option:checked')).toHaveText('Bank (EUR)');
  await expect(to.locator('option:checked')).toHaveText('Home bank (INR)');

  // Picking the account that To shows moves To to the first other account, instead of leaving both the same.
  await from.selectOption({ label: 'Home bank (INR)' });
  await expect(to.locator('option:checked')).toHaveText('Bank (EUR)');
});

test('an account with entries cannot be deleted, an empty one can', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await addAccount(page, { name: 'Bank', currency: 'EUR', opening: '200' });
  await addAccount(page, { name: 'Wallet', currency: 'EUR', opening: '', kind: 'cash' });
  await expect(page.getByText('Wallet', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Move money between accounts' }).click();
  await page.getByLabel('Amount', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Move money', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Transfer saved.');

  await page.getByRole('button', { name: 'Delete Bank' }).click();
  await expect(inlineAlert(page)).toHaveText('This account has entries. Delete them first.');
  await expect(page.getByText('Bank', { exact: true })).toBeVisible();

  // Create and delete a third account that never received an entry.
  await addAccount(page, { name: 'Spare', currency: 'EUR', opening: '' });
  await page.getByRole('button', { name: 'Delete Spare' }).click();
  await expect(page.getByText('Spare', { exact: true })).toHaveCount(0);
});

test('the settings page fits a phone without sideways scrolling', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await addAccount(page, { name: 'Bank', currency: 'EUR', opening: '200' });
  await addAccount(page, { name: 'Home bank', currency: 'INR', opening: '50000' });
  await page.getByRole('button', { name: 'Move money between accounts' }).click();
  await expect(page.getByLabel('Amount received')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('accounts made in Settings before setup are kept, and setup adds none of its own', async ({ page }) => {
  await mockFrankfurter(page);
  await openSettings(page);
  await addAccount(page, { name: 'Wallet', currency: 'EUR', opening: '25', kind: 'cash' });
  await expect(page.getByText('Wallet', { exact: true })).toBeVisible();
  // Without a plan there is nothing to edit and nowhere to go yet: no Edit plan link, no bottom navigation.
  await expect(page.getByRole('link', { name: 'Edit plan' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

  await completeSetup(page, {}, { accountsExist: true });

  const accounts = await readStore<Account>(page, 'accounts');
  expect(accounts.map((a) => [a.name, a.currency, a.openingMinor])).toEqual([['Wallet', 'EUR', 2500]]);
  // With the plan saved, the navigation and the Edit plan link appear.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('link', { name: 'Edit plan' })).toBeVisible();
});

/** The Transfer tab of /entries/new, set to move money between the two euro accounts (no amount received to fill in). */
async function openEuroTransfer(page: Page) {
  await page.goto('/entries/new');
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await page.getByLabel('From', { exact: true }).selectOption({ label: 'Local bank (EUR)' });
  await page.getByLabel('To', { exact: true }).selectOption({ label: 'Cash (EUR)' });
}

test('a new transfer is dated the day it is saved, unless a date was picked', async ({ page }) => {
  await completeSetup(page);
  await openEuroTransfer(page);
  const date = page.getByLabel('Date', { exact: true });
  await expect(date).toHaveValue('2026-10-16');

  // The form stays open past midnight with no date picked: it is today's date that counts, not the one at mount.
  await page.clock.setFixedTime(new Date(2026, 9, 17, 0, 5, 0));
  await page.getByLabel('Amount', { exact: true }).fill('20');
  await expect(date).toHaveValue('2026-10-17');
  await page.getByRole('button', { name: 'Move money', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');

  // A date that was picked stays, whatever the clock does afterwards.
  await openEuroTransfer(page);
  await date.fill('2026-10-10');
  await page.clock.setFixedTime(new Date(2026, 9, 18, 0, 5, 0));
  await page.getByLabel('Amount', { exact: true }).fill('5');
  await expect(date).toHaveValue('2026-10-10');
  await page.getByRole('button', { name: 'Move money', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');

  const transfers = await readStore<Entry>(page, 'entries');
  expect(transfers.map((t) => [t.type, t.amountMinor, t.date]).sort()).toEqual([
    ['transfer', 2000, '2026-10-17'],
    ['transfer', 500, '2026-10-10'],
  ]);
});
