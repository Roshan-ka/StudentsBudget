import { expect, test, type Page } from '@playwright/test';
import type { Entry } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// `completeSetup` pins the clock to Friday 2026-10-16 and creates the plan that day, so the guesses unlock on
// Friday 2026-11-06 (21 days later). It guesses food 200, eating out 80, going out 60, transport 20, shopping 40
// and other 20 a month, and plans food 310 and eating out 124: October is planned in full, though the plan starts
// on the 16th.

/** Noon on a day, local time, as the clock the page should show. */
const noon = (iso: string) => new Date(`${iso}T12:00:00`);

/** Moves the browser's date to `date`, then logs one expense through quick add, so the entry is dated that day. */
async function logOn(page: Page, date: string, text: string, category: string, saved: string) {
  await page.clock.setFixedTime(noon(date));
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: category }).click();
  // Waiting for the line also waits for the entry to be in the database.
  await expect(page.getByRole('status')).toHaveText(saved);
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

function guessRows(page: Page) {
  return page.getByRole('list', { name: 'Your guesses' }).getByRole('listitem');
}

function recaps(page: Page) {
  return page.getByRole('list', { name: 'Month by month' }).getByRole('listitem');
}

test('before 21 days home and the reveal page say when the guesses unlock', async ({ page }) => {
  await completeSetup(page);

  const card = page.getByRole('region', { name: 'Your guesses' });
  await expect(card.getByText('Your guesses unlock on 6 Nov.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See how your guesses compare' })).toHaveCount(0);

  // A finger needs 44 px.
  const whatsThis = card.getByRole('link', { name: "What's this?" });
  const linkBox = await whatsThis.boundingBox();
  expect(linkBox?.height).toBeGreaterThanOrEqual(44);

  await whatsThis.click();
  await expect(page).toHaveURL('/reveal');
  await expect(page.getByRole('heading', { level: 2, name: 'Guess vs. reality' })).toBeVisible();
  await expect(page.getByText('Your guesses unlock on 6 Nov. Keep logging.', { exact: true })).toBeVisible();
  // Nothing to compare, and nothing to adjust yet; the setup month is still running, so no recap either.
  await expect(page.getByText(/You guessed/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Adjust my plan' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Month by month' })).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('on day 22 each guess shows next to what was spent, and the plan can be adjusted', async ({ page }) => {
  await completeSetup(page);
  await logOn(page, '2026-10-20', 'döner 60', 'Eating out', 'Saved €60.00 · döner · Eating out');
  await logOn(page, '2026-10-25', 'rewe 100', 'Food & groceries', 'Saved €100.00 · rewe · Food & groceries');
  // The clock really moved: both entries carry the day they were logged on.
  const dates = (await readStore<Entry>(page, 'entries')).map((entry) => entry.date).sort();
  expect(dates).toEqual(['2026-10-20', '2026-10-25']);

  // The day before the 6th it is still locked.
  await page.clock.setFixedTime(noon('2026-11-05'));
  await page.goto('/reveal');
  await expect(page.getByText('Your guesses unlock on 6 Nov. Keep logging.', { exact: true })).toBeVisible();
  await expect(page.getByText(/You guessed/)).toHaveCount(0);

  // On the 6th, home turns the card into the way in.
  await page.clock.setFixedTime(noon('2026-11-06'));
  await page.goto('/');
  await expect(page.getByText(/Your guesses unlock on/)).toHaveCount(0);
  await page.getByRole('link', { name: 'See how your guesses compare' }).click();
  await expect(page).toHaveURL('/reveal');

  // 16 Oct to 6 Nov is 22 days, so what was spent is scaled by 30 / 22:
  //   food          €100 -> 10000 x 30 / 22 = 13636.4 -> €136, a guess of €200 is €64 too high
  //   eating out     €60 ->  6000 x 30 / 22 =  8181.8 -> €82
  //   the other four have no spending: €0
  // Biggest difference first: food is €63.64 off, then going out €60, shopping €40, transport and other €20
  // each (a tie, so category order), and eating out, only €1.82 off its guess, last.
  await expect(guessRows(page)).toHaveText([
    /^Food & groceries\s*You guessed €200\. It was €136\.$/,
    /^Going out\s*You guessed €60\. It was €0\.$/,
    /^Shopping\s*You guessed €40\. It was €0\.$/,
    /^Transport\s*You guessed €20\. It was €0\.$/,
    /^Other\s*You guessed €20\. It was €0\.$/,
    /^Eating out\s*You guessed €80\. It was €82\.$/,
  ]);
  await expect(page.getByText('You guessed €80. It was €82.', { exact: true })).toBeVisible();
  await expect(page.getByText('Your spending from 16 Oct to 6 Nov, scaled to a month of 30 days.')).toBeVisible();
  await expect(page.getByText(/unlock on/)).toHaveCount(0);

  // October is over by 1 Nov: planned 31000 + 12400, spent 10000 + 6000, so €274 left over. The plan began on the 16th,
  // so the line says where the counting began and does not call the €274 savings. November is still running.
  await expect(recaps(page)).toHaveText(['October 2026 (counted from 16 Oct): €274 left over']);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const adjust = page.getByRole('link', { name: 'Adjust my plan' });
  await expect(adjust).toHaveAttribute('href', '/setup?edit=1');
  await adjust.click();
  await expect(page).toHaveURL('/setup?edit=1');
});

test('a finished month that went over its plan reads calmly, even before the guesses unlock', async ({ page }) => {
  await completeSetup(page);
  await logOn(page, '2026-10-20', 'döner 500', 'Eating out', 'Saved €500.00 · döner · Eating out');

  // 2 Nov: October is over, the guesses unlock in four days. Planned 43400, spent 50000: €66 over.
  await page.clock.setFixedTime(noon('2026-11-02'));
  await page.goto('/reveal');
  await expect(page.getByText('Your guesses unlock on 6 Nov. Keep logging.', { exact: true })).toBeVisible();
  await expect(recaps(page)).toHaveText(['October 2026 (counted from 16 Oct): €66 over plan']);
  await expect(page.getByText(/failed|warning/i)).toHaveCount(0);
});

test('a month after the setup month is planned from its 1st, so what is left of it is savings', async ({ page }) => {
  await completeSetup(page);

  // 2 Dec: October and November are over, and nothing was spent in either. Newest first.
  await page.clock.setFixedTime(noon('2026-12-02'));
  await page.goto('/reveal');
  await expect(recaps(page)).toHaveText([
    'November 2026: €434 left over → savings',
    'October 2026 (counted from 16 Oct): €434 left over',
  ]);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('without a plan the page points to setup', async ({ page }) => {
  await page.goto('/reveal');
  await expect(page.getByText('Set up your plan to compare your guesses with what you spend.')).toBeVisible();
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect(page).toHaveURL('/setup');
});
