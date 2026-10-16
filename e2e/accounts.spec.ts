import { expect, test, type Page } from '@playwright/test';

const FRANKFURTER = '**/api.frankfurter.dev/**';

/** Answers like Frankfurter does, with INR at 95. The CORS header is what the real API sends. */
async function mockFrankfurter(page: Page) {
  await page.route(FRANKFURTER, (route) =>
    route.fulfill({
      json: { amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95 } },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
}

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
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();
  await expect(page.getByText('No accounts yet')).toBeVisible();

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
