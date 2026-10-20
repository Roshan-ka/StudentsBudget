import { expect, test, type Page } from '@playwright/test';
import { CATEGORIES } from '../src/data/categories';
import { DISCOUNTS, type Discount } from '../src/data/discounts';
import { TIPS } from '../src/data/tips';
import type { DiscountVote } from '../src/db/types';
import { readStore } from './helpers/setup';

// 375 px, the narrowest phone the app is made for.
test.use({ viewport: { width: 375, height: 812 } });

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]));
/** Every discount was checked on the same day, so the list starts in category order, then as written. */
const SORTED = [...DISCOUNTS].sort((a, b) => (ORDER.get(a.categoryId) ?? 0) - (ORDER.get(b.categoryId) ?? 0));
const FIRST = SORTED[0];
const LAST = SORTED[SORTED.length - 1];

/** Two weeks after the check: nothing may be outdated yet, and a vote today is newer than the check. */
const NOV_2 = new Date('2026-11-02T12:00:00');
/** Eight weeks after the check, with no confirmation since. */
const DEC_15 = new Date('2026-12-15T12:00:00');

function switcher(page: Page) {
  return page.getByRole('tablist', { name: 'Tips or discounts', exact: true });
}

function discountList(page: Page) {
  return page.getByRole('list', { name: 'Discounts', exact: true });
}

function places(page: Page) {
  return discountList(page).getByRole('heading', { level: 3 });
}

function item(page: Page, d: Discount) {
  return discountList(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: d.place, exact: true }) });
}

function voteButton(page: Page, d: Discount, name: 'Still works' | "Doesn't work anymore") {
  return item(page, d)
    .getByRole('group', { name: `${d.place}: does it still work?`, exact: true })
    .getByRole('button', { name, exact: true });
}

