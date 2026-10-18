import { expect, test, type Page } from '@playwright/test';
import type { Account } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// `completeSetup` pins the clock to Friday 2026-10-16 and creates the plan that day: food 310 and eating out 124
// are planned from the 16th, so 16 of October's 31 days (food €160, eating out €64), and rent is €400.

async function quickAdd(page: Page, text: string, category: string, saved: string) {
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: category }).click();
  // Waiting for the line also waits for the entry to be in the database.
  await expect(page.getByRole('status')).toHaveText(saved);
}

/** Puts entries straight into IndexedDB; a page loaded afterwards reads them. */
async function seedEntries(
  page: Page,
  entries: { type: 'expense' | 'income'; categoryId: string; date: string; eurMinor: number }[],
) {
  const [account] = await readStore<Account>(page, 'accounts');
  const rows = entries.map((entry, i) => ({
    id: `seed-${i}`,
    ...entry,
    accountId: account.id,
    amountMinor: entry.eurMinor,
    note: 'seed',
    createdAt: `${entry.date}T12:00:00.000Z`,
  }));
  await page.evaluate(
    (toPut) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction('entries', 'readwrite');
          for (const row of toPut) transaction.objectStore('entries').put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    rows,
  );
}

/** Loads /charts and waits until the page has read the database and shows a month. */
async function openCharts(page: Page) {
  await page.goto('/charts');
  await expect(page.getByRole('group', { name: 'Month' })).toContainText('October 2026');
}

function monthSwitcher(page: Page) {
  return page.getByRole('group', { name: 'Month' });
}

function spendingSection(page: Page) {
  return page.getByRole('region', { name: 'Spending by category' });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * The tappable rows (or columns) of a chart, in the order of its table. They are SVG groups with no role of their
 * own, since the chart is one image to a screen reader and the table has the real links.
 */
function bars(section: ReturnType<typeof spendingSection>) {
  return section.locator('g.cursor-pointer');
}

test('shows each category spent against its plan, and a tapped bar opens that category for the month', async ({
  page,
}) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');
  await quickAdd(page, 'rewe 20', 'Food & groceries', 'Saved €20.00 · rewe · Food & groceries');

  await openCharts(page);
  const spending = spendingSection(page);

  // On the chart: spent of planned, a number per row. Food has the most, rent is planned and untouched.
  await expect(spending.getByText('€20 of €160', { exact: true })).toBeVisible();
  await expect(spending.getByText('€6 of €64', { exact: true })).toBeVisible();
  await expect(spending.getByText('€0 of €400', { exact: true })).toBeVisible();

  // The same numbers as a table, most spent first.
  await expect(spending.getByRole('rowheader')).toHaveText(['Food & groceries', 'Eating out', 'Rent']);
  await expect(spending.getByRole('row', { name: /Food & groceries/ }).getByRole('cell')).toHaveText(['€20', '€160']);
  await expect(spending.getByRole('row', { name: /Eating out/ }).getByRole('cell')).toHaveText(['€6', '€64']);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // A pointer on a row reads out its numbers, and leaving it clears them.
  await bars(spending).nth(1).hover();
  await expect(spending.getByRole('tooltip')).toHaveText(/Eating out.*Spent.*€6.*Planned.*€64/);
  await page.getByRole('heading', { level: 2, name: 'Charts' }).hover();
  await expect(spending.getByRole('tooltip')).toHaveCount(0);

  // Tapping the second row, Eating out, opens its entries for the month: the döner and nothing else.
  await bars(spending).nth(1).click();
  await expect(page).toHaveURL('/entries?category=eating-out&month=2026-10');
  const list = page.getByRole('region', { name: 'Entries' });
  await expect(list.getByText('döner')).toBeVisible();
  await expect(list.getByText('rewe')).toHaveCount(0);
});

test('a keyboard reaches every bar through the table, which shows itself while a link has focus', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');
  await openCharts(page);
  const spending = spendingSection(page);
  const table = spending.getByRole('table', { name: /Spending by category, October 2026/ });
  const link = table.getByRole('link', { name: 'Eating out' });
  await expect(link).toHaveAttribute('href', '/entries?category=eating-out&month=2026-10');

  // Its wrapper is a one-pixel clip at first and as wide as the page once a link has focus.
  const wrapper = table.locator('..');
  expect((await wrapper.boundingBox())?.width).toBeLessThan(5);
  await link.focus();
  expect((await wrapper.boundingBox())?.width).toBeGreaterThan(200);

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/entries?category=eating-out&month=2026-10');
});

