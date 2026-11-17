import { expect, test, type Page } from '@playwright/test';
import type { Entry } from '../src/db/types';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';

// `seedSetup` pins the clock to Friday 2026-10-16 and creates the plan that day: food 310 and eating out 124 a month.
// The setup month counts whole, its plan and its spending (since 2026-11-06), so October reads like any other month.

/** Noon on a day, local time, as the clock the page should show. */
const noon = (iso: string) => new Date(`${iso}T12:00:00`);

/**
 * Moves the browser's date to `date`, then logs one expense through quick add, so the entry is dated that day. The
 * lines are on quick add's word list ("döner", "rewe"), so each saves under its category without asking.
 */
async function logOn(page: Page, date: string, text: string, saved: string) {
  await page.clock.setFixedTime(noon(date));
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // Waiting for the line also waits for the entry to be in the database.
  await expect(page.getByRole('status')).toHaveText(saved);
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Each month that is over, newest first: a section named by its month and year, with its big line. */
function months(page: Page) {
  return page.getByRole('region', { name: /^\S+ \d{4}$/ });
}

/** The months shown, in order, each with how it went: `[['October 2026', '€274 left over → savings']]`. */
async function expectRecaps(page: Page, expected: [month: string, line: string][]) {
  await expect(months(page)).toHaveCount(expected.length);
  for (const [i, [name, line]] of expected.entries()) {
    await expect(months(page).nth(i)).toHaveAccessibleName(name);
    await expect(months(page).nth(i).getByText(line, { exact: true })).toBeVisible();
  }
}

/** One envelope's card in a month's recap, found by its category's name. */
function envelope(page: Page, month: string, category: string) {
  return page
    .getByRole('region', { name: month, exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByText(category, { exact: true }) });
}

test('while the setup month runs, home has no recap line and the page says when the first comes', async ({ page }) => {
  await seedSetup(page);
  await expect(page.getByRole('link', { name: /^See how .* went$/ })).toHaveCount(0);

  await page.goto('/reveal');
  await expect(page.getByRole('heading', { level: 2, name: 'Month by month', exact: true })).toBeVisible();
  await expect(page.getByText('Your first recap comes once October is over.', { exact: true })).toBeVisible();
  await expect(months(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit envelopes' })).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('once October is over, home leads to its recap, and the envelopes can be changed from there', async ({ page }) => {
  await seedSetup(page);
  await logOn(page, '2026-10-20', 'döner 60', 'Saved €60.00 · döner · Eating out');
  await logOn(page, '2026-10-25', 'rewe 100', 'Saved €100.00 · rewe · Food & groceries');
  // The clock really moved: both entries carry the day they were logged on.
  const dates = (await readStore<Entry>(page, 'entries')).map((entry) => entry.date).sort();
  expect(dates).toEqual(['2026-10-20', '2026-10-25']);

  // 2 November: October is over. A quiet line on home, with a 44 px tap target.
  await page.clock.setFixedTime(noon('2026-11-02'));
  await page.goto('/');
  const link = page.getByRole('link', { name: 'See how October went', exact: true });
  const linkBox = await link.boundingBox();
  expect(linkBox?.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL('/reveal');

  // Planned 31000 + 12400, spent 10000 + 6000, so €274 left over, and savings: the setup month counts whole.
  // November is still running.
  await expectRecaps(page, [['October 2026', '€274 left over → savings']]);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const adjust = page.getByRole('link', { name: 'Edit envelopes', exact: true });
  await expect(adjust).toHaveAttribute('href', '/setup?edit=1&step=envelopes');
  await adjust.click();
  await expect(page).toHaveURL('/setup?edit=1&step=envelopes');
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes', exact: true })).toBeVisible();
});

test('a finished month that went over its plan reads calmly', async ({ page }) => {
  await seedSetup(page);
  await logOn(page, '2026-10-20', 'döner 500', 'Saved €500.00 · döner · Eating out');

  // 2 Nov: October is over. Planned 43400, spent 50000: €66 over.
  await page.clock.setFixedTime(noon('2026-11-02'));
  await page.goto('/reveal');
  await expectRecaps(page, [['October 2026', '€66 over plan']]);
  // The envelope that went over reads its numbers, in the same look as the others.
  await expect(envelope(page, 'October 2026', 'Eating out').getByText('€500 of €124', { exact: true })).toBeVisible();
  await expect(page.getByText(/failed|warning/i)).toHaveCount(0);
});

test('a finished month shows what was spent of its plan, and a card per envelope', async ({ page }) => {
  await seedSetup(page);
  await logOn(page, '2026-10-20', 'döner 60', 'Saved €60.00 · döner · Eating out');

  // 2 Nov: October is over. Planned 31000 + 12400, spent 6000 on eating out.
  await page.clock.setFixedTime(noon('2026-11-02'));
  await page.goto('/reveal');
  const october = page.getByRole('region', { name: 'October 2026', exact: true });
  await expect(october.getByText('€60 spent of €434', { exact: true })).toBeVisible(); // proof: recap-spent-of
  // Only the planned envelopes: those at €0 and never used add no card.
  await expect(october.getByRole('listitem')).toHaveCount(2);
  await expect(envelope(page, 'October 2026', 'Eating out').getByText('€60 of €124', { exact: true })).toBeVisible(); // proof: recap-envelope-line
  await expect(envelope(page, 'October 2026', 'Food & groceries').getByText('€0 of €310', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('every finished month reads alike, the setup month too: what is left of it is savings', async ({ page }) => {
  await seedSetup(page);

  // 2 Dec: October and November are over, and nothing was spent in either. Newest first, and home names November.
  await page.clock.setFixedTime(noon('2026-12-02'));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'See how November went', exact: true })).toBeVisible();
  await page.goto('/reveal');
  await expectRecaps(page, [
    ['November 2026', '€434 left over → savings'],
    ['October 2026', '€434 left over → savings'],
  ]);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('without a plan the page points to setup', async ({ page }) => {
  await page.goto('/reveal');
  await expect(page.getByText('Set up your plan to see how each month goes.')).toBeVisible();
  await page.getByRole('link', { name: 'Set up your plan', exact: true }).click();
  await expect(page).toHaveURL('/setup');
});