function chips(page: Page) {
  return page.getByRole('group', { name: 'Show discounts for', exact: true });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Opens /tips on `at` and switches to Discounts. No plan is needed: the tips and discounts open without one. */
async function openDiscounts(page: Page, at: Date) {
  await page.clock.setFixedTime(at);
  await page.goto('/tips');
  await showDiscounts(page);
}

async function showDiscounts(page: Page) {
  await expect(page.getByRole('heading', { level: 2, name: 'Regensburg tips', exact: true })).toBeVisible();
  const tab = switcher(page).getByRole('tab', { name: 'Discounts', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(discountList(page).getByRole('listitem')).toHaveCount(DISCOUNTS.length);
}

async function votes(page: Page): Promise<DiscountVote[]> {
  const rows = await readStore<DiscountVote>(page, 'discountVotes');
  return rows.sort((a, b) => a.discountId.localeCompare(b.discountId));
}

test('the Tips tab switches to a sourced discount list and back', async ({ page }) => {
  await openDiscounts(page, NOV_2);

  await expect(places(page)).toHaveText(SORTED.map((d) => d.place));
  await expect(chips(page).getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(discountList(page).getByText('May be outdated', { exact: true })).toHaveCount(0);

  const first = item(page, FIRST);
  for (const text of [FIRST.offer, FIRST.conditions, FIRST.address, 'Last confirmed 20-10-2026']) {
    await expect(first.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(voteButton(page, FIRST, 'Still works')).toHaveAttribute('aria-pressed', 'false');
  await expect(voteButton(page, FIRST, "Doesn't work anymore")).toHaveAttribute('aria-pressed', 'false');

  // Where it comes from, collapsed until asked for.
  await expect(first.locator('details[open]')).toHaveCount(0);
  await first.getByText('Source', { exact: true }).click();
  await expect(first.getByText(FIRST.source, { exact: true })).toBeVisible();
  await expect(first.getByText('checked 20-10-2026', { exact: true })).toBeVisible();
  const link = first.getByRole('link', { name: new URL(FIRST.url).hostname.replace(/^www\./, ''), exact: true });
  await expect(link).toHaveAttribute('href', FIRST.url);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await switcher(page).getByRole('tab', { name: 'Tips', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Tips', exact: true }).getByRole('listitem')).toHaveCount(TIPS.length);
  await expect(discountList(page)).toHaveCount(0);
});

test('a category chip shows only its discounts, and All shows every one again', async ({ page }) => {
  await openDiscounts(page, NOV_2);

  const categoryId = LAST.categoryId;
  const chip = chips(page).getByRole('button', { name: NAMES.get(categoryId) ?? categoryId, exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(places(page)).toHaveText(SORTED.filter((d) => d.categoryId === categoryId).map((d) => d.place));

  await chips(page).getByRole('button', { name: 'All', exact: true }).click();
  await expect(discountList(page).getByRole('listitem')).toHaveCount(DISCOUNTS.length);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a confirmed discount moves up with today\'s date, one marked as not working sinks, and both survive a reload', async ({
  page,
}) => {
  await openDiscounts(page, NOV_2);
  const middle = SORTED.slice(1, -1).map((d) => d.place);

  await voteButton(page, LAST, 'Still works').click();
  await expect(voteButton(page, LAST, 'Still works')).toHaveAttribute('aria-pressed', 'true');
  await expect(places(page)).toHaveText([LAST.place, FIRST.place, ...middle]);
  await expect(item(page, LAST).getByText('Last confirmed 02-11-2026', { exact: true })).toBeVisible();
  // Focus moves with the discount, and a screen reader hears where it went.
  await expect(voteButton(page, LAST, 'Still works')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText(`${LAST.place}: saved as still working. It moves up the list.`);

  await voteButton(page, FIRST, "Doesn't work anymore").click();
  await expect(voteButton(page, FIRST, "Doesn't work anymore")).toHaveAttribute('aria-pressed', 'true');
  await expect(places(page)).toHaveText([LAST.place, ...middle, FIRST.place]);
  await expect(item(page, FIRST).getByText('You marked this as not working on 02-11-2026', { exact: true })).toBeVisible();
  await expect(item(page, FIRST).getByText('Saved on this phone.', { exact: true })).toBeVisible();
  await expect(voteButton(page, FIRST, "Doesn't work anymore")).toBeFocused();
  await expect(page.getByRole('status')).toHaveText(`${FIRST.place}: saved as not working. It moves down the list.`);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const expected: DiscountVote[] = [
    { discountId: FIRST.id, vote: 'outdated', on: '2026-11-02' },
    { discountId: LAST.id, vote: 'works', on: '2026-11-02' },
  ];
  await expect.poll(() => votes(page)).toEqual(expected.sort((a, b) => a.discountId.localeCompare(b.discountId)));

  await page.reload();
  await showDiscounts(page);
  await expect(places(page)).toHaveText([LAST.place, ...middle, FIRST.place]);
  await expect(voteButton(page, LAST, 'Still works')).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, LAST).getByText('Last confirmed 02-11-2026', { exact: true })).toBeVisible();
  await expect(voteButton(page, FIRST, "Doesn't work anymore")).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, FIRST).getByText('You marked this as not working on 02-11-2026', { exact: true })).toBeVisible();
  await expect(item(page, FIRST).getByText(/^Last confirmed/)).toHaveCount(0);
  // What was said about the votes before the reload is gone.
  await expect(discountList(page).getByText('Saved on this phone.', { exact: true })).toHaveCount(0);
});

test('after eight weeks without a confirmation every discount may be outdated, and tapping again changes the vote', async ({
  page,
}) => {
  await openDiscounts(page, DEC_15);
  await expect(discountList(page).getByText('May be outdated', { exact: true })).toHaveCount(DISCOUNTS.length);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // A confirmation today lifts it back to the top.
  await voteButton(page, LAST, 'Still works').click();
  await expect(places(page).first()).toHaveText(LAST.place);
  await expect(item(page, LAST).getByText('Last confirmed 15-12-2026', { exact: true })).toBeVisible();
  await expect(item(page, LAST).getByText('May be outdated', { exact: true })).toHaveCount(0);
  await expect(discountList(page).getByText('May be outdated', { exact: true })).toHaveCount(DISCOUNTS.length - 1);

  // Changing your mind replaces the vote: it sinks below the ones that may be outdated.
  await voteButton(page, LAST, "Doesn't work anymore").click();
  await expect(voteButton(page, LAST, "Doesn't work anymore")).toHaveAttribute('aria-pressed', 'true');
  await expect(voteButton(page, LAST, 'Still works')).toHaveAttribute('aria-pressed', 'false');
  await expect(places(page).last()).toHaveText(LAST.place);
  await expect(item(page, LAST).getByText('You marked this as not working on 15-12-2026', { exact: true })).toBeVisible();
  await expect.poll(() => votes(page)).toEqual([{ discountId: LAST.id, vote: 'outdated', on: '2026-12-15' }]);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
