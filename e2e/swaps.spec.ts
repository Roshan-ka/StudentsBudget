import { expect, test, type Locator, type Page } from '@playwright/test';
import { SWAPS, type Swap } from '../src/data/swaps';
import { TIPS } from '../src/data/tips';
import { completeSetup } from './helpers/setup';

// 375 px, the narrowest phone the app is made for. `completeSetup` pins the clock to Friday 2026-10-16 and creates the
// plan that day: eating out 124 is planned from the 16th (16 of 31 days, so €64 this month), and the week Mon 12 -
// Sun 18 Oct has three days of it (€12). Transport and going out are planned at €0.
test.use({ viewport: { width: 375, height: 812 } });

const MENSA_LINE = 'Try this: Eat at the Mensa instead of a restaurant · save about €10 per meal';
// The saving assumes one Bayern-Ticket day a month, so the line says it is an estimate before it is opened.
const TICKET_LINE = 'Try this: Book the Deutschlandticket for a month you travel · save about €12 per month (estimate)';
const FILM_LINE = 'Try this: See a film at the student price · save about €1 per ticket';

function swapById(id: string): Swap {
  const found = SWAPS.find((s) => s.id === id);
  if (!found) throw new Error(`no swap ${id}`);
  return found;
}

function required(value: string | undefined, what: string): string {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}

function envelopes(page: Page) {
  return page.getByRole('list', { name: 'Envelopes' });
}

/** A row of the Home envelope list, by its category name. */
function homeRow(page: Page, name: string) {
  return envelopes(page).getByRole('listitem').filter({ hasText: name });
}

/** By exact name: "This week" is also part of the name of the headline card on a home page the router keeps hidden. */
function weekAgainstPlan(page: Page) {
  return page.getByRole('region', { name: 'This week against your plan', exact: true });
}

/** Any "Try this" line that is visible: a page the router has left stays mounted, but hidden. */
function anyTryThis(page: Page) {
  return page.getByRole('button', { name: /^Try this:/ });
}

/** One collapsed source block of an opened swap, found by the words on its closed line, and opened. */
async function openSource(details: Locator, label: string): Promise<Locator> {
  const block = details.locator('details').filter({ has: details.page().getByText(label, { exact: true }) });
  await block.getByText(label, { exact: true }).click();
  return block;
}

/** The block's source text and checked date, and its link: opens in a new tab and says where it goes. */
async function expectSource(block: Locator, source: string, host: string, url: string) {
  await expect(block.getByText(source, { exact: true })).toBeVisible();
  await expect(block.getByText('checked 20-10-2026', { exact: true })).toBeVisible();
  const link = block.getByRole('link', { name: host, exact: true });
  await expect(link).toHaveAttribute('href', url);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
}

