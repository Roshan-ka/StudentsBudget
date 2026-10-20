import { expect, test, type Page } from '@playwright/test';
import type { Account, Amount, Entry, Plan } from '../src/db/types';
import { FRANKFURTER, completeSetup, fillSetup, readStore } from './helpers/setup';

// `completeSetup` pins the clock to Friday 2026-10-16 and creates the plan that day: food 310 and eating out 124 are
// planned from the 16th, so 16 of October's 31 days (food €160, eating out €64). The week Oct 12-18 has three days
// of budget: food 310 * 3/31 = €30 and eating out 124 * 3/31 = €12. Available each month: 900 - 400 rent - 60 for
// the €300 fee (spread over October to February) = €440.

function leftThisMonth(page: Page) {
  return page.getByRole('region', { name: 'Left to spend this month' });
}

function envelopes(page: Page) {
  return page.getByRole('list', { name: 'Envelopes' });
}

function suggestion(page: Page) {
  return page.getByRole('region', { name: 'Suggested budget' });
}

function suggestionLink(page: Page) {
  return page.getByRole('button', { name: 'See a suggested budget', exact: true });
}

async function quickAdd(page: Page, text: string) {
  // By role, not label: a page the router has left stays mounted but hidden, with a field of the same name.
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Puts rows straight into one IndexedDB store; a page loaded afterwards reads them. */
async function writeStore(page: Page, store: string, rows: unknown[]) {
  await page.evaluate(
    ({ name, put }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(name, 'readwrite');
          for (const row of put) transaction.objectStore(name).put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    { name: store, put: rows },
  );
}

async function seedExpense(page: Page, categoryId: string, date: string, eurMinor: number) {
  const [account] = await readStore<Account>(page, 'accounts');
  await writeStore(page, 'entries', [
    {
      id: `seed-${categoryId}-${date}`,
      type: 'expense',
      categoryId,
      date,
      accountId: account.id,
      amountMinor: eurMinor,
      eurMinor,
      note: 'seed',
      createdAt: `${date}T12:00:00.000Z`,
    },
  ]);
}

/** Opens the app again on another day. Exchange rates are left to fail, so only the date moves home on. */
async function reopenOn(page: Page, date: Date) {
  await page.route(FRANKFURTER, (route) => route.abort());
  await page.clock.setFixedTime(date);
  await page.reload();
}

test('leads with what is left to spend this month, and under it what is safe this week', async ({ page }) => {
  await completeSetup(page);
  const card = leftThisMonth(page);

  await expect(card.getByText('€224', { exact: true })).toBeVisible();
  await expect(card.getByText('This week: €42 safe to spend', { exact: true })).toBeVisible();

  // The first "döner" has no learned category, so quick add asks.
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(card.getByText('€218', { exact: true })).toBeVisible();
  await expect(card.getByText('This week: €36 safe to spend', { exact: true })).toBeVisible();

  // Overspending reads calmly, for the month and for the week.
  await quickAdd(page, 'döner 300');
  await expect(page.getByRole('status')).toHaveText('Saved €300.00 · döner · Eating out');
  await expect(card.getByText('€82 over this month', { exact: true })).toBeVisible();
  await expect(card.getByText('This week: €264 over', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('two numbers side by side before "euros" ask which amount, and one tap saves it', async ({ page }) => {
  await completeSetup(page);
  const amounts = page.getByRole('group', { name: 'Amount', exact: true });

  // "seven forty euros" could be €7.40 or €40: nothing is saved until the person says which.
  await quickAdd(page, 'coffee seven forty euros.');
  await expect(amounts.getByRole('button', { name: '€7.40', exact: true })).toBeVisible();
  await expect(amounts.getByRole('button', { name: '€40', exact: true })).toBeVisible();
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);

  // A changed line has to be added again.
  await page.getByRole('textbox', { name: 'Quick add' }).fill('coffee seven forty euros');
  await expect(amounts).toHaveCount(0);

  await quickAdd(page, 'coffee seven forty euros.');
  await amounts.getByRole('button', { name: '€7.40', exact: true }).click();
  await expect(amounts).toHaveCount(0);
  // "coffee" has no learned category yet, so the chips follow, as for any line.
  await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Eating out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €7.40 · coffee · Eating out');
  const entries = await readStore<Entry>(page, 'entries');
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ type: 'expense', amountMinor: 740, note: 'coffee', categoryId: 'eating-out' });
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the envelopes show what is left of the month and how much of it is used', async ({ page }) => {
  await completeSetup(page);
  const list = envelopes(page);
  const food = list.getByRole('listitem').filter({ hasText: 'Food & groceries' });
  const eatingOut = list.getByRole('listitem').filter({ hasText: 'Eating out' });

  // From the setup day only: 16 of October's 31 days are planned.
  await expect(food.getByText('€160 left of €160 this month', { exact: true })).toBeVisible();
  await expect(eatingOut.getByText('€64 left of €64 this month', { exact: true })).toBeVisible();
  // Envelopes planned at €0 and unused stay out of the way.
  await expect(list.getByRole('listitem')).toHaveCount(2);

  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(eatingOut.getByText('€58 left of €64 this month', { exact: true })).toBeVisible();
  const bar = eatingOut.getByRole('progressbar', { name: 'Eating out this month' });
  await expect(bar).toHaveAttribute('aria-valuetext', '€58 left of €64 this month');
  await expect(bar).toHaveAttribute('aria-valuenow', '9');
  await expect(food.getByText('€160 left of €160 this month', { exact: true })).toBeVisible();

  // Over the plan: the real numbers show, the bar stops at full.
  await quickAdd(page, 'döner 100');
  await expect(eatingOut.getByText('€42 over the €64 planned this month', { exact: true })).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuetext', '€42 over the €64 planned this month');
  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  await expect(bar).toHaveAttribute('aria-valuemax', '100');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('an amount under 50 cents keeps its cents instead of reading as €0', async ({ page }) => {
  await completeSetup(page);
  const card = leftThisMonth(page);
  const row = (name: string) => envelopes(page).getByRole('listitem').filter({ hasText: name });
  await expect(card.getByText('€224', { exact: true })).toBeVisible();

  // €159.60 of food's €160 leaves €0.40.
  await quickAdd(page, 'Rewe 159,60');
  await page.getByRole('button', { name: 'Food & groceries' }).click();
  await expect(row('Food & groceries').getByText('€0.40 left of €160 this month', { exact: true })).toBeVisible();
  await expect(card.getByText('€64.40', { exact: true })).toHaveCount(0);
  await expect(card.getByText('€64', { exact: true })).toBeVisible();

  // Eating out used up exactly: a plain €0, and the whole month is down to the €0.40 in food.
  await quickAdd(page, 'döner 64');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(row('Eating out').getByText('€0 left of €64 this month', { exact: true })).toBeVisible();
  await expect(card.getByText('€0.40', { exact: true })).toBeVisible();

  // 80 cents more is €0.40 over, in food and in total.
  await quickAdd(page, 'Rewe 0,80');
  await expect(
    row('Food & groceries').getByText('€0.40 over the €160 planned this month', { exact: true }),
  ).toBeVisible();
  await expect(card.getByText('€0.40 over this month', { exact: true })).toBeVisible();
});

test('the week follows the date when the app is opened again on a later day', async ({ page }) => {
  await completeSetup(page);
  // Coming back also refreshes the exchange rates, and a stored rate would refresh home as a side effect.
  // Let that fail, so only the date can move home on.
  await page.route(FRANKFURTER, (route) => route.abort());
  // Sunday 18 Oct: the last day of the week 12-18, three days after setup.
  await page.clock.setFixedTime(new Date(2026, 9, 18, 12, 0, 0));
  await page.reload();
  const card = leftThisMonth(page);
  await expect(card.getByText('This week: €42 safe to spend', { exact: true })).toBeVisible();

  // Monday just after midnight. Nothing is written; the app only comes back from the background.
  await page.clock.setFixedTime(new Date(2026, 9, 19, 0, 0, 5));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  // Ten days of the plan so far this month: food 310 * 10/31 + eating out 124 * 10/31.
  await expect(card.getByText('This week: €140 safe to spend', { exact: true })).toBeVisible();
  // The month does not change with the week.
  await expect(card.getByText('€224', { exact: true })).toBeVisible();

  // The next week is cut off at the end of October. This time the window gets focus.
  await page.clock.setFixedTime(new Date(2026, 9, 26, 9, 0, 0));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card.getByText('This week: €224 safe to spend', { exact: true })).toBeVisible();
});

test('the week turns over at midnight while the app stays open', async ({ page }) => {
  // Sunday 11 Oct, ten minutes before midnight; the clock runs from here. Far from the real date, so
  // completeSetup does not mistake it for a real clock and pin it.
  await page.clock.install({ time: new Date(2026, 9, 11, 23, 50, 0) });
  await completeSetup(page);
  const card = leftThisMonth(page);
  // One day of budget so far (the setup day): food 310/31 + eating out 124/31.
  await expect(card.getByText('This week: €14 safe to spend', { exact: true })).toBeVisible();

  // Nobody touches the app, and no entry is saved: the timer for midnight does it. Mon 12 - Sun 18 Oct has
  // eight days of budget counted from the 11th.
  await page.clock.fastForward('15:00');
  await expect(card.getByText('This week: €112 safe to spend', { exact: true })).toBeVisible();
});

test('coming back from another page shows what was added there', async ({ page }) => {
  await completeSetup(page);
  await expect(leftThisMonth(page).getByText('€224', { exact: true })).toBeVisible();

  // The dev server's "Cache disabled" badge covers the left of the nav on a phone, so the click goes to the link.
  await page.getByRole('link', { name: 'Entries' }).dispatchEvent('click');
  await expect(page.getByRole('heading', { level: 2, name: 'Entries' })).toBeVisible();
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  await page.getByRole('link', { name: 'Home' }).dispatchEvent('click');
  await expect(leftThisMonth(page).getByText('€218', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('the Saved line is gone when the person comes back to the page', async ({ page }) => {
  await completeSetup(page);
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

  // The router keeps home mounted but hidden, with its state: the line would still be there, and Undo
  // would still delete the entry, however much has changed since.
  await page.getByRole('link', { name: 'Entries' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Entries' })).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(leftThisMonth(page).getByText('€218', { exact: true })).toBeVisible();

  await expect(page.getByRole('status')).toHaveText('');
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('the Saved line goes away on its own after ten seconds', async ({ page }) => {
  // A running clock far from the real date, so completeSetup does not pin it and the timers can be moved on.
  await page.clock.install({ time: new Date(2026, 9, 16, 12, 0, 0) });
  await completeSetup(page);
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  await page.clock.fastForward(5_000);
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  await page.clock.fastForward(6_000);
  await expect(page.getByRole('status')).toHaveText('');
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('shows the total across all accounts, in euros', async ({ page }) => {
  await completeSetup(page);

  // Local bank €1,000 + Home bank 50,000 INR at 95 (€526.32) + Cash €50. The rate arrives after setup.
  await expect(page.getByText('Across all accounts: €1,576', { exact: true })).toBeVisible();
  await expect(page.getByText('rate missing')).toHaveCount(0);

  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByText('Across all accounts: €1,570', { exact: true })).toBeVisible();
});

test('says which rate is missing and shows a dash when nothing could be converted', async ({ page }) => {
  await fillSetup(page);
  // Registered after the wizard's mock, so it answers first: the INR rate never arrives.
  await page.route(FRANKFURTER, (route) => route.abort());
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page).toHaveURL('/');

  // The two euro accounts still count.
  await expect(page.getByText('Across all accounts: €1,050', { exact: true })).toBeVisible();
  await expect(page.getByText('INR rate missing', { exact: true })).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete Local bank' }).click();
  await page.getByRole('button', { name: 'Delete Cash' }).click();
  await expect(page.getByRole('button', { name: 'Delete Cash' })).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByText('Across all accounts: —', { exact: true })).toBeVisible();
  await expect(page.getByText('INR rate missing', { exact: true })).toBeVisible();
});

test('later in the month the suggested budget waits behind a link, and Not now puts it away again', async ({
  page,
}) => {
  await completeSetup(page);

  // The 16th, with the envelopes inside what is available: nothing asks for attention.
  await expect(suggestion(page)).toHaveCount(0);
  await expect(suggestionLink(page)).toBeVisible();

  await suggestionLink(page).click();
  await expect(suggestion(page)).toBeVisible();
  await expect(suggestionLink(page)).toHaveCount(0);
  await expect(suggestion(page).getByText('€440 a month is available after your fixed costs and set-asides.')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await suggestion(page).getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(suggestion(page)).toHaveCount(0);
  await expect(suggestionLink(page)).toBeVisible();
});

test('the suggested budget leads when the envelopes are more than what is available', async ({ page }) => {
  await completeSetup(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  // Food at €500 and eating out at €124 are €624 of €440.
  const envelopeRows: Amount[] = plan.envelopes.map((e) =>
    e.categoryId === 'food' ? { ...e, monthlyMinor: 50000 } : e,
  );
  await writeStore(page, 'plan', [{ ...plan, envelopes: envelopeRows }]);
  await page.reload();

  await expect(suggestion(page)).toBeVisible();
  await expect(suggestionLink(page)).toHaveCount(0);
});

test('says calmly that nothing is available, and suggests €0', async ({ page }) => {
  await completeSetup(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  // No income at all: fixed costs and the set-aside are more than what comes in.
  await writeStore(page, 'plan', [{ ...plan, incomes: [] }]);
  await page.reload();

  const panel = suggestion(page);
  const useBudget = panel.getByRole('button', { name: 'Use this budget', exact: true });
  const food = panel.getByRole('textbox', { name: 'Food & groceries per month', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Nothing is available to budget yet', { exact: false })).toBeVisible();
  await expect(panel.getByText('You can change your plan in Settings.', { exact: false })).toBeVisible();
  await expect(food).toHaveValue('');
  await expect(panel.getByText('left for savings', { exact: false })).toHaveCount(0);

  // Using €0 everywhere would empty every envelope in one tap, so the button waits for an amount.
  await expect(useBudget).toBeDisabled();
  await food.fill('50');
  await expect(useBudget).toBeEnabled();
  await food.fill('');
  await expect(useBudget).toBeDisabled();

  // Nothing was written.
  const [after] = await readStore<Plan>(page, 'plan');
  expect(after.envelopes).toEqual(plan.envelopes);
});

test('when the plan fits, each ranged category starts at the middle of its range, to the nearest €5', async ({
  page,
}) => {
  // Income of €1,900: €1,440 is available after the rent and the €60 set-aside, more than the middles add up to.
  await completeSetup(page, { incomes: { parents: '1500', job: '400' } });
  await suggestionLink(page).click();
  const panel = suggestion(page);
  const field = (name: string) => panel.getByRole('textbox', { name: `${name} per month`, exact: true });

  await expect(panel.getByText('€1,440 a month is available after your fixed costs and set-asides.')).toBeVisible();
  // Food's middle is €257.50 and eating out's €82.50, so both round up.
  await expect(field('Food & groceries')).toHaveValue('260');
  await expect(field('Eating out')).toHaveValue('85');
  await expect(field('Going out')).toHaveValue('75');
  await expect(field('Transport')).toHaveValue('35');
  await expect(field('Shopping')).toHaveValue('50');
  await expect(field('Other')).toHaveValue('135');
  // €640 of €1,440.
  await expect(panel.getByText('€800 left for savings', { exact: true })).toBeVisible();
});

test('Not now and the saved note last until the month turns', async ({ page }) => {
  await completeSetup(page);
  // Tuesday 3 Nov: the first week, so the suggestion leads.
  await reopenOn(page, new Date(2026, 10, 3, 12, 0, 0));
  await expect(suggestion(page)).toBeVisible();
  await suggestion(page).getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(suggestion(page)).toHaveCount(0);
  await expect(suggestionLink(page)).toBeVisible();

  // Tuesday 1 Dec, with the app still open: a new month, so it leads again.
  await page.clock.setFixedTime(new Date(2026, 11, 1, 9, 0, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(suggestion(page)).toBeVisible();

  // Using it leaves a note, and that goes with the month too.
  await suggestion(page).getByRole('button', { name: 'Use this budget', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Envelopes updated.' })).toBeVisible();
  await expect(suggestion(page)).toHaveCount(0);

  await page.clock.setFixedTime(new Date(2027, 0, 1, 9, 0, 0));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(suggestion(page)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Envelopes updated.' })).toHaveCount(0);
});

test('in the first week of the month the suggested budget leads, and using it changes only the envelopes', async ({
  page,
}) => {
  await completeSetup(page);
  // October spending in a category the city has no range for: November's suggestion starts from it.
  await seedExpense(page, 'health', '2026-10-20', 1200);
  await seedExpense(page, 'study', '2026-10-21', 200);
  const guessesBefore = await readStore(page, 'guesses');
  const [planBefore] = await readStore<Plan>(page, 'plan');
  expect(guessesBefore).toHaveLength(6);

  // Tuesday 3 Nov: November is a full month for the plan, and its first week.
  await reopenOn(page, new Date(2026, 10, 3, 12, 0, 0));
  const panel = suggestion(page);
  await expect(panel).toBeVisible();
  await expect(suggestionLink(page)).toHaveCount(0);

  // Before: food 310 and eating out 124 for the whole month, and eight of November's thirty days so far.
  const card = leftThisMonth(page);
  await expect(card.getByText('€434', { exact: true })).toBeVisible();
  await expect(card.getByText('This week: €116 safe to spend', { exact: true })).toBeVisible();
  await expect(envelopes(page).getByRole('listitem')).toHaveCount(2);

  // The middles of the ranges, rounded to €5, add up to €640, and €650 with health's €10: more than the €440
  // available, so every ranged category is at the bottom of its range.
  await expect(panel.getByText('€440 a month is available after your fixed costs and set-asides.')).toBeVisible();
  const field = (name: string) => panel.getByRole('textbox', { name: `${name} per month`, exact: true });
  await expect(field('Food & groceries')).toHaveValue('180');
  await expect(field('Eating out')).toHaveValue('30');
  await expect(field('Going out')).toHaveValue('30');
  await expect(field('Transport')).toHaveValue('10');
  await expect(field('Shopping')).toHaveValue('35');
  await expect(field('Other')).toHaveValue('95');
  // Last month's €12 is rounded to €5. €2 rounds to €0 but is still spending, so its row keeps that basis (below);
  // a category with neither a range nor spending starts at €0.
  await expect(field('Health & pharmacy')).toHaveValue('10');
  await expect(field('Study materials')).toHaveValue('');
  await expect(field('Gifts')).toHaveValue('');
  await expect(panel.getByText('€50 left for savings', { exact: true })).toBeVisible();

  // Where each amount comes from. Six categories have a range, and each shows its source.
  await expect(panel.getByText('Students here: €180–335', { exact: true })).toBeVisible();
  await expect(panel.getByText('Students here: €30–135 (estimate)', { exact: true })).toBeVisible();
  // Health and study materials both had spending in October; Gifts did not.
  await expect(panel.getByText('Your spending in October', { exact: true })).toHaveCount(2);
  await expect(panel.getByText('Nothing to go on yet', { exact: true })).toHaveCount(4);
  await expect(panel.locator('summary', { hasText: 'Source' })).toHaveCount(6);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Edit one amount: food from €180 to €200 leaves €30.
  await field('Food & groceries').fill('200');
  await expect(panel.getByText('€30 left for savings', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Use this budget', exact: true }).click();

  // The panel steps back and the envelopes follow the amounts, 12 of them, with only the used ones listed.
  await expect(page.getByRole('status').filter({ hasText: 'Envelopes updated.' })).toBeVisible();
  await expect(suggestion(page)).toHaveCount(0);
  await expect(suggestionLink(page)).toBeVisible();
  const list = envelopes(page);
  await expect(list.getByRole('listitem')).toHaveCount(7);
  await expect(list.getByText('€200 left of €200 this month', { exact: true })).toBeVisible();
  await expect(list.getByText('€30 left of €30 this month', { exact: true })).toHaveCount(2);
  await expect(list.getByText('€95 left of €95 this month', { exact: true })).toBeVisible();
  await expect(card.getByText('€410', { exact: true })).toBeVisible();
  await expect(card.getByText('This week: €109 safe to spend', { exact: true })).toBeVisible();

  // Only the envelopes were written: the guesses and the rest of the plan are as they were.
  expect(await readStore(page, 'guesses')).toEqual(guessesBefore);
  const [planAfter] = await readStore<Plan>(page, 'plan');
  expect(planAfter).toEqual({
    ...planBefore,
    envelopes: [
      { categoryId: 'food', monthlyMinor: 20000 },
      { categoryId: 'eating-out', monthlyMinor: 3000 },
      { categoryId: 'going-out', monthlyMinor: 3000 },
      { categoryId: 'transport', monthlyMinor: 1000 },
      { categoryId: 'shopping', monthlyMinor: 3500 },
      { categoryId: 'health', monthlyMinor: 1000 },
      { categoryId: 'personal-care', monthlyMinor: 0 },
      { categoryId: 'study', monthlyMinor: 0 },
      { categoryId: 'household', monthlyMinor: 0 },
      { categoryId: 'travel', monthlyMinor: 0 },
      { categoryId: 'gifts', monthlyMinor: 0 },
      { categoryId: 'other', monthlyMinor: 9500 },
    ],
  });
});
