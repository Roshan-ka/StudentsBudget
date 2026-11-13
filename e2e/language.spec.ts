import { expect, test, type Page } from '@playwright/test';
import { horizontalOverflow } from './helpers/layout';
import { seedSetup } from './helpers/seed-setup';

// The language picker (language switch, chunks 10 and 15) and a phone that is set to German. Every page in German at
// 375 px is language-tour.spec.ts, for a run with every language.
test.use({ viewport: { width: 375, height: 812 } });

/** The picker, named in the language the page is in. A role, not a label: a hidden page keeps its labels. */
const picker = (page: Page) => page.getByRole('combobox', { name: /^(Language|Sprache)$/ });
/** The header's globe on the start pages and setup (13-11-2026): a button that opens the languages as a menu. */
const globe = (page: Page) => page.getByRole('button', { name: /^(Language|Sprache)$/ });

const nav = (page: Page, name: string) => page.getByRole('navigation', { name, exact: true });

test('Settings switches the app to German and back, and the choice survives a reload', async ({ page }) => {
  // Setup, two switches and a reload: past 30 s on a cold dev server with every worker busy.
  test.setTimeout(60_000);
  await seedSetup(page);
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

test('setup offers the language in the header’s globe, each in its own words', async ({ page }) => {
  await page.goto('/setup');
  await globe(page).click();
  // Each language by its own name.
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: 'Deutsch', exact: true })).toHaveAttribute('lang', 'de');

  await page.getByRole('menuitemradio', { name: 'Deutsch', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(globe(page)).toHaveAccessibleName('Sprache');
  await expect(page.getByRole('heading', { level: 2, name: 'Richte deinen Plan ein', exact: true })).toBeVisible();
});

test.describe('a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('opens in German the first time, and keeps English once it is chosen', async ({ page }) => {
    await page.goto('/setup');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('heading', { level: 2, name: 'Richte deinen Plan ein', exact: true })).toBeVisible();

    await globe(page).click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Set up your plan', exact: true })).toBeVisible();
    // The choice wins over the phone's language.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 2, name: 'Set up your plan', exact: true })).toBeVisible();
  });
});
