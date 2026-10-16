import { expect, test } from '@playwright/test';

test('home shows the app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'StudentsBudget', exact: true })).toBeVisible();
});

test('manifest makes it installable', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('StudentsBudget');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
});
