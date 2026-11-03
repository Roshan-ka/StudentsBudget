import { expect, test, type Page } from '@playwright/test';
import { horizontalOverflow } from './helpers/layout';
import { completeSetup } from './helpers/setup';

// The language picker (language switch, chunk 10). German is a draft: only the frame (the navigation, the page
// headings) and the picker are German so far, and `next dev` lists it before it is offered, so these run on a dev build.
test.use({ viewport: { width: 375, height: 812 } });

/** The picker, named in the language the page is in. A role, not a label: a hidden page keeps its labels. */
const picker = (page: Page) => page.getByRole('combobox', { name: /^(Language|Sprache)$/ });

const nav = (page: Page, name: string) => page.getByRole('navigation', { name, exact: true });

test('Settings switches the app to German and back, and the choice survives a reload', async ({ page }) => {
  await completeSetup(page);
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 2, name: 'Settings', exact: true })).toBeVisible();

  await picker(page).selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen', exact: true })).toBeVisible();
  await expect(nav(page, 'Hauptmenü').getByRole('link', { name: 'Optionen', exact: true })).toBeVisible();
  await expect(picker(page)).toHaveAccessibleName('Sprache');
  // The German labels still fit five side by side.
  expect(await horizontalOverflow(page)).toBe(0);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen', exact: true })).toBeVisible();
  await expect(picker(page)).toHaveValue('de');

  await picker(page).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 2, name: 'Settings', exact: true })).toBeVisible();
  await expect(nav(page, 'Main').getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
});

test('setup offers the language before anything else, each in its own words', async ({ page }) => {
  await page.goto('/setup');
  await expect(picker(page)).toBeVisible();
  // Each language by its own name; a draft says so.
  await expect(picker(page).locator('option[value="en"]')).toHaveText('English');
  await expect(picker(page).locator('option[value="de"]')).toHaveText(/^Deutsch/);
  await expect(picker(page).locator('option[value="de"]')).toHaveAttribute('lang', 'de');

  await picker(page).selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(picker(page)).toHaveAccessibleName('Sprache');
});