async function quickAdd(page: Page, text: string, category: string) {
  // By role, not label: a page the router has left stays mounted but hidden, with a field of the same name.
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // The first entry of a note has no learned category, so quick add asks.
  await page.getByRole('button', { name: category, exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`· ${category}`);
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openCheckInFromHome(page: Page) {
  await page.getByRole('link', { name: /^Weekly check-in/ }).click();
  await expect(page).toHaveURL('/check-in');
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly check-in' })).toBeVisible();
}

test('an eating-out envelope that runs over shows a sourced swap on Home and in the check-in', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 100', 'Eating out');

  const mensa = swapById('mensa-instead-of-restaurant');
  const row = homeRow(page, 'Eating out');
  await expect(row.getByText('€36 over the €64 planned this month', { exact: true })).toBeVisible();

  // One calm line under the row; nothing else asks for attention until it is tapped.
  const line = row.getByRole('button', { name: MENSA_LINE, exact: true });
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute('aria-expanded', 'false');
  await expect(anyTryThis(page)).toHaveCount(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Tapping it shows the body, where each amount comes from, and the tip it comes from.
  await line.click();
  await expect(line).toHaveAttribute('aria-expanded', 'true');
  const details = row.getByRole('group', { name: `${mensa.title} details`, exact: true });
  await expect(details.getByText(mensa.body, { exact: true })).toBeVisible();

  const tip = TIPS.find((t) => t.id === mensa.tipId);
  if (!tip) throw new Error('the Mensa swap names no tip');
  await expect(details.getByText(tip.title, { exact: true })).toBeVisible();
  await expect(details.getByText(tip.body, { exact: true })).toBeVisible();

  // Each amount has its own source, its own link and its own checked date.
  await expectSource(await openSource(details, 'Where €14.50 comes from'), mensa.source, 'numbeo.com', mensa.url);
  await expectSource(
    await openSource(details, 'Where €3.80 comes from'),
    required(mensa.toSource, 'toSource'),
    'stwno.de',
    required(mensa.toUrl, 'toUrl'),
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The check-in judges the row by this week's share: €100 against €12.
  await openCheckInFromHome(page);
  const checkInRow = weekAgainstPlan(page).getByRole('listitem').filter({ hasText: 'Eating out' });
  await expect(checkInRow.getByText('€12 planned · €100 spent · €88 over', { exact: true })).toBeVisible();
  const checkInLine = checkInRow.getByRole('button', { name: MENSA_LINE, exact: true });
  await expect(checkInLine).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await checkInLine.click();
  await expect(checkInRow.getByText(mensa.body, { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('nothing shows while every envelope is on track, or when the envelope over has no swap', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out');
  await expect(homeRow(page, 'Eating out').getByText('€58 left of €64 this month', { exact: true })).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);

  // Food has no swap: over plan, it still gets no line.
  await quickAdd(page, 'Rewe 200', 'Food & groceries');
  await expect(
    homeRow(page, 'Food & groceries').getByText('€40 over the €160 planned this month', { exact: true }),
  ).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);

  await openCheckInFromHome(page);
  await expect(
    weekAgainstPlan(page)
      .getByRole('listitem')
      .filter({ hasText: 'Food & groceries' })
      .getByText('€30 planned · €200 spent · €170 over', { exact: true }),
  ).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);
});

test('past 90% of the plan early in the month counts, and the last 7 days of the month do not', async ({ page }) => {
  await completeSetup(page);
  // €60 of the €64 is 94%.
  await quickAdd(page, 'döner 60', 'Eating out');
  const row = homeRow(page, 'Eating out');
  await expect(row.getByText('€4 left of €64 this month', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: MENSA_LINE, exact: true })).toBeVisible();

  // Mon 26 Oct is one of the last 7 days: too late in the month for a suggestion on spending that is still on plan.
  await page.clock.setFixedTime(new Date(2026, 9, 26, 12, 0, 0));
  await page.reload();
  await expect(homeRow(page, 'Eating out').getByText('€4 left of €64 this month', { exact: true })).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);
});

test('an envelope planned at €0 that has spending gets its swap, and an estimate says so up front', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'bus 15', 'Transport');

  const swap = swapById('deutschlandticket-for-travel-months');
  const row = homeRow(page, 'Transport');
  await expect(row.getByText('€15 over the €0 planned this month', { exact: true })).toBeVisible();
  const line = row.getByRole('button', { name: TICKET_LINE, exact: true });
  await expect(line).toBeVisible();

  await line.click();
  const details = row.getByRole('group', { name: `${swap.title} details`, exact: true });
  await expect(details.getByText(swap.body, { exact: true })).toBeVisible();
  // The assumption is in the body, before any source is opened.
  await expect(details.getByText(/^Estimate:/)).toBeVisible();

  await expectSource(await openSource(details, 'Where €34 comes from'), swap.source, 'bahn.de', swap.url);
  await expectSource(
    await openSource(details, 'Where €22 comes from'),
    required(swap.toSource, 'toSource'),
    'rvv.de',
    required(swap.toUrl, 'toUrl'),
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a swap whose two amounts sit on one page shows a single source block', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'film 20', 'Going out');

  const swap = swapById('cinema-student-price');
  const row = homeRow(page, 'Going out');
  await expect(row.getByText('€20 over the €0 planned this month', { exact: true })).toBeVisible();
  const line = row.getByRole('button', { name: FILM_LINE, exact: true });
  await expect(line).toBeVisible();

  await line.click();
  const details = row.getByRole('group', { name: `${swap.title} details`, exact: true });
  await expect(details.getByText(swap.body, { exact: true })).toBeVisible();
  await expect(details.getByText(/^Where €\d.* comes from$/)).toHaveCount(0);
  await expectSource(
    await openSource(details, 'Where these numbers come from'),
    swap.source,
    'kinos-im-andreasstadel.de',
    swap.url,
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
