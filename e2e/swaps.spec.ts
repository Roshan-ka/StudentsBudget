import { expect, test, type Locator, type Page } from '@playwright/test';
import { SWAPS, type Swap } from '../src/data/swaps';
import { TIPS } from '../src/data/tips';
import { formatDate } from '../src/lib/dates';
import { seedSetup } from './helpers/seed-setup';

// 375 px, the narrowest phone the app is made for. `seedSetup` pins the clock to Friday 2026-10-16 and creates the
// plan that day: eating out 124 is planned in full (€124 this month), and the week Mon 12 - Sun 18 Oct has a third of
// it, with three weeks of October left (€41). Transport and going out are planned at €0.
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

/** The check-in's envelope cards for this week, by exact name. */
function weekAgainstPlan(page: Page) {
  return page.getByRole('region', { name: 'Envelopes this week', exact: true });
}

/** Any "Try this" line that is visible: a page the router has left stays mounted, but hidden. */
function anyTryThis(page: Page) {
  return page.getByRole('button', { name: /^Try this:/ });
}

/**
 * One source line of an opened swap, as on Tips (Roshan, 16-11-2026): what it covers ("Source for €3.80:", or just
 * "Source:" for one source), the host as its link and the checked date, with no fold-out. The link opens in a new tab,
 * carries the source's own words as its title, and is named by its host first, then what it is about.
 */
async function expectSource(details: Locator, lead: string, about: string, source: string, host: string, url: string) {
  await expect(details.locator('details')).toHaveCount(0);
  // By its link's name too: the linked tip's own source line can read the same (same host, same checked date).
  const named = details.getByRole('link', { name: `${host}, ${about}`, exact: true });
  const line = details
    .getByText(`${lead} ${host} · checked ${formatDate('2026-10-20')}`, { exact: true })
    .filter({ has: named });
  await expect(line).toBeVisible();
  const link = line.getByRole('link', { name: `${host}, ${about}`, exact: true });
  await expect(link).toHaveText(host);
  await expect(link).toHaveAttribute('href', url);
  await expect(link).toHaveAttribute('title', source);
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
  await seedSetup(page);
  await quickAdd(page, 'döner 150', 'Eating out');

  const mensa = swapById('mensa-instead-of-restaurant');
  const row = homeRow(page, 'Eating out');
  await expect(row.getByText('€26 over the €124 planned this month', { exact: true })).toBeVisible();

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
  await expectSource(details, 'Source for €14.50:', '€14.50', mensa.source, 'numbeo.com', mensa.url);
  await expectSource(
    details,
    'Source for €3.80:',
    '€3.80',
    required(mensa.toSource, 'toSource'),
    'stwno.de',
    required(mensa.toUrl, 'toUrl'),
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The check-in judges the row by this week's share: €150 against €41.
  await openCheckInFromHome(page);
  const checkInRow = weekAgainstPlan(page).getByRole('listitem').filter({ hasText: 'Eating out' });
  await expect(checkInRow.getByText('€150 of €41 · €109 over', { exact: true })).toBeVisible();
  const checkInLine = checkInRow.getByRole('button', { name: MENSA_LINE, exact: true });
  await expect(checkInLine).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await checkInLine.click();
  await expect(checkInRow.getByText(mensa.body, { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('nothing shows while every envelope is on track, or when the envelope over has no swap', async ({ page }) => {
  await seedSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out');
  await expect(homeRow(page, 'Eating out').getByText('€118 left of €124 this month', { exact: true })).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);

  // Food has no swap: over plan, it still gets no line.
  await quickAdd(page, 'Rewe 350', 'Food & groceries');
  await expect(
    homeRow(page, 'Food & groceries').getByText('€40 over the €310 planned this month', { exact: true }),
  ).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);

  await openCheckInFromHome(page);
  await expect(
    weekAgainstPlan(page)
      .getByRole('listitem')
      .filter({ hasText: 'Food & groceries' })
      .getByText('€350 of €103 · €247 over', { exact: true }),
  ).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);
});

test('past 90% of the plan early in the month counts, and the last 7 days of the month do not', async ({ page }) => {
  await seedSetup(page);
  // €115 of the €124 is 93%.
  await quickAdd(page, 'döner 115', 'Eating out');
  const row = homeRow(page, 'Eating out');
  await expect(row.getByText('€9 left of €124 this month', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: MENSA_LINE, exact: true })).toBeVisible();

  // Mon 26 Oct is one of the last 7 days: too late in the month for a suggestion on spending that is still on plan.
  await page.clock.setFixedTime(new Date(2026, 9, 26, 12, 0, 0));
  await page.reload();
  await expect(homeRow(page, 'Eating out').getByText('€9 left of €124 this month', { exact: true })).toBeVisible();
  await expect(anyTryThis(page)).toHaveCount(0);
});

test('an envelope planned at €0 that has spending gets its swap, and an estimate says so up front', async ({ page }) => {
  await seedSetup(page);
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

  await expectSource(details, 'Source for €34:', '€34', swap.source, 'bahn.de', swap.url);
  await expectSource(
    details,
    'Source for €22:',
    '€22',
    required(swap.toSource, 'toSource'),
    'rvv.de',
    required(swap.toUrl, 'toUrl'),
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a swap whose two amounts sit on one page shows a single source line', async ({ page }) => {
  await seedSetup(page);
  await quickAdd(page, 'film 20', 'Going out');

  const swap = swapById('cinema-student-price');
  const row = homeRow(page, 'Going out');
  await expect(row.getByText('€20 over the €0 planned this month', { exact: true })).toBeVisible();
  const line = row.getByRole('button', { name: FILM_LINE, exact: true });
  await expect(line).toBeVisible();

  await line.click();
  const details = row.getByRole('group', { name: `${swap.title} details`, exact: true });
  await expect(details.getByText(swap.body, { exact: true })).toBeVisible();
  await expect(details.getByText(/^Source for €/)).toHaveCount(0);
  await expectSource(
    details,
    'Source:',
    swap.title,
    swap.source,
    'kinos-im-andreasstadel.de',
    swap.url,
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