test('the month switcher moves between months, and a month with nothing in it says so', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');
  await openCharts(page);
  await expect(spendingSection(page)).toBeVisible();

  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await expect(monthSwitcher(page)).toContainText('September 2026');
  await expect(page.getByText('Nothing logged in September yet.')).toBeVisible();
  await expect(spendingSection(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Last 6 months' })).toHaveCount(0);

  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await expect(monthSwitcher(page)).toContainText('October 2026');
  await expect(spendingSection(page).getByText('€6 of €64', { exact: true })).toBeVisible();

  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await expect(monthSwitcher(page)).toContainText('November 2026');
  await expect(page.getByText('Nothing logged in November yet.')).toBeVisible();
});

test('shows income by source, and the last six months of the category that was spent on most', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'rewe 20', 'Food & groceries', 'Saved €20.00 · rewe · Food & groceries');
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');
  await seedEntries(page, [
    { type: 'income', categoryId: 'income-job', date: '2026-10-10', eurMinor: 40000 },
    { type: 'income', categoryId: 'income-parents', date: '2026-10-01', eurMinor: 50000 },
    // Food in the two months before.
    { type: 'expense', categoryId: 'food', date: '2026-09-10', eurMinor: 6000 },
    { type: 'expense', categoryId: 'food', date: '2026-08-15', eurMinor: 4500 },
  ]);
  await openCharts(page);

  const income = page.getByRole('region', { name: 'Income by source' });
  await expect(income.getByText('€500', { exact: true }).first()).toBeVisible();
  await expect(income.getByRole('rowheader')).toHaveText(['Parents', 'Job']);
  await expect(income.getByRole('cell')).toHaveText(['€500', '€400']);

  const history = page.getByRole('region', { name: 'Last 6 months' });
  const category = history.getByRole('combobox', { name: 'Category' });
  // October's top spender is food, so the history starts on it.
  await expect(category).toHaveValue('food');
  await expect(history.getByRole('rowheader')).toHaveText([
    'May 2026',
    'June 2026',
    'July 2026',
    'August 2026',
    'September 2026',
    'October 2026',
  ]);
  await expect(history.getByRole('cell')).toHaveText(['€0', '€0', '€0', '€45', '€60', '€20']);
  await expect(history.getByText('€60', { exact: true }).first()).toBeVisible();

  await category.selectOption({ label: 'Eating out' });
  await expect(history.getByRole('cell')).toHaveText(['€0', '€0', '€0', '€0', '€0', '€6']);

  await bars(history).nth(4).hover();
  await expect(history.getByRole('tooltip')).toHaveText(/September 2026.*Spent.*€0/);

  // The October column opens that category for that month.
  await bars(history).nth(5).click();
  await expect(page).toHaveURL('/entries?category=eating-out&month=2026-10');
});

test('coming back from another page shows what was added there', async ({ page }) => {
  await completeSetup(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Charts' }).click();
  await expect(page.getByText('Nothing logged in October yet.')).toBeVisible();

  // The router keeps the charts page mounted but hidden while Entries is open.
  await nav.getByRole('link', { name: 'Entries' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Entries' })).toBeVisible();
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');

  await nav.getByRole('link', { name: 'Charts' }).click();
  await expect(spendingSection(page).getByText('€6 of €64', { exact: true })).toBeVisible();
  await expect(page.getByText('Nothing logged in October yet.')).toHaveCount(0);
});

test('the bottom navigation has Charts between Entries and Settings and opens it', async ({ page }) => {
  await completeSetup(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Entries', 'Charts', 'Settings']);

  await nav.getByRole('link', { name: 'Charts' }).click();
  await expect(page).toHaveURL('/charts');
  await expect(page.getByRole('heading', { level: 2, name: 'Charts' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Charts' })).toHaveAttribute('aria-current', 'page');
  await expect(monthSwitcher(page)).toContainText('October 2026');
  await expect(page.getByText('Nothing logged in October yet.')).toBeVisible();
});

test('without a plan the page points to setup instead of showing charts', async ({ page }) => {
  await page.goto('/charts');
  await expect(page.getByText('Set up your plan to see where the money goes.')).toBeVisible();
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect(page).toHaveURL('/setup');
});
