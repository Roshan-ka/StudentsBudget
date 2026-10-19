import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { mockFrankfurter, readStore } from './helpers/setup';

const demoFile = fileURLToPath(new URL('../fixtures/studentsbudget-demo-2026-10.json', import.meta.url));

test('the demo backup restores from setup and populates home, entries and charts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00+02:00'));
  await mockFrankfurter(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/setup');
  await page.getByLabel('File to restore').setInputFiles(demoFile);
  await expect(page.getByText('Replace all data on this device with the backup from 19 Oct?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes', exact: true }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Across all accounts: €3,613', { exact: true })).toBeVisible();
  expect(await readStore(page, 'entries')).toHaveLength(47);
  expect(await readStore(page, 'accounts')).toHaveLength(3);

  await page.goto('/entries');
  await expect(page.getByText('University books paid from home bank', { exact: true })).toBeVisible();
  await page.goto('/charts');
  await expect(page.getByRole('group', { name: 'Month', exact: true })).toContainText('October 2026');
  await expect(page.getByRole('table').first()).toBeVisible();
  expect(errors).toEqual([]);
});
