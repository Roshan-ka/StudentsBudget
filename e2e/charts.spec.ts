import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Account } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';

// `completeSetup` pins the clock to Friday 2026-10-16 and creates the plan that day: food 310 and eating out 124
// are planned in full for October, though the plan starts on the 16th, and rent is €400.
// Flexible spending only counts from the 16th on, so the seeds for October flexible categories are dated after it.

// The charts have to work on a phone: 375 px wide, whatever the project's device.
test.use({ viewport: { width: 375, height: 812 } });
// Most of these walk through setup, seed a year of entries and then click through several charts: on the emulated
// iPhone that does not always fit in the default 30 s.
test.describe.configure({ timeout: 90_000 });

async function quickAdd(page: Page, text: string, category: string, saved: string) {
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: category }).click();
  // Waiting for the line also waits for the entry to be in the database.
  await expect(page.getByRole('status')).toHaveText(saved);
}

type Seed =
  | { type: 'expense' | 'income'; categoryId: string; date: string; eurMinor: number }
  /** From the home bank (INR) to the local bank (EUR). `amountMinor` is in paise. */
  | { type: 'transfer'; date: string; eurMinor: number; amountMinor: number };

/** Puts entries straight into IndexedDB; a page loaded afterwards reads them. */
async function seedEntries(page: Page, entries: Seed[]) {
  const [local, home] = await readStore<Account>(page, 'accounts');
  const rows = entries.map((entry, i) => ({
    id: `seed-${i}`,
    ...(entry.type === 'transfer'
      ? { ...entry, accountId: home.id, toAccountId: local.id, toAmountMinor: entry.eurMinor }
      : { ...entry, accountId: local.id, amountMinor: entry.eurMinor }),
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

function incomeSection(page: Page) {
  return page.getByRole('region', { name: 'Income by source' });
}

function savingsSection(page: Page) {
  return page.getByRole('region', { name: 'Saved each month' });
}

/** Picks a style on a chart's own switch, and waits until it is the one that is on. */
async function pickStyle(section: Locator, group: string, style: string) {
  const button = section.getByRole('group', { name: group }).getByRole('button', { name: style, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function pickPeriod(page: Page, period: string) {
  const button = page.getByRole('group', { name: 'Period' }).getByRole('button', { name: period, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * The tappable marks of a chart (a bar, a column or a donut slice), in the order of its data. They are SVG groups
 * with no role of their own, since the chart is one image to a screen reader and the legend or table has the links.
 */
function marks(section: Locator) {
  return section.locator('g.cursor-pointer');
}

/** A point on the donut's ring, `fraction` of the way round clockwise from 12 o'clock, halfway across the ring. */
async function pointOnRing(section: Locator, fraction: number) {
  const box = await section.locator('svg.recharts-surface').first().boundingBox();
  if (!box) throw new Error('the donut is not on screen');
  const radius = (Math.min(box.width, box.height) / 2) * 0.8;
  const angle = fraction * 2 * Math.PI;
  return {
    x: box.x + box.width / 2 + radius * Math.sin(angle),
    y: box.y + box.height / 2 - radius * Math.cos(angle),
  };
}

/** What the legend row of a category looks like: its colour square, as the browser computed it. */
async function swatchOf(row: Locator) {
  return row.locator('span[aria-hidden="true"]').evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** Eight categories with spending in October, all after the setup day. Food 200, shopping 90, eating out 60, going out 40, transport 30, health 25, gifts 15, study 8: €468. */
const OCTOBER: Seed[] = [
  { type: 'expense', categoryId: 'food', date: '2026-10-20', eurMinor: 20000 },
  { type: 'expense', categoryId: 'shopping', date: '2026-10-21', eurMinor: 9000 },
  { type: 'expense', categoryId: 'eating-out', date: '2026-10-22', eurMinor: 6000 },
  { type: 'expense', categoryId: 'going-out', date: '2026-10-23', eurMinor: 4000 },
  { type: 'expense', categoryId: 'transport', date: '2026-10-24', eurMinor: 3000 },
  { type: 'expense', categoryId: 'health', date: '2026-10-25', eurMinor: 2500 },
  { type: 'expense', categoryId: 'gifts', date: '2026-10-26', eurMinor: 1500 },
  { type: 'expense', categoryId: 'study', date: '2026-10-27', eurMinor: 800 },
];

test('opens spending as a donut of the top 6 and "Everything else", with the total in the middle', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, OCTOBER);
  await openCharts(page);
  const spending = spendingSection(page);

  // The donut is what is on, and it has its own switch.
  await expect(
    spending.getByRole('group', { name: 'Spending chart style' }).getByRole('button', { name: 'Donut', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(spending.getByRole('img', { name: /Donut chart of what was spent in October 2026/ })).toBeVisible();
  // The total of everything spent is in the middle.
  await expect(spending.getByText('€468', { exact: true })).toBeVisible();

  // The legend is the top 6 by spent, then one row for the other two (gifts €15 and study €8).
  const rows = spending.getByRole('listitem');
  await expect(rows).toHaveCount(7);
  await expect(rows.nth(0)).toHaveText('Food & groceries€20043%');
  await expect(rows.nth(1)).toHaveText('Shopping€9019%');
  await expect(rows.nth(5)).toHaveText('Health€255%');
  await expect(rows.nth(6)).toHaveText('Everything else€235%');
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The rows are links to the entries, except the bucket, which has none to open.
  await expect(rows.nth(0).getByRole('link')).toHaveAttribute('href', '/entries?category=food&month=2026-10');
  await expect(rows.nth(6).getByRole('link')).toHaveCount(0);
  // Rent is planned, not spent, so it is not a slice (it is in the table that goes with the chart).
  await expect(rows.filter({ hasText: 'Rent' })).toHaveCount(0);
});

test('a category keeps its colour, and the bucket is grey', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, [
    ...OCTOBER,
    // In September shopping is the biggest and food the second.
    { type: 'expense', categoryId: 'shopping', date: '2026-09-10', eurMinor: 30000 },
    { type: 'expense', categoryId: 'food', date: '2026-09-11', eurMinor: 10000 },
  ]);
  await openCharts(page);
  const spending = spendingSection(page);
  const food = spending.getByRole('listitem').filter({ hasText: 'Food & groceries' });

  // #eb6834, and the grey for everything else.
  expect(await swatchOf(food)).toBe('rgb(235, 104, 52)');
  expect(await swatchOf(spending.getByRole('listitem').filter({ hasText: 'Everything else' }))).toBe('rgb(138, 138, 138)');
  await expect(spending.getByRole('listitem').first()).toContainText('Food & groceries');

  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await expect(monthSwitcher(page)).toContainText('September 2026');
  // Shopping is first now and food second, and food is the same colour.
  await expect(spending.getByRole('listitem').first()).toContainText('Shopping');
  await expect(food).toHaveText('Food & groceries€10025%');
  expect(await swatchOf(food)).toBe('rgb(235, 104, 52)');
});

test('a tapped slice opens that category for the month, and the bucket cannot be tapped', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, OCTOBER);
  await openCharts(page);
  const spending = spendingSection(page);

  // A pointer on a slice reads out its numbers, and leaving it clears them. Food is the first 43% from 12 o'clock.
  const onFood = await pointOnRing(spending, 0.2);
  await page.mouse.move(onFood.x, onFood.y);
  await expect(spending.getByRole('tooltip')).toHaveText(/Food & groceries.*Spent.*€200/);
  await page.getByRole('heading', { level: 2, name: 'Charts' }).hover();
  await expect(spending.getByRole('tooltip')).toHaveCount(0);

  // The last 5% of the ring is the bucket: nothing opens.
  const bucket = await pointOnRing(spending, 0.975);
  await page.mouse.click(bucket.x, bucket.y);
  await expect(page).toHaveURL('/charts');

  await page.mouse.click(onFood.x, onFood.y);
  await expect(page).toHaveURL('/entries?category=food&month=2026-10');
  await expect(page.getByRole('region', { name: 'Entries' }).getByText('seed')).toHaveCount(1);
});

test('shows each category spent against its plan as bars, and a tapped bar opens that category for the month', async ({
  page,
}) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');
  await quickAdd(page, 'rewe 20', 'Food & groceries', 'Saved €20.00 · rewe · Food & groceries');

  await openCharts(page);
  const spending = spendingSection(page);
  await pickStyle(spending, 'Spending chart style', 'Bars');

  // On the chart: spent of planned, a number per row. Food has the most, rent is planned and untouched.
  await expect(spending.getByText('€20 of €310', { exact: true })).toBeVisible();
  await expect(spending.getByText('€6 of €124', { exact: true })).toBeVisible();
  await expect(spending.getByText('€0 of €400', { exact: true })).toBeVisible();
  // Every category on the bars is the one colour, which the names tell apart.
  await expect(spending.getByRole('row', { name: /Food & groceries/ }).getByRole('cell')).toHaveText(['€20', '€310']);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // A pointer on a row reads out its numbers, and leaving it clears them.
  await marks(spending).nth(1).hover();
  await expect(spending.getByRole('tooltip')).toHaveText(/Eating out.*Spent.*€6.*Planned.*€124/);
  await page.getByRole('heading', { level: 2, name: 'Charts' }).hover();
  await expect(spending.getByRole('tooltip')).toHaveCount(0);

  // Tapping the second row, Eating out, opens its entries for the month: the döner and nothing else.
  await marks(spending).nth(1).click();
  await expect(page).toHaveURL('/entries?category=eating-out&month=2026-10');
  const list = page.getByRole('region', { name: 'Entries' });
  await expect(list.getByText('döner')).toBeVisible();
  await expect(list.getByText('rewe')).toHaveCount(0);
});

test('the table style lists every category, most spent first, with what was planned', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, OCTOBER);
  await openCharts(page);
  const spending = spendingSection(page);
  await pickStyle(spending, 'Spending chart style', 'Table');

  const table = spending.getByRole('table', { name: /Spending by category, October 2026/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveText(['Category', 'Spent', 'Planned']);
  // All nine rows, not just the top 6: gifts and study have their own, and rent is planned but not spent.
  await expect(table.getByRole('rowheader')).toHaveText([
    'Food & groceries',
    'Shopping',
    'Eating out',
    'Going out',
    'Transport',
    'Health & pharmacy',
    'Gifts',
    'Study materials',
    'Rent',
  ]);
  await expect(table.getByRole('row', { name: /Food & groceries/ }).getByRole('cell')).toHaveText(['€200', '€310']);
  await expect(table.getByRole('row', { name: /Rent/ }).getByRole('cell')).toHaveText(['€0', '€400']);
  await expect(table.getByRole('row', { name: /Gifts/ }).getByRole('cell')).toHaveText(['€15', '€0']);
  // The chart is gone: this style is the table alone.
  await expect(spending.getByRole('img')).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await table.getByRole('link', { name: 'Gifts' }).click();
  await expect(page).toHaveURL('/entries?category=gifts&month=2026-10');
});

test('each chart has its own style, and going back to the donut remembers nothing but the default', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, [
    ...OCTOBER,
    { type: 'income', categoryId: 'income-parents', date: '2026-10-01', eurMinor: 50000 },
    { type: 'income', categoryId: 'income-job', date: '2026-10-10', eurMinor: 40000 },
  ]);
  await openCharts(page);
  const spending = spendingSection(page);
  const income = incomeSection(page);
  const pressed = (section: Locator, group: string, style: string) =>
    section.getByRole('group', { name: group }).getByRole('button', { name: style, exact: true });

  await pickStyle(spending, 'Spending chart style', 'Table');
  // Income is still a donut, with its total in the middle and its sources underneath.
  await expect(pressed(income, 'Income chart style', 'Donut')).toHaveAttribute('aria-pressed', 'true');
  await expect(income.getByText('€900', { exact: true })).toBeVisible();
  await expect(income.getByRole('listitem')).toHaveText(['Parents€50056%', 'Job€40044%']);

  await pickStyle(income, 'Income chart style', 'Bars');
  await expect(income.getByText('€500', { exact: true }).first()).toBeVisible();
  await expect(income.getByRole('row', { name: /Parents/ }).getByRole('cell')).toHaveText(['€500']);
  await pickStyle(income, 'Income chart style', 'Table');
  await expect(income.getByRole('table')).toBeVisible();
  await expect(income.getByRole('rowheader')).toHaveText(['Parents', 'Job']);
  await expect(income.getByRole('cell')).toHaveText(['€500', '€400']);
  await expect(pressed(spending, 'Spending chart style', 'Table')).toHaveAttribute('aria-pressed', 'true');

  await pickStyle(spending, 'Spending chart style', 'Donut');
  await expect(spending.getByText('€468', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a period of 3 months adds up the months, and the month switcher moves where it ends', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, [
    ...OCTOBER,
    // September came before the plan: it counts as spent, with nothing to measure it against.
    { type: 'expense', categoryId: 'food', date: '2026-09-10', eurMinor: 10000 },
    { type: 'expense', categoryId: 'shopping', date: '2026-08-15', eurMinor: 2000 },
    // Outside the three months.
    { type: 'expense', categoryId: 'food', date: '2026-07-31', eurMinor: 99900 },
  ]);
  await openCharts(page);
  const spending = spendingSection(page);

  // This month is the default; October alone is €468.
  await expect(page.getByRole('group', { name: 'Period' }).getByRole('button', { name: 'This month' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(spending.getByText('€468', { exact: true })).toBeVisible();

  await pickPeriod(page, '3 months');
  // August to October: 468 + 100 + 20.
  await expect(spending.getByText('€588', { exact: true })).toBeVisible();
  await expect(spending.getByText('€468', { exact: true })).toHaveCount(0);
  await expect(monthSwitcher(page)).toContainText('October 2026');
  await expect(monthSwitcher(page)).toContainText('Aug – Oct 2026');
  await expect(spending.getByRole('img', { name: /August 2026 to October 2026/ })).toBeVisible();
  // The plan started on the 16th, which is inside the period.
  await expect(spending.getByText('Envelope spending counts from 16 Oct.', { exact: true })).toBeVisible();
  await expect(spending.getByRole('listitem').first()).toHaveText('Food & groceries€30051%');

  // Bars: food was spent €300 over three months, against the €310 planned for October (there was no plan before).
  await pickStyle(spending, 'Spending chart style', 'Bars');
  await expect(spending.getByText('€300 of €310', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Previous moves the end month: July to September has the July food and September's, and no plan at all.
  await pickStyle(spending, 'Spending chart style', 'Table');
  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await expect(monthSwitcher(page)).toContainText('September 2026');
  await expect(monthSwitcher(page)).toContainText('Jul – Sept 2026');
  await expect(spending.getByRole('columnheader')).toHaveText(['Category', 'Spent']);
  await expect(spending.getByRole('row', { name: /Food & groceries/ }).getByRole('cell')).toHaveText(['€1,099']);
  await expect(spending.getByText(/Envelope spending counts/)).toHaveCount(0);

  for (const period of ['6 months', '12 months', 'This month']) {
    await pickPeriod(page, period);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  }
});

test('the savings chart says what was saved in calm words, and leaves transfers out', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, [
    { type: 'income', categoryId: 'income-parents', date: '2026-10-01', eurMinor: 50000 },
    { type: 'expense', categoryId: 'food', date: '2026-10-20', eurMinor: 38000 },
    // Moving money between your own accounts is neither earned nor spent.
    { type: 'transfer', date: '2026-10-12', eurMinor: 20000, amountMinor: 1900000 },
    // A one-off cost counts as spending.
    { type: 'expense', categoryId: 'one-off', date: '2026-10-05', eurMinor: 0 },
    // September: more spent than earned.
    { type: 'income', categoryId: 'income-job', date: '2026-09-02', eurMinor: 6000 },
    { type: 'expense', categoryId: 'eating-out', date: '2026-09-09', eurMinor: 10000 },
  ]);
  await openCharts(page);
  const savings = savingsSection(page);

  // On "This month" one column would say little: the savings look back 6 months, to May. Spending stays on October.
  await expect(savings.getByText('Last 6 months', { exact: true })).toBeVisible();
  // May to August nothing, September 60 - 100, October 120: €80 saved in all.
  await expect(savings.getByText('€80 saved', { exact: true })).toBeVisible();
  await expect(savings.getByText(/failed|warning|loss/i)).toHaveCount(0);
  await expect(marks(savings)).toHaveCount(6);
  await expect(
    savings.getByRole('img', { name: /Column chart of income minus spending in each month of May 2026 to October 2026/ }),
  ).toBeVisible();
  await expect(savings.locator('svg').getByText('€120', { exact: true })).toBeVisible();
  await expect(spendingSection(page).getByRole('table', { name: /^Spending by category, October 2026\./ })).toHaveCount(1);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await pickPeriod(page, '3 months');
  // August nothing, September 60 - 100, October 120: €80 saved in all.
  await expect(savings.getByText('Last 6 months', { exact: true })).toHaveCount(0);
  await expect(savings.getByText('€80 saved', { exact: true })).toBeVisible();
  await expect(marks(savings)).toHaveCount(3);
  await marks(savings).nth(1).hover();
  await expect(savings.getByRole('tooltip')).toHaveText(/September 2026.*More spent than earned.*€40.*Income.*€60.*Spent.*€100/);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // The table has the same months, with the transfer in none of them.
  await pickStyle(savings, 'Savings chart style', 'Table');
  await expect(savings.getByRole('columnheader')).toHaveText(['Month', 'Income', 'Spent', 'Saved']);
  await expect(savings.getByRole('row', { name: /October 2026/ }).getByRole('cell')).toHaveText(['€500', '€380', '€120']);
  await expect(savings.getByRole('row', { name: /September 2026/ }).getByRole('cell')).toHaveText(['€60', '€100', '−€40']);
  await expect(savings.getByRole('row', { name: /August 2026/ }).getByRole('cell')).toHaveText(['€0', '€0', '€0']);

  await pickStyle(savings, 'Savings chart style', 'Line');
  await expect(savings.getByRole('img', { name: /Line chart of income minus spending/ })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Only September: "€40 more spent than earned", with nothing alarming about it.
  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await pickPeriod(page, 'This month');
  await expect(monthSwitcher(page)).toContainText('September 2026');
  await expect(savings.getByText('€40 more spent than earned', { exact: true })).toBeVisible();
  await expect(savings.getByText(/failed|warning|loss/i)).toHaveCount(0);
});

test('the category chart follows the period: columns, a line or a table, and a tapped column opens its month', async ({
  page,
}) => {
  await completeSetup(page);
  await seedEntries(page, [
    { type: 'expense', categoryId: 'food', date: '2026-10-20', eurMinor: 2000 },
    { type: 'expense', categoryId: 'eating-out', date: '2026-10-21', eurMinor: 600 },
    { type: 'expense', categoryId: 'food', date: '2026-09-10', eurMinor: 6000 },
    { type: 'expense', categoryId: 'food', date: '2026-08-15', eurMinor: 4500 },
  ]);
  await openCharts(page);
  const over = page.getByRole('region', { name: 'Food & groceries over time' });
  // On "This month" the chart looks back 6 months, to May, and says so.
  await expect(over.getByText('Last 6 months', { exact: true })).toBeVisible();
  await expect(marks(over)).toHaveCount(6);
  await expect(over.getByRole('img', { name: /in each month of May 2026 to October 2026/ })).toBeVisible();
  await pickPeriod(page, '6 months');
  await expect(over.getByText('Last 6 months', { exact: true })).toHaveCount(0);
  // The heading names the category, so the picker is found on the page, not in a section.
  const category = page.getByRole('combobox', { name: 'Category' });

  // October's top spender is food, so the chart starts on it. Columns are what is on, one per month.
  await expect(category).toHaveValue('food');
  await expect(over.getByRole('group', { name: 'Category chart style' }).getByRole('button', { name: 'Columns', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(marks(over)).toHaveCount(6);
  await expect(over.locator('svg').getByText('€60', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Another category gets its own heading and its own colour.
  await category.selectOption({ label: 'Eating out' });
  const eating = page.getByRole('region', { name: 'Eating out over time' });
  await expect(eating.locator('svg').getByText('€6', { exact: true })).toBeVisible();
  await pickStyle(eating, 'Category chart style', 'Line');
  await expect(eating.getByRole('img', { name: /Line chart of what was spent on Eating out/ })).toBeVisible();
  await expect(marks(eating)).toHaveCount(6);
  await pickStyle(eating, 'Category chart style', 'Table');
  await expect(eating.getByRole('rowheader')).toHaveText([
    'May 2026',
    'June 2026',
    'July 2026',
    'August 2026',
    'September 2026',
    'October 2026',
  ]);
  await expect(eating.getByRole('cell')).toHaveText(['€0', '€0', '€0', '€0', '€0', '€6']);

  // Back on columns, a pointer on September reads it out and a tap opens that month for that category.
  await pickStyle(eating, 'Category chart style', 'Columns');
  await category.selectOption({ label: 'Food & groceries' });
  await marks(over).nth(4).hover();
  await expect(over.getByRole('tooltip')).toHaveText(/September 2026.*Spent.*€60/);
  await marks(over).nth(4).click();
  await expect(page).toHaveURL('/entries?category=food&month=2026-09');
});

test('a period of 12 months fits a phone: twelve columns, and no label wider than its column', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, [
    { type: 'income', categoryId: 'income-parents', date: '2026-10-01', eurMinor: 123456 },
    { type: 'expense', categoryId: 'rent', date: '2026-10-01', eurMinor: 40000 },
    { type: 'expense', categoryId: 'rent', date: '2025-12-01', eurMinor: 40000 },
    { type: 'income', categoryId: 'income-parents', date: '2025-11-01', eurMinor: 5000 },
  ]);
  await openCharts(page);
  await pickPeriod(page, '12 months');
  await expect(monthSwitcher(page)).toContainText('Nov 2025 – Oct 2026');

  const savings = savingsSection(page);
  await expect(marks(savings)).toHaveCount(12);
  // With 12 columns the amounts are in the tooltip and the table, not over every column: the only text in the
  // chart is the 12 month names.
  await expect(savings.locator('svg text')).toHaveCount(12);
  // Only rent was spent, but a fixed cost is a flat line: the chart starts on the flexible category planned most.
  await expect(page.getByRole('region', { name: 'Food & groceries over time' }).locator('g.cursor-pointer')).toHaveCount(12);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a keyboard reaches every bar through the table, which shows itself while a link has focus', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6', 'Eating out', 'Saved €6.00 · döner · Eating out');
  await openCharts(page);
  const spending = spendingSection(page);
  await pickStyle(spending, 'Spending chart style', 'Bars');
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

test('the donut is reachable by keyboard through its legend, which links to the entries', async ({ page }) => {
  await completeSetup(page);
  await seedEntries(page, OCTOBER);
  await openCharts(page);
  const link = spendingSection(page).getByRole('listitem').filter({ hasText: 'Shopping' }).getByRole('link');

  await link.focus();
  await expect(link).toBeFocused();
  // A link a thumb can hit: 44 px tall.
  expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/entries?category=shopping&month=2026-10');
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
  await expect(page.getByRole('region', { name: /over time/ })).toHaveCount(0);

  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await expect(monthSwitcher(page)).toContainText('October 2026');
  await expect(spendingSection(page).getByText('€6', { exact: true }).first()).toBeVisible();

  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await expect(monthSwitcher(page)).toContainText('November 2026');
  await expect(page.getByText('Nothing logged in November yet.')).toBeVisible();

  // A longer period says so in the same words, for its months: November to January has nothing in it either.
  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await expect(monthSwitcher(page)).toContainText('January 2027');
  await pickPeriod(page, '3 months');
  await expect(page.getByText('Nothing logged in these 3 months yet.')).toBeVisible();
  // Two months back, the period reaches October again.
  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await expect(spendingSection(page)).toBeVisible();
});

test('the setup month plans the whole envelope, counts spending from the setup day on and says so', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'rewe 20', 'Food & groceries', 'Saved €20.00 · rewe · Food & groceries');
  await seedEntries(page, [
    // Backdated to before the setup day: in the entries list, but not counted against food's envelope.
    { type: 'expense', categoryId: 'food', date: '2026-10-03', eurMinor: 18000 },
    // Before the setup month there was no plan; after it, the envelope is whole.
    { type: 'expense', categoryId: 'food', date: '2026-09-10', eurMinor: 3000 },
    { type: 'expense', categoryId: 'food', date: '2026-11-05', eurMinor: 1000 },
  ]);
  await openCharts(page);
  const spending = spendingSection(page);
  await pickStyle(spending, 'Spending chart style', 'Table');
  const food = spending.getByRole('row', { name: /Food & groceries/ }).getByRole('cell');
  const note = /Envelope spending counts/;

  // October: €20 of the whole €310, not €200 of it, and the line that explains why the €180 is left out.
  await expect(spending.getByText('Envelope spending counts from 16 Oct.', { exact: true })).toBeVisible();
  await expect(food).toHaveText(['€20', '€310']);
  // The table carries the line too.
  await expect(spending.getByRole('table')).toContainText('Envelope spending counts from 16 Oct.');

  // September came before the plan: what was spent, with nothing to measure it against.
  await monthSwitcher(page).getByRole('button', { name: 'Previous' }).click();
  await expect(monthSwitcher(page)).toContainText('September 2026');
  await expect(spending.getByRole('columnheader')).toHaveText(['Category', 'Spent']);
  await expect(food).toHaveText(['€30']);
  await expect(spending.getByText(note)).toHaveCount(0);

  // November: the same envelope, and no line.
  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await monthSwitcher(page).getByRole('button', { name: 'Next' }).click();
  await expect(monthSwitcher(page)).toContainText('November 2026');
  await expect(food).toHaveText(['€10', '€310']);
  await expect(spending.getByText(note)).toHaveCount(0);
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
  await expect(spendingSection(page).getByRole('listitem')).toHaveText(['Eating out€6100%']);
  await expect(page.getByText('Nothing logged in October yet.')).toHaveCount(0);
});

test('the bottom navigation has Charts between Entries and Tips and opens it', async ({ page }) => {
  await completeSetup(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Home', 'Entries', 'Charts', 'Tips', 'Settings']);

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
