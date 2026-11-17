import { expect, test, type Locator, type Page } from '@playwright/test';
import { MESSAGES } from '../src/i18n/messages';
import { THEME_COLORS } from '../src/theme/themes';
import { horizontalOverflow } from './helpers/layout';
import { PAGES } from './helpers/pages';
import { seedSetup } from './helpers/seed-setup';

// Settings → Appearance (redesign, chunk 9): light on a new phone, Dark or Same as phone by choice, kept on this phone
// and put on <html> before the first paint. Every page in dark at 375 px, too.
test.use({ viewport: { width: 375, height: 812 } });

const t = MESSAGES.en;
const DARK = /(^|\s)dark(\s|$)/;

const html = (page: Page) => page.locator('html');
const choice = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

async function openAppearance(page: Page) {
  await page.goto('/settings/appearance');
  await expect(page.getByRole('region', { name: t.theme.heading, exact: true })).toBeVisible();
}

test('a new phone is light; Dark stays after a reload, and Light comes back', async ({ page }) => {
  await seedSetup(page);
  await expect(html(page)).not.toHaveClass(DARK);
  await openAppearance(page);
  await expect(choice(page, t.theme.choices.light)).toBeChecked();

  await choice(page, t.theme.choices.dark).check();
  await expect(html(page)).toHaveClass(DARK);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.dark);

  // The head script puts it back before the first paint, on the one theme-color meta it owns.
  await page.reload();
  await expect(html(page)).toHaveClass(DARK);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.dark);
  await expect(choice(page, t.theme.choices.dark)).toBeChecked();

  await choice(page, t.theme.choices.light).check();
  await expect(html(page)).not.toHaveClass(DARK);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', THEME_COLORS.light);
});

// Three cards (group 4 redesign, Roshan's mockups, 17-11-2026), each with its tile: the chosen one has a heavier outline
// and a check icon, so it never says so by colour alone.
test('the choices are cards, and the chosen one has a heavier outline and a check', async ({ page }) => {
  await seedSetup(page);
  await openAppearance(page);
  const card = (name: string) => page.locator('label').filter({ has: choice(page, name) });
  const borderWidth = (label: Locator) => label.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  const light = card(t.theme.choices.light);
  const dark = card(t.theme.choices.dark);

  // The chosen card has its tile's icon and the check; the others only their tile's.
  await expect(light.locator('svg')).toHaveCount(2); // proof: chosen-check
  await expect(dark.locator('svg')).toHaveCount(1);
  await expect(light).toHaveCSS('border-top-style', 'solid');
  expect(await borderWidth(light)).toBeGreaterThan(await borderWidth(dark));

  // A tap anywhere on a card chooses it.
  await dark.click();
  await expect(choice(page, t.theme.choices.dark)).toBeChecked();
  await expect(dark.locator('svg')).toHaveCount(2);
  await expect(light.locator('svg')).toHaveCount(1);
  expect(await borderWidth(dark)).toBeGreaterThan(await borderWidth(light));
});

test('Same as phone follows the phone, also while the app is open', async ({ page }) => {
  await seedSetup(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await openAppearance(page);
  await choice(page, t.theme.choices.system).check();
  await expect(html(page)).not.toHaveClass(DARK);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html(page)).toHaveClass(DARK);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html(page)).not.toHaveClass(DARK);
});

test('a choice made in one tab reaches the app open in another', async ({ page, context }) => {
  await seedSetup(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('navigation', { name: t.shell.navLabel, exact: true })).toBeVisible();

  await openAppearance(page);
  await choice(page, t.theme.choices.dark).check();
  await expect(html(other)).toHaveClass(DARK);
});

test('every page fits 375 px in dark', async ({ page }) => {
  test.setTimeout(120_000);
  await seedSetup(page);
  await openAppearance(page);
  await choice(page, t.theme.choices.dark).check();

  for (const { path, shown } of PAGES) {
    await page.goto(path);
    await expect(html(page), path).toHaveClass(DARK);
    await expect(shown(page, t), path).toBeVisible();
    // What is shown above appears once the page has hydrated; what it reads from IndexedDB follows within moments.
    await page.waitForLoadState('networkidle');
    expect(await horizontalOverflow(page), path).toBe(0);
  }
});
