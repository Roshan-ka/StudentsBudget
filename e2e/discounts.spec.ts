import { expect, test, type Page } from '@playwright/test';
import { CATEGORIES } from '../src/data/categories';
import { DISCOUNTS, type Discount } from '../src/data/discounts';
import { TIPS } from '../src/data/tips';
import type { DiscountVote } from '../src/db/types';
import { formatDate } from '../src/lib/dates';
import { readStore } from './helpers/setup';

// 375 px, the narrowest phone the app is made for.
test.use({ viewport: { width: 375, height: 812 } });

const NAMES = new Map(CATEGORIES.map((c) => [c.id, c.name]));
const ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]));
/** With no votes, the list starts with the most recently checked, then in category order, then as written. */
const SORTED = [...DISCOUNTS].sort(
  (a, b) => b.checked.localeCompare(a.checked) || (ORDER.get(a.categoryId) ?? 0) - (ORDER.get(b.categoryId) ?? 0),
);
const FIRST = SORTED[0];
const LAST = SORTED[SORTED.length - 1];

/** Two weeks after the re-check: nothing may be outdated yet, and a vote today is newer than every check. */
const NOV_24 = new Date('2026-11-24T12:00:00');
/** Eight weeks after the latest check (the re-check of 10.11.2026), with no confirmation since. */
const JAN_5 = new Date('2027-01-05T12:00:00');

function switcher(page: Page) {
  return page.getByRole('tablist', { name: 'Tips, discounts, hacks or checklist', exact: true });
}

