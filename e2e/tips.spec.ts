import { expect, test, type Page } from '@playwright/test';
import { CATEGORIES } from '../src/data/categories';
import { TIPS } from '../src/data/tips';
import { completeSetup } from './helpers/setup';

// 375 px, the narrowest phone the app is made for: five tabs and the category chips have to fit.
test.use({ viewport: { width: 375, height: 812 } });

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]));
/** The tips in the order the page shows them: category order, then as written. */
const SORTED = [...TIPS].sort((a, b) => (ORDER.get(a.categoryId) ?? 0) - (ORDER.get(b.categoryId) ?? 0));

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' });
}

function tipList(page: Page) {
  return page.getByRole('list', { name: 'Tips', exact: true });
}

function chips(page: Page) {
  return page.getByRole('group', { name: 'Show tips for' });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openTips(page: Page) {
  await completeSetup(page);
  await mainNav(page).getByRole('link', { name: 'Tips', exact: true }).click();
  await expect(page).toHaveURL('/tips');
  await expect(page.getByRole('heading', { level: 2, name: 'Regensburg tips', exact: true })).toBeVisible();
}

test('the Tips tab sits between Charts and Settings and lists every tip', async ({ page }) => {
  await openTips(page);

  const nav = mainNav(page);
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Entries', 'Charts', 'Tips', 'Settings']);
  await expect(nav.getByRole('link', { name: 'Tips', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(tipList(page).getByRole('listitem')).toHaveCount(TIPS.length);
  await expect(tipList(page).getByRole('heading', { level: 3 })).toHaveText(SORTED.map((t) => t.title));
  await expect(chips(page).getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a category chip shows only its tips, and All shows every tip again', async ({ page }) => {
  await openTips(page);

  const categoryId = SORTED[0].categoryId;
  const name = NAMES.get(categoryId) ?? categoryId;
  const inCategory = SORTED.filter((t) => t.categoryId === categoryId);

  const chip = chips(page).getByRole('button', { name, exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chips(page).getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(tipList(page).getByRole('heading', { level: 3 })).toHaveText(inCategory.map((t) => t.title));

  await chips(page).getByRole('button', { name: 'All', exact: true }).click();
  await expect(tipList(page).getByRole('listitem')).toHaveCount(TIPS.length);
});

test('the other categories sit behind More, and folding it away goes back to All', async ({ page }) => {
  await openTips(page);

  const more = chips(page).getByRole('button', { name: 'More', exact: true });
  const rent = chips(page).getByRole('button', { name: 'Rent', exact: true });
  await expect(rent).toHaveCount(0);

  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await rent.click();
  await expect(tipList(page).getByRole('heading', { level: 3 })).toHaveText(
    SORTED.filter((t) => t.categoryId === 'rent').map((t) => t.title),
  );

  await more.click();
  await expect(rent).toHaveCount(0);
  await expect(chips(page).getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(tipList(page).getByRole('listitem')).toHaveCount(TIPS.length);
});

test('a tip shows where it comes from, collapsed until asked for', async ({ page }) => {
  await openTips(page);

  const tip = SORTED[0];
  const item = tipList(page).getByRole('listitem').first();
  await expect(item.locator('details[open]')).toHaveCount(0);

  await item.getByText('Source', { exact: true }).click();
  await expect(item.getByText(tip.source, { exact: true })).toBeVisible();
  await expect(item.getByText(`checked ${tip.checked.split('-').reverse().join('-')}`, { exact: true })).toBeVisible();
  const link = item.getByRole('link', { name: new URL(tip.url).hostname.replace(/^www\./, ''), exact: true });
  await expect(link).toHaveAttribute('href', tip.url);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the tips open without a plan, and the nav stays hidden until setup', async ({ page }) => {
  await page.goto('/tips');
  await expect(page.getByRole('heading', { level: 2, name: 'Regensburg tips', exact: true })).toBeVisible();
  await expect(tipList(page).getByRole('listitem')).toHaveCount(TIPS.length);
  await expect(mainNav(page)).toHaveCount(0);
});
