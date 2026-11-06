import { expect, test } from '@playwright/test';
import { waitForApp } from './helpers/app';

test('home shows the app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'StudentsBudget', exact: true })).toBeVisible();
});

test('the app marks itself ready on <html> once it has started', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // A bare attribute on <html> alone: nothing a person or a screen reader meets carries it.
  expect(await page.locator('html').getAttribute('data-app-ready')).toBe('');
  await expect(page.locator('[data-app-ready]')).toHaveCount(1);
});

test('manifest makes it installable', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('StudentsBudget');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
});
