import { expect, test, type Page } from '@playwright/test';
import type { Account } from '../src/db/types';
import { SETUP_DAY, mockFrankfurter, readStore } from './helpers/setup';

// 375 px, the narrowest phone the app is made for: the checks below read the page at that width.
test.use({ viewport: { width: 375, height: 812 } });

const OVERDRAWN = 'Overdrawn (below zero)';

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function nextStep(page: Page, heading: string) {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: heading })).toBeVisible();
}

/** Opens a new setup and moves to its Accounts step, with Frankfurter mocked and the clock pinned like the other specs. */
async function openAccountsStep(page: Page) {
  await mockFrankfurter(page);
  await page.clock.setFixedTime(SETUP_DAY);
  await page.goto('/setup');
  // The wizard renders once it has read the database, so the first heading proves the page is live.
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
  await nextStep(page, 'Accounts');
}

test('setup: the Accounts step with an overdrawn balance, a long name and an error fits a phone', async ({ page }) => {
  await openAccountsStep(page);
  const local = page.getByRole('group', { name: 'Account 1' });

  await local.getByLabel('Name', { exact: true }).fill('Overdraft at the Sparkasse');
  await local.getByLabel('Opening balance').fill('250');
  await local.getByRole('checkbox', { name: OVERDRAWN }).check();
  await expect(local.getByLabel('Opening balance')).toHaveValue('-250');
  await page.getByRole('button', { name: 'Add account' }).click();
  await expect(page.getByRole('group', { name: 'Account 4' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The error under the field, with the box below it.
  const cash = page.getByRole('group', { name: 'Account 3' });
  await cash.getByLabel('Opening balance').fill('abc');
  await cash.getByLabel('Opening balance').blur();
  await expect(cash.getByText('Enter a number, like 250 or 12.50.')).toBeVisible();
  await expect(cash.getByRole('checkbox', { name: OVERDRAWN })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('setup: a waiting Overdrawn tick stays with its row when a row above is removed', async ({ page }) => {
  await openAccountsStep(page);

  // Home bank (row 2): ticked on an empty field, so the box waits for an amount.
  const homeBox = page.getByRole('group', { name: 'Account 2' }).getByRole('checkbox', { name: OVERDRAWN });
  await homeBox.check();
  await expect(homeBox).toBeChecked();

  // Removing Local bank above it: Home bank becomes row 1 and keeps its tick; Cash, now row 2, never had one.
  await page.getByRole('button', { name: 'Remove account 1' }).click();
  const home = page.getByRole('group', { name: 'Account 1' });
  const cash = page.getByRole('group', { name: 'Account 2' });
  await expect(home.getByLabel('Name', { exact: true })).toHaveValue('Home bank');
  await expect(home.getByRole('checkbox', { name: OVERDRAWN })).toBeChecked();
  await expect(cash.getByLabel('Name', { exact: true })).toHaveValue('Cash');
  await expect(cash.getByRole('checkbox', { name: OVERDRAWN })).not.toBeChecked();

  // What is typed next goes to the row that was ticked, with its minus sign, and not to Cash.
  await home.getByLabel('Opening balance').fill('30');
  await expect(home.getByLabel('Opening balance')).toHaveValue('-30');
  await cash.getByLabel('Opening balance').fill('50');
  await expect(cash.getByLabel('Opening balance')).toHaveValue('50');
});

/**
 * Sets up a plan whose only answers are on the Accounts step: `fill` works on that step, every other step is left
 * blank (rent, income and costs all 0), and the plan is saved.
 */
async function setupWithAccounts(page: Page, fill: () => Promise<void>) {
  await openAccountsStep(page);
  await fill();
  for (const step of ['Income', 'Fixed costs', 'One-off costs', 'Guesses', 'Envelopes']) {
    await nextStep(page, step);
  }
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0);
}

test('setup: the Overdrawn box makes an opening balance negative, ticked after the amount or before it', async ({
  page,
}) => {
  await setupWithAccounts(page, async () => {
    const local = page.getByRole('group', { name: 'Account 1' });
    const cash = page.getByRole('group', { name: 'Account 3' });

    // The amount first, then the box: the field gets its minus sign.
    await local.getByLabel('Opening balance').fill('250');
    await local.getByRole('checkbox', { name: OVERDRAWN }).check();
    await expect(local.getByLabel('Opening balance')).toHaveValue('-250');

    // The box first, on an empty field: the first thing typed takes the sign. Clearing the box takes it off again.
    const cashBox = cash.getByRole('checkbox', { name: OVERDRAWN });
    await cashBox.check();
    await expect(cashBox).toBeChecked();
    await cash.getByLabel('Opening balance').fill('50');
    await expect(cash.getByLabel('Opening balance')).toHaveValue('-50');
    await cashBox.uncheck();
    await expect(cash.getByLabel('Opening balance')).toHaveValue('50');
    await expect(cashBox).not.toBeChecked();
  });

  const accounts = await readStore<Account>(page, 'accounts');
  expect(accounts.map((a) => [a.name, a.openingMinor]).sort()).toEqual([
    ['Cash', 5000],
    ['Home bank', 0],
    ['Local bank', -25000],
  ]);
  // Home reads the total as it is: €250 below zero and €50 in the wallet.
  await expect(page.getByText('Across all accounts: -€200', { exact: true })).toBeVisible();
});

test('setup: a typed minus sign is an overdrawn balance too, and the box follows the field', async ({ page }) => {
  await setupWithAccounts(page, async () => {
    const local = page.getByRole('group', { name: 'Account 1' });
    const opening = local.getByLabel('Opening balance');
    const box = local.getByRole('checkbox', { name: OVERDRAWN });

    await opening.fill('-250');
    await expect(box).toBeChecked();
    await opening.fill('250');
    await expect(box).not.toBeChecked();
    await opening.fill('-250');
    await expect(box).toBeChecked();
  });

  const [local] = (await readStore<Account>(page, 'accounts')).filter((a) => a.name === 'Local bank');
  expect(local.openingMinor).toBe(-25000);
  await expect(page.getByText('Across all accounts: -€250', { exact: true })).toBeVisible();
});

test('setup: text that is not an amount stops the Accounts step, a lone minus sign included', async ({ page }) => {
  await openAccountsStep(page);
  const opening = page.getByRole('group', { name: 'Account 1' }).getByLabel('Opening balance');
  const next = page.getByRole('button', { name: 'Next', exact: true });

  await opening.fill('abc');
  await next.click();
  await expect(inlineAlert(page)).toHaveText('Check the opening balance for Local bank.');
  await expect(page.getByText('Enter a number, like 250 or 12.50.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Accounts' })).toBeVisible();

  await opening.fill('-');
  await expect(inlineAlert(page)).toHaveText('Check the opening balance for Local bank.');

  await opening.fill('-5');
  await expect(inlineAlert(page)).toHaveCount(0);
  await nextStep(page, 'Income');
});

async function openSettings(page: Page) {
  await mockFrankfurter(page);
  await page.goto('/settings');
  // The empty-state text only renders once the page has hydrated and the live query has answered.
  await expect(page.getByText('No accounts yet')).toBeVisible();
}

test('Settings: an account can start overdrawn, with the box or a typed minus, and can be changed back', async ({
  page,
}) => {
  await openSettings(page);
  const row = (name: string) => page.getByRole('listitem').filter({ hasText: name });
  const opening = page.getByLabel('Opening balance');
  const box = page.getByRole('checkbox', { name: OVERDRAWN });

  // The box first, then the amount.
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Overdraft');
  await box.check();
  await expect(box).toBeChecked();
  await opening.fill('250');
  await expect(opening).toHaveValue('-250');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(row('Overdraft').getByText('-€250.00')).toBeVisible();

  // The form opens with the minus sign and the box ticked; clearing the box makes the balance positive.
  await page.getByRole('button', { name: 'Edit Overdraft', exact: true }).click();
  await expect(opening).toHaveValue('-250');
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(opening).toHaveValue('250');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(row('Overdraft').getByText('€250.00')).toBeVisible();
  await expect(row('Overdraft').getByText('-€250.00')).toHaveCount(0);

  // A typed minus sign works without the box, and the box shows it.
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Typed');
  await opening.fill('-75,50');
  await expect(box).toBeChecked();
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(row('Typed').getByText('-€75.50')).toBeVisible();

  const accounts = await readStore<Account>(page, 'accounts');
  expect(accounts.map((a) => [a.name, a.openingMinor]).sort()).toEqual([
    ['Overdraft', 25000],
    ['Typed', -7550],
  ]);
});

test('Settings: text that is not an amount is refused, a lone minus sign included', async ({ page }) => {
  await openSettings(page);

  for (const text of ['abc', '-', '--5']) {
    // A fresh form for every text: the error of the one before must be gone, or this would read it again.
    await page.getByRole('button', { name: 'Add account' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Odd');
    await page.getByLabel('Opening balance').fill(text);
    await page.getByRole('button', { name: 'Save account' }).click();
    await expect(inlineAlert(page), text).toHaveText('Enter the opening balance as a number, like 250 or 12.50.');

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(inlineAlert(page), text).toHaveCount(0);
  }
  expect(await readStore<Account>(page, 'accounts')).toHaveLength(0);
});

test('Settings: two accounts, the default mark and the Overdrawn box fit a phone without sideways scrolling', async ({
  page,
}) => {
  await openSettings(page);

  for (const [name, opening, overdrawn] of [
    ['Overdraft at the Sparkasse', '250', true],
    ['Wallet', '40', false],
  ] as const) {
    await page.getByRole('button', { name: 'Add account' }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Opening balance').fill(opening);
    if (overdrawn) await page.getByRole('checkbox', { name: OVERDRAWN }).check();
    await page.getByRole('button', { name: 'Save account' }).click();
    await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible();
  }

  // Both rows with their buttons, and the default mark in the meta line of the first.
  await expect(page.getByText('-€250.00', { exact: true })).toBeVisible();
  await expect(page.getByText('Default for new entries', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make default: Wallet', exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The form with its box and an error under the field.
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Odd');
  await page.getByLabel('Opening balance').fill('abc');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(inlineAlert(page)).toHaveText('Enter the opening balance as a number, like 250 or 12.50.');
  await expect(page.getByRole('checkbox', { name: OVERDRAWN })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
