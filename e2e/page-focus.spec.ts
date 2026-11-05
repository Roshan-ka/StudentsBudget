import { expect, test } from '@playwright/test';
import { completeSetup } from './helpers/setup';

// Accessibility, chunk 2 (docs/superpowers/plans/2026-11-05-accessibility.md): each page names itself in the browser's
// title, which Next's route announcer reads out, and after a page change the focus is on the new page's heading, not
// lost on a link of the page that was left.

/** A page's first visit compiles it in the dev server, which on CI can take longer than an expect's 5 s. */
const FIRST_VISIT = { timeout: 15_000 };

test('a page change puts the focus on the new page’s heading, and the title names the page', async ({ page }) => {
  await completeSetup(page);
  await expect(page).toHaveTitle('Home · StudentsBudget');
  const nav = page.getByRole('navigation', { name: 'Main' });

  await nav.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Settings', exact: true })).toBeFocused(FIRST_VISIT);
  await expect(page).toHaveTitle('Settings · StudentsBudget');

  await page.getByRole('link', { name: /^Profile/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Profile', exact: true })).toBeFocused(FIRST_VISIT);
  await expect(page).toHaveTitle('Profile · StudentsBudget');

  // Back again: the page the router kept takes the focus and the title back.
  await page.getByRole('link', { name: 'Back to Settings', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Settings', exact: true })).toBeFocused(FIRST_VISIT);
  await expect(page).toHaveTitle('Settings · StudentsBudget');

  await nav.getByRole('link', { name: 'Charts', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Charts', exact: true })).toBeFocused(FIRST_VISIT);

  // Home's heading is for screen readers and the title; the page shows what it is.
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Home', exact: true })).toBeFocused(FIRST_VISIT);
  await expect(page).toHaveTitle('Home · StudentsBudget');
});

test('the first load leaves the focus alone, and the title is in the phone’s language', async ({ page }) => {
  await completeSetup(page);
  await page.goto('/charts');
  await expect(page).toHaveTitle('Charts · StudentsBudget');
  await expect(page.getByRole('heading', { level: 2, name: 'Charts', exact: true })).not.toBeFocused();
});

test.describe('on a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('the title is in German', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Einstellungen · StudentsBudget');
  });
});
