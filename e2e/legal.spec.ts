import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers/app';
import { heading } from './helpers/pages';

// The legal pages (docs/superpowers/plans/2026-11-12-legal-pages.md, chunk 1): the privacy notice and the Impressum,
// reached from Settings and the start page, in German on a German phone and in English on any other (with a line on a
// French or Spanish one). The operator's details are whatever src/data/legal.ts holds, so no test reads them.

test.use({ viewport: { width: 375, height: 812 } });

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test('Settings leads to both pages, and Back returns there', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByRole('link', { name: /^Privacy notice/ }).click();
  await expect(heading(page, 'Privacy notice')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Controller', exact: true })).toBeVisible();
  // The notice (chunks 2 and 3): the phone's own storage and the rights always, and the sections of the map, the
  // account, the reminder and the AI, which the e2e build has.
  for (const name of [
    'What stays on your phone',
    'Hosting and server logs',
    'The map and your location',
    'Translate',
    'Your account and syncing',
    'Weekly reminder',
    'AI features (Anthropic)',
    'Your rights',
  ]) {
    await expect(page.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
  }
  await noSidewaysScroll(page);

  // Each page leads to the other.
  await page.getByRole('link', { name: 'Legal notice', exact: true }).click();
  await expect(heading(page, 'Legal notice (Impressum)')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Information under § 5 DDG (German Digital Services Act)', exact: true }),
  ).toBeVisible();
  await noSidewaysScroll(page);

  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(heading(page, 'Privacy notice')).toBeVisible();
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(heading(page, 'Settings')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Legal notice \(Impressum\)/ })).toBeVisible();
});

test('the start page links to both pages', async ({ page }) => {
  await openApp(page, '/start');
  const legal = page.getByRole('navigation', { name: 'Legal', exact: true });
  await legal.getByRole('link', { name: 'Privacy notice', exact: true }).click();
  await expect(heading(page, 'Privacy notice')).toBeVisible();
  await page.goBack();
  await page.getByRole('navigation', { name: 'Legal', exact: true }).getByRole('link', { name: 'Legal notice', exact: true }).click();
  await expect(heading(page, 'Legal notice (Impressum)')).toBeVisible();
});

test.describe('on a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('both pages are in German', async ({ page }) => {
    await openApp(page, '/impressum');
    await expect(heading(page, 'Impressum')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Angaben gemäß § 5 DDG', exact: true })).toBeVisible();
    await openApp(page, '/privacy');
    await expect(heading(page, 'Datenschutzerklärung')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Verantwortlich', exact: true })).toBeVisible();
    await expect(page.getByText('Diese Seite gibt es nur auf Deutsch und Englisch.', { exact: true })).toHaveCount(0);
    await noSidewaysScroll(page);
  });
});

test.describe('on a phone set to French', () => {
  test.use({ locale: 'fr-FR' });

  test('the page says it shows in English, and its text is marked English', async ({ page }) => {
    await openApp(page, '/privacy');
    await expect(heading(page, 'Politique de confidentialité')).toBeVisible();
    await expect(
      page.getByText('Cette page n’existe qu’en allemand et en anglais, elle s’affiche donc en anglais.', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('[lang="en"]').getByRole('heading', { level: 3, name: 'Controller', exact: true })).toBeVisible();
    await noSidewaysScroll(page);
  });
});
