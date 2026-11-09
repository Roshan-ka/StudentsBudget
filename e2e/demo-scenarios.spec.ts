import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect as baseExpect, test } from '@playwright/test';
import { firstRunPath } from '../src/features/start/first-run';
import { collectPageErrors } from './helpers/page-errors';
import { FRANKFURTER, readStore } from './helpers/setup';
import { accountsShow } from './helpers/supabase';

const root = new URL('../fixtures/scenarios/', import.meta.url);
const expect = baseExpect.configure({ timeout: 20_000 });
test.use({ timezoneId: 'Europe/Berlin' });

for (const name of readdirSync(root).filter((name) => name.endsWith('.json'))) {
  test(`restore scenario: ${name}`, async ({ page }) => {
    test.setTimeout(90_000);
    const file = JSON.parse(readFileSync(new URL(name, root), 'utf8'));
    await page.clock.setFixedTime(new Date(file.exportedAt));
    // Preserve missing-rate and blocked-schedule states; a real online refresh can resolve them. Frankfurter v2
    // answers with a list of rows: an empty one means no new rates.
    await page.route(FRANKFURTER, (route) => route.fulfill({
      json: [],
      headers: { 'access-control-allow-origin': '*' },
    }));
    // A restore reloads '/'. Without a plan, Home sends the phone where `firstRunPath` says (the start page, 06-11-2026):
    // the start page while nobody is signed in, in a build with accounts (this config's server), or setup in a build
    // without them (a reused server). A restore signs nobody in.
    const noPlanPath = file.data.plan ? null : firstRunPath((await accountsShow(page)) ? 'signed-out' : 'off');
    const errors = collectPageErrors(page);
    await page.goto('/setup');
    await page.getByLabel('File to restore').setInputFiles(fileURLToPath(new URL(name, root)));
    await expect(page.getByRole('group', { name: 'Confirm restore' })).toContainText(name);
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Replace all data', exact: true }).click();
    await reloaded;
    await expect(page).toHaveURL(noPlanPath ?? '/', { timeout: 20_000 });
    await expect.poll(async () => (await readStore(page, 'accounts')).length).toBe(file.data.accounts.length);
    if (file.data.plan) {
      // Use the app's links: full reloads can abort an in-flight rate refresh in WebKit.
      const nav = page.getByRole('navigation', { name: 'Main', exact: true });
      await expect(page.getByRole('heading', { name: 'Left to spend this month', exact: true })).toBeVisible();
      for (const heading of ['Entries', 'Charts', 'Settings']) {
        await nav.getByRole('link', { name: heading, exact: true }).click();
        await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
      }
      if (name.startsWith('05')) {
        await page.getByRole('link', { name: /^Accounts and transfers/ }).click();
        await expect(page.getByText('No rate yet. Enter one to log TRY spending.', { exact: true })).toBeVisible();
      }
      await nav.getByRole('link', { name: 'Home', exact: true }).click();
      await page.getByRole('link', { name: /Weekly check-in/ }).click();
      await expect(page.getByRole('heading', { name: 'This week against your plan', exact: true })).toBeVisible();
      await nav.getByRole('link', { name: 'Home', exact: true }).click();
      // Home links to the month-by-month recaps once a month is over: only the year of history has one.
      const recaps = page.getByRole('link', { name: /^See how .* went$/ });
      if (name.startsWith('01')) {
        await recaps.click();
        await expect(page.getByRole('heading', { name: 'Month by month', exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: 'Left to spend this month', exact: true })).toBeVisible();
        await expect(recaps).toHaveCount(0);
      }
    } else {
      // Nothing on the phone: it starts over, through Continue as guest where the start page asks first.
      if (noPlanPath === '/start') {
        await page.getByRole('link', { name: 'Continue as guest', exact: true }).click();
        await expect(page).toHaveURL('/setup');
      }
      await expect(page.getByRole('heading', { level: 3, name: 'Accounts' })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
