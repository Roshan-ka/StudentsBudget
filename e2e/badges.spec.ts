import { expect, test, type Page } from '@playwright/test';
import type { Account, WeekResult } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// `completeSetup` creates the plan on Friday 16 October 2026: food €310 and eating out €124 a month. The seed
// below logs groceries by hand in each of the five weeks after that. The third week (26 October - 1 November,
// split by the month) plans €98.46 and gets €200 of groceries, so it is the only one over its plan.

/** Noon on a local calendar day; month is 1-12. */
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12, 0, 0);

/** Recording waits for the rate refresh and the recurring posting; Frankfurter is mocked, so this is generous. */
const RECORDING = { timeout: 15_000 };

const SEED: [string, number][] = [
  ['2026-10-17', 1000],
  ['2026-10-20', 2000],
  ['2026-10-28', 20000],
  ['2026-11-03', 1500],
  ['2026-11-10', 1200],
];

/** Puts rows straight into IndexedDB, as entries typed in on those days would be there. */
async function putEntries(page: Page, entries: unknown[]) {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction('entries', 'readwrite');
          for (const row of rows) transaction.objectStore('entries').put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    entries,
  );
}

async function seedFiveWeeks(page: Page) {
  const accountId = (await readStore<Account>(page, 'accounts')).find((a) => a.name === 'Cash')?.id;
  await putEntries(
    page,
    SEED.map(([date, eurMinor], i) => ({
      id: `seed-${i}`,
      type: 'expense',
      date,
      accountId,
      amountMinor: eurMinor,
      eurMinor,
      categoryId: 'food',
      note: 'Rewe',
      // Typed in on the day itself.
      createdAt: `${date}T10:00:00.000Z`,
    })),
  );
}

/** One badge on /badges, found by its heading. */
function badge(page: Page, title: string) {
  return page
    .getByRole('list', { name: 'Your badges', exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('five finished weeks show on Home and earn the bronze Under-Budget Week', async ({ page }) => {
  await completeSetup(page);
  await seedFiveWeeks(page);
  // Monday 16 November: five weeks are over, and the app records them when it opens.
  await page.clock.setFixedTime(on(2026, 11, 16));
  await page.reload();

  const card = page.getByRole('region', { name: 'Badges', exact: true });
  await expect(card.getByText('3 of 4 earned', { exact: true })).toBeVisible(RECORDING);
  await expect(card.getByText('Next: Latte Survivor', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const weeks = await readStore<WeekResult>(page, 'weekResults');
  expect(weeks.map((w) => [w.weekStart, w.spentMinor <= w.plannedMinor, w.paused]).sort()).toEqual([
    ['2026-10-12', true, false],
    ['2026-10-19', true, false],
    ['2026-10-26', false, false],
    ['2026-11-02', true, false],
    ['2026-11-09', true, false],
  ]);

  await card.getByRole('link', { name: 'See all badges', exact: true }).click();
  await expect(page).toHaveURL('/badges');
  await expect(page.getByRole('heading', { level: 2, name: 'Badges', exact: true })).toBeVisible();

  const underBudget = badge(page, 'Under-Budget Week');
  await expect(underBudget.getByText('Bronze · earned 15-11-2026', { exact: true })).toBeVisible();
  await expect(underBudget.getByText('4 of 12 weeks', { exact: true })).toBeVisible();
  await expect(badge(page, 'Logging Streak').getByText('Earned 08-11-2026', { exact: true })).toBeVisible();
  await expect(badge(page, 'Logging Streak').getByText('5 weeks in a row', { exact: true })).toBeVisible();
  await expect(badge(page, 'Ramen Royalty').getByText('Earned 08-11-2026', { exact: true })).toBeVisible();
  await expect(badge(page, 'Latte Survivor').getByText('Not earned yet', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('"I was away this week" is saved and keeps the logging streak waiting', async ({ page }) => {
  await completeSetup(page);
  await seedFiveWeeks(page);
  // Wednesday 18 November, a week with nothing logged.
  await page.clock.setFixedTime(on(2026, 11, 18));
  await page.goto('/check-in');

  const away = page.getByRole('switch', { name: 'I was away this week', exact: true });
  await expect(away).not.toBeChecked();
  await away.click();
  await expect(away).toBeChecked();

  // Saved, not just shown: a reload keeps it, and so does Home and back, where the router keeps the page mounted.
  await page.reload();
  await expect(away).toBeChecked();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goBack();
  await expect(page).toHaveURL('/check-in');
  await expect(away).toBeChecked();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The week is still running: only the note is saved.
  const note = (await readStore<WeekResult>(page, 'weekResults')).find((w) => w.weekStart === '2026-11-16');
  expect(note).toMatchObject({ weekEnd: '2026-11-22', paused: true, recordedAt: '' });

  // The next Monday the week is recorded as a week away, and the streak of five waits instead of starting over.
  await page.clock.setFixedTime(on(2026, 11, 23));
  await page.goto('/badges');
  const streak = badge(page, 'Logging Streak');
  await expect(streak.getByText('Your streak is paused at 5 weeks', { exact: true })).toBeVisible(RECORDING);

  const recorded = (await readStore<WeekResult>(page, 'weekResults')).find((w) => w.weekStart === '2026-11-16');
  expect(recorded).toMatchObject({ paused: true, handLoggedCount: 0 });
  expect(recorded?.recordedAt).not.toBe('');

  // The new week starts without the mark.
  await page.goto('/check-in');
  await expect(page.getByRole('switch', { name: 'I was away this week', exact: true })).not.toBeChecked();
});