/** What a screen reader hears after a vote: the one status region inside the Discounts panel. */
function announced(page: Page) {
  return page.getByRole('tabpanel', { name: 'Discounts', exact: true }).getByRole('status');
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

function voteButton(page: Page, d: Discount, name: 'Still works' | 'Outdated') {
  return item(page, d)
    .getByRole('group', { name: `${d.place}: does it still work?`, exact: true })
    .getByRole('button', { name, exact: true });
}

/** "mensa.de": the source link's words. */
function hostOf(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
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
  await expect(page.getByRole('heading', { level: 2, name: 'Tips for Regensburg', exact: true })).toBeVisible();
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
  await openDiscounts(page, NOV_24);

  await expect(places(page)).toHaveText(SORTED.map((d) => d.place));
  await expect(chips(page).getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(discountList(page).getByText('May be outdated', { exact: true })).toHaveCount(0);

  const first = item(page, FIRST);
  for (const text of [FIRST.offer, FIRST.conditions, FIRST.address]) {
    await expect(first.getByText(text, { exact: true })).toBeVisible();
  }
  // Never confirmed since it was checked: the source line's date says it, not a second "Last confirmed" (review P6).
  await expect(first.getByText(/^Last confirmed/)).toHaveCount(0); // proof: no-repeated-date
  await expect(voteButton(page, FIRST, 'Still works')).toHaveAttribute('aria-pressed', 'false');
  await expect(voteButton(page, FIRST, 'Outdated')).toHaveAttribute('aria-pressed', 'false');

  // Where it comes from, in one small line, as on Tips: the host is the link.
  const link = first.getByRole('link', { name: hostOf(FIRST.url), exact: true });
  await expect(link).toHaveAttribute('href', FIRST.url);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await switcher(page).getByRole('tab', { name: 'Tips', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Tips', exact: true }).getByRole('listitem')).toHaveCount(TIPS.length);
  await expect(discountList(page)).toHaveCount(0);
});

test('a discount says where it comes from in one line, and votes with a thumbs-up and an Outdated button', async ({ page }) => {
  await openDiscounts(page, NOV_24);
  const first = item(page, FIRST);

  // One small line, as on Tips (Roshan, 16-11-2026): no fold-out to open first.
  const line = first.getByText(`Source: ${hostOf(FIRST.url)} · checked ${formatDate(FIRST.checked)}`, { exact: true });
  await expect(line).toBeVisible(); // proof: discount-source-line
  await expect(first.locator('details')).toHaveCount(0);
  // The source's own words stay with the link, for hover and screen readers.
  await expect(line.getByRole('link', { name: hostOf(FIRST.url), exact: true })).toHaveAttribute('title', FIRST.source);

  // "Still works" is a thumbs-up alone, named by its word, at least 44 px wide.
  const up = voteButton(page, FIRST, 'Still works');
  await expect(up.locator('svg')).toHaveCount(1); // proof: upvote-icon
  await expect(up).toHaveText(''); // proof: upvote-icon-only
  await expect(up).toHaveCSS('width', '44px'); // proof: upvote-size
  // "Outdated" shows its thumbs-down and its word.
  const down = voteButton(page, FIRST, 'Outdated');
  await expect(down).toHaveText('Outdated');
  await expect(down.locator('svg')).toHaveCount(1); // proof: outdated-icon
  // Side by side, on one row.
  const [upBox, downBox] = [await up.boundingBox(), await down.boundingBox()];
  expect(upBox && downBox && Math.abs(upBox.y + upBox.height / 2 - (downBox.y + downBox.height / 2))).toBeLessThan(2);
  expect(upBox && downBox && downBox.x > upBox.x).toBe(true);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a category chip shows only its discounts, and All shows every one again', async ({ page }) => {
  await openDiscounts(page, NOV_24);

  const categoryId = LAST.categoryId;
  const chip = chips(page).getByRole('button', { name: NAMES.get(categoryId) ?? categoryId, exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(places(page)).toHaveText(SORTED.filter((d) => d.categoryId === categoryId).map((d) => d.place));

  await chips(page).getByRole('button', { name: 'All', exact: true }).click();
  await expect(discountList(page).getByRole('listitem')).toHaveCount(DISCOUNTS.length);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a confirmed discount moves up with today\'s date, one marked as outdated sinks, and both survive a reload', async ({
  page,
}) => {
  await openDiscounts(page, NOV_24);
  const middle = SORTED.slice(1, -1).map((d) => d.place);

  await voteButton(page, LAST, 'Still works').click();
  await expect(voteButton(page, LAST, 'Still works')).toHaveAttribute('aria-pressed', 'true');
  await expect(places(page)).toHaveText([LAST.place, FIRST.place, ...middle]);
  await expect(item(page, LAST).getByText(`Last confirmed ${formatDate('2026-11-24')}`, { exact: true })).toBeVisible();
  // Focus moves with the discount, and a screen reader hears where it went.
  await expect(voteButton(page, LAST, 'Still works')).toBeFocused();
  await expect(announced(page)).toHaveText(`${LAST.place}: saved as still working. It moves up the list.`);

  await voteButton(page, FIRST, 'Outdated').click();
  await expect(voteButton(page, FIRST, 'Outdated')).toHaveAttribute('aria-pressed', 'true');
  await expect(places(page)).toHaveText([LAST.place, ...middle, FIRST.place]);
  await expect(item(page, FIRST).getByText(`You marked this as outdated on ${formatDate('2026-11-24')}.`, { exact: true })).toBeVisible();
  await expect(item(page, FIRST).getByText('Saved on this phone, and in your account once the phone is linked.', { exact: true })).toBeVisible();
  await expect(voteButton(page, FIRST, 'Outdated')).toBeFocused();
  await expect(announced(page)).toHaveText(`${FIRST.place}: saved as outdated. It moves down the list.`);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const expected: DiscountVote[] = [
    { discountId: FIRST.id, vote: 'outdated', on: '2026-11-24' },
    { discountId: LAST.id, vote: 'works', on: '2026-11-24' },
  ];
  await expect.poll(() => votes(page)).toEqual(expected.sort((a, b) => a.discountId.localeCompare(b.discountId)));

  await page.reload();
  await showDiscounts(page);
  await expect(places(page)).toHaveText([LAST.place, ...middle, FIRST.place]);
  await expect(voteButton(page, LAST, 'Still works')).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, LAST).getByText(`Last confirmed ${formatDate('2026-11-24')}`, { exact: true })).toBeVisible();
  await expect(voteButton(page, FIRST, 'Outdated')).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, FIRST).getByText(`You marked this as outdated on ${formatDate('2026-11-24')}.`, { exact: true })).toBeVisible();
  await expect(item(page, FIRST).getByText(/^Last confirmed/)).toHaveCount(0);
  // What was said about the votes before the reload is gone.
  await expect(discountList(page).getByText('Saved on this phone, and in your account once the phone is linked.', { exact: true })).toHaveCount(0);
});

test('after eight weeks without a confirmation every discount may be outdated, and tapping again changes the vote', async ({
  page,
}) => {
  await openDiscounts(page, JAN_5);
  await expect(discountList(page).getByText('May be outdated', { exact: true })).toHaveCount(DISCOUNTS.length);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // A confirmation today lifts it back to the top.
  await voteButton(page, LAST, 'Still works').click();
  await expect(places(page).first()).toHaveText(LAST.place);
  await expect(item(page, LAST).getByText(`Last confirmed ${formatDate('2027-01-05')}`, { exact: true })).toBeVisible();
  await expect(item(page, LAST).getByText('May be outdated', { exact: true })).toHaveCount(0);
  await expect(discountList(page).getByText('May be outdated', { exact: true })).toHaveCount(DISCOUNTS.length - 1);
  await expect(announced(page)).toHaveText(`${LAST.place}: saved as still working. It moves up the list.`);

  // Confirming it again, now that it is at the top, moves nothing, and says nothing about moving.
  await voteButton(page, LAST, 'Still works').click();
  await expect(announced(page)).toHaveText(`${LAST.place}: saved as still working.`);
  await expect(places(page).first()).toHaveText(LAST.place);

  // Changing your mind replaces the vote: it sinks below the ones that may be outdated.
  await voteButton(page, LAST, 'Outdated').click();
  await expect(voteButton(page, LAST, 'Outdated')).toHaveAttribute('aria-pressed', 'true');
  await expect(voteButton(page, LAST, 'Still works')).toHaveAttribute('aria-pressed', 'false');
  await expect(places(page).last()).toHaveText(LAST.place);
  await expect(item(page, LAST).getByText(`You marked this as outdated on ${formatDate('2027-01-05')}.`, { exact: true })).toBeVisible();
  await expect.poll(() => votes(page)).toEqual([{ discountId: LAST.id, vote: 'outdated', on: '2027-01-05' }]);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test.describe('on a phone set to German', () => {
  test.use({ locale: 'de-DE' });

  test('the discounts read in German, place names kept, and none is marked English', async ({ page }) => {
    await page.clock.setFixedTime(NOV_24);
    await page.goto('/tips');
    await expect(page.getByRole('heading', { level: 2, name: 'Tipps für Regensburg', exact: true })).toBeVisible();
    await page.getByRole('tablist', { name: 'Tipps, Rabatte, Hacks oder Checkliste', exact: true }).getByRole('tab', { name: 'Rabatte', exact: true }).click();
    const list = page.getByRole('list', { name: 'Rabatte', exact: true });
    await expect(list.getByRole('listitem')).toHaveCount(DISCOUNTS.length);

    // A place keeps its name, unless the name holds a common word.
    const westbad = list.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: 'Westbad', exact: true }) });
    await expect(westbad.getByText('4,60 € statt 7,20 € für 3 Stunden; 6,50 € statt 10 € für den ganzen Tag', { exact: true })).toBeVisible();
    await expect(list.getByRole('heading', { level: 3, name: 'Hallenbad Sportpark Ost', exact: true })).toBeVisible();
    // The source's own words, translated, are the source link's title.
    await expect(westbad.getByRole('link').and(westbad.getByTitle(/Preise Westbad/))).toBeVisible();
    await expect(list.locator('[lang="en"]')).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
