import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect as baseExpect, test } from '@playwright/test';
import { FRANKFURTER, readStore } from './helpers/setup';

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
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/setup');
    await page.getByLabel('File to restore').setInputFiles(fileURLToPath(new URL(name, root)));
    await expect(page.getByRole('group', { name: 'Confirm restore' })).toContainText(name);
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Replace all data', exact: true }).click();
    await reloaded;
    await expect(page).toHaveURL(file.data.plan ? '/' : '/setup', { timeout: 20_000 });
    await expect.poll(async () => (await readStore(page, 'accounts')).length).toBe(file.data.accounts.length);
    if (file.data.plan) {
      // Use the app's links: full reloads can abort an in-flight rate refresh in WebKit.
      const nav = page.getByRole('navigation', { name: 'Main', exact: true });
      await expect(page.getByRole('heading', { name: 'Left to spend this month', exact: true })).toBeVisible();
      for (const heading of ['Entries', 'Charts', 'Settings']) {
        await nav.getByRole('link', { name: heading, exact: true }).click();
        await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
      }
      if (name.startsWith('05')) await expect(page.getByText('No rate yet. Enter one to log TRY spending.', { exact: true })).toBeVisible();
      await nav.getByRole('link', { name: 'Home', exact: true }).click();
      await page.getByRole('link', { name: /Weekly check-in/ }).click();
      await expect(page.getByRole('heading', { name: 'This week against your plan', exact: true })).toBeVisible();
      await nav.getByRole('link', { name: 'Home', exact: true }).click();
      await page.locator('a[href="/reveal"]:visible').click();
      await expect(page.getByRole('heading', { name: 'Guess vs. reality', exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'City and rent' })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
