import { expect, test } from '@playwright/test';
import type { Account, Entry, Plan } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// A plain-HTTP LAN address such as http://192.168.0.137:3100 is not a secure context, so the browser has no
// `crypto.randomUUID` there (it only exists on HTTPS and localhost) and the app crashed on setup. The page is
// served from localhost in this test, so the init script removes the function the way an insecure origin does.

const V4_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('setup, quick add and a new account work where crypto.randomUUID does not exist', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    delete (Crypto.prototype as { randomUUID?: unknown }).randomUUID;
  });

  // One automatic schedule line at least ("Add it automatically" stays on), which is saved with an id of its own.
  await completeSetup(page, {}, { schedules: true });
  expect(await page.evaluate(() => 'randomUUID' in crypto)).toBe(false);

  // Home: the first "döner" has no learned category, so quick add asks.
  await page.getByRole('textbox', { name: 'Quick add' }).fill('döner 6');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  // Settings: a new account.
  await page.goto('/settings');
  // Setup's accounts come from the live query, so the form's button is wired up once they show.
  await expect(page.getByText('Cash', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Savings');
  await page.getByLabel('Opening balance').fill('25');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByText('Savings', { exact: true })).toBeVisible();

  // The ids that were made without randomUUID are still version-4 UUIDs.
  const accounts = await readStore<Account>(page, 'accounts');
  expect(accounts).toHaveLength(4);
  const entries = await readStore<Entry>(page, 'entries');
  expect(entries).toHaveLength(1);
  // Schedules live on the plan's lines, one-off costs on the plan itself.
  const [plan] = await readStore<Plan>(page, 'plan');
  const schedules = [...plan.incomes, ...plan.fixed].flatMap((line) => (line.schedule ? [line.schedule] : []));
  expect(schedules.length).toBeGreaterThan(0);
  expect(plan.oneOffs).toHaveLength(1);
  for (const row of [...accounts, ...entries, ...schedules, ...plan.oneOffs]) expect(row.id).toMatch(V4_UUID);

  expect(pageErrors).toEqual([]);
});
