import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_SETUP, completeSetup } from './helpers/setup';

// `completeSetup` pins the clock to Friday 2026-10-16 and creates the plan that day, so the week Mon 12 - Sun 18 Oct
// has three days of budget (the 16th, 17th and 18th, of October's 31): food 31000 * 3/31 = 3000, so €30, and
// eating out 12400 * 3/31 = 1200, so €12. Going out, transport, shopping and other are planned at €0 and unused.

function section(page: Page, name: string) {
  // By exact name: "This week" is also part of the name of the headline card on a home page the router keeps hidden.
  return page.getByRole('region', { name, exact: true });
}

/** Waits for one envelope's row on the check-in to show exactly this week line. */
async function expectWeekLine(page: Page, name: string, line: string, region = 'This week against your plan') {
  const row = section(page, region).getByRole('listitem').filter({ hasText: name });
  await expect(row.getByText(line, { exact: true })).toBeVisible();
}

async function quickAdd(page: Page, text: string) {
  // By role, not label: a page the router has left stays mounted but hidden, with a field of the same name.
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/**
 * Adds an expense the way a person does from the check-in: the link to the form for an earlier day. It opens
 * the check-in itself, so the clock has to be set before it.
 */
async function addExpenseFromCheckIn(page: Page, expense: { amount: string; category: string; date: string }) {
  await page.goto('/check-in');
  // The heading only renders once the page has hydrated and read its data, so the link is live.
  await expect(page.getByRole('heading', { level: 3, name: 'Forgot something? Add it here' })).toBeVisible();
  await page.getByRole('link', { name: 'Add something from an earlier day' }).click();
  await expect(page).toHaveURL('/entries/new');
  await page.getByLabel('Amount', { exact: true }).fill(expense.amount);
  await page.getByLabel('Category', { exact: true }).selectOption({ label: expense.category });
  await page.getByLabel('Date', { exact: true }).fill(expense.date);
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL(`/entries?month=${expense.date.slice(0, 7)}`);
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Moves the browser's date to Sunday 18 Oct, noon, and opens the check-in on that day. */
async function openCheckInOnSunday(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 18, 12, 0, 0));
  await page.goto('/check-in');
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly check-in' })).toBeVisible();
}

test('shows each envelope against this week and what was logged', async ({ page }) => {
  await completeSetup(page);
  // The first "döner" has no learned category, so quick add asks.
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  await page.goto('/check-in');
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly check-in' })).toBeVisible();
  await expect(page.getByText('Mon 12 – Sun 18 Oct', { exact: true })).toBeVisible();

  // Only the two envelopes with a plan this week get a row.
  await expect(section(page, 'This week against your plan').getByRole('listitem')).toHaveCount(2);
  await expectWeekLine(page, 'Food & groceries', '€30 planned · €0 spent · €30 under');
  await expectWeekLine(page, 'Eating out', '€12 planned · €6 spent · €6 under');

  const entries = section(page, 'This week').getByRole('listitem');
  await expect(entries).toHaveCount(1);
  await expect(entries.getByText('döner', { exact: true })).toBeVisible();
  await expect(entries.getByText('Eating out · Fri 16', { exact: true })).toBeVisible();
  await expect(entries.getByText('€6.00', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the reminder link points at a calendar file that is served as a calendar', async ({ page }) => {
  await completeSetup(page);
  await page.goto('/check-in');

  await expect(page.getByRole('link', { name: 'Add weekly reminder to calendar' })).toHaveAttribute(
    'href',
    '/weekly-check-in.ics',
  );

  const response = await page.request.get('/weekly-check-in.ics');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/calendar');
  const body = await response.text();
  expect(body).toContain('SUMMARY:StudentsBudget weekly check-in');
  expect(body).toContain('DTSTART:20261018T180000\r\n');
  expect(body).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU\r\n');
});

test('on Sunday a forgotten purchase is added from today or from an earlier day, and the lines follow', async ({
  page,
}) => {
  await completeSetup(page);
  await openCheckInOnSunday(page);
  await expect(page.getByText('Mon 12 – Sun 18 Oct', { exact: true })).toBeVisible();
  await expectWeekLine(page, 'Eating out', '€12 planned · €0 spent · €12 under');
  await expect(section(page, 'This week').getByText('Nothing logged this week yet.', { exact: true })).toBeVisible();

  // Quick add dates the entry today, and spending exactly the week's share reads "on plan".
  await quickAdd(page, 'rewe 30');
  await page.getByRole('button', { name: 'Food & groceries' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €30.00 · rewe · Food & groceries');
  await expectWeekLine(page, 'Food & groceries', '€30 planned · €30 spent · on plan');

  // The date field behind the link covers Saturday's purchase; €15 against eating out's €12 reads calmly.
  await page.getByRole('link', { name: 'Add something from an earlier day' }).click();
  await expect(page).toHaveURL('/entries/new');
  await page.getByLabel('Amount', { exact: true }).fill('15');
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Eating out' });
  await page.getByLabel('Date', { exact: true }).fill('2026-10-17');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');

  await page.goto('/check-in');
  await expectWeekLine(page, 'Eating out', '€12 planned · €15 spent · €3 over');
  await expectWeekLine(page, 'Food & groceries', '€30 planned · €30 spent · on plan');

  // Newest day first: today's rewe, then Saturday's purchase, which has no note and so shows its category.
  const entries = section(page, 'This week').getByRole('listitem');
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText('rewe');
  await expect(entries.nth(0)).toContainText('Food & groceries · Sun 18');
  await expect(entries.nth(1)).toContainText('Eating out');
  await expect(entries.nth(1)).toContainText('Sat 17');
  await expect(entries.nth(1)).toContainText('€15.00');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a Sunday that starts the month also reviews the days of its week in the previous month', async ({ page }) => {
  await completeSetup(page);
  // Sunday 1 Nov: its week is Mon 26 Oct - Sun 1 Nov, and the month's own part is just the Sunday.
  await page.clock.setFixedTime(new Date(2026, 10, 1, 12, 0, 0));
  await addExpenseFromCheckIn(page, { amount: '20', category: 'Eating out', date: '2026-10-28' });

  await page.goto('/check-in');
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly check-in' })).toBeVisible();
  // The previous month's days come first, then the Sunday; the quick add stays at the end, once.
  await expect(page.getByRole('heading', { level: 3 })).toHaveText([
    'Earlier this week against your plan',
    'Earlier this week',
    'This week against your plan',
    'This week',
    'Forgot something? Add it here',
  ]);
  await expect(page.getByText('Mon 26 – Sat 31 Oct', { exact: true })).toBeVisible();
  await expect(page.getByText('Sun 1 Nov', { exact: true })).toBeVisible();

  // October's budget runs from the setup day, Fri 16: 16 of its 31 days by Sat 31, 10 of them before Mon 26.
  const earlierPlan = 'Earlier this week against your plan';
  await expectWeekLine(page, 'Food & groceries', '€60 planned · €0 spent · €60 under', earlierPlan);
  await expectWeekLine(page, 'Eating out', '€24 planned · €20 spent · €4 under', earlierPlan);
  const earlier = section(page, 'Earlier this week').getByRole('listitem');
  await expect(earlier).toHaveCount(1);
  await expect(earlier).toContainText('Eating out');
  await expect(earlier).toContainText('Wed 28');
  await expect(earlier).toContainText('€20.00');
  await expect(earlier).not.toContainText('not counted');

  // November's budget starts on the 1st, over its 30 days, so the Sunday has one day of it and none of the entries.
  await expectWeekLine(page, 'Food & groceries', '€10 planned · €0 spent · €10 under');
  await expectWeekLine(page, 'Eating out', '€4 planned · €0 spent · €4 under');
  await expect(section(page, 'This week').getByText('Nothing logged this week yet.', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("a plan set up late in the month reviews the previous month's tail from its setup day, and says what is not counted", async ({
  page,
}) => {
  // Wed 28 Oct: the budget starts then, so Mon 26 and Tue 27 come before it.
  await page.clock.setFixedTime(new Date(2026, 9, 28, 12, 0, 0));
  await completeSetup(page);
  await addExpenseFromCheckIn(page, { amount: '20', category: 'Eating out', date: '2026-10-26' });
  await addExpenseFromCheckIn(page, { amount: '10', category: 'Eating out', date: '2026-10-29' });

  await page.clock.setFixedTime(new Date(2026, 10, 1, 12, 0, 0));
  await page.goto('/check-in');
  await expect(page.getByText('Mon 26 – Sat 31 Oct', { exact: true })).toBeVisible();

  // Four days of October's budget (28th to 31st) and only the €10 from the 29th against it.
  const earlierPlan = 'Earlier this week against your plan';
  await expectWeekLine(page, 'Food & groceries', '€40 planned · €0 spent · €40 under', earlierPlan);
  await expectWeekLine(page, 'Eating out', '€16 planned · €10 spent · €6 under', earlierPlan);

  // Newest day first. Monday's €20 is listed, with the reason it is not in the line above.
  const earlier = section(page, 'Earlier this week').getByRole('listitem');
  await expect(earlier).toHaveCount(2);
  await expect(earlier.nth(0)).toContainText('Thu 29');
  await expect(earlier.nth(0)).toContainText('€10.00');
  await expect(earlier.nth(0)).not.toContainText('not counted');
  await expect(earlier.nth(1)).toContainText('Mon 26');
  await expect(earlier.nth(1)).toContainText('€20.00');
  await expect(earlier.nth(1).getByText('Before your plan started, not counted', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('a plan set up on that Sunday has no earlier month to review', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 1, 12, 0, 0));
  // The fee has one month fewer to be spread over than on 16 Oct, so it falls due a month later.
  await completeSetup(page, { oneOff: { ...DEFAULT_SETUP.oneOff, dueMonth: '2027-04' } });

  await page.goto('/check-in');
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly check-in' })).toBeVisible();
  await expect(page.getByText('Sun 1 Nov', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveText([
    'This week against your plan',
    'This week',
    'Forgot something? Add it here',
  ]);
  await expect(page.getByText('Mon 26 – Sat 31 Oct')).toHaveCount(0);
});

test('an expense dated before the plan started is listed with a note that it is not counted', async ({ page }) => {
  await completeSetup(page);
  await page.clock.setFixedTime(new Date(2026, 9, 18, 12, 0, 0));
  // Tue 13 is in the week Mon 12 - Sun 18, but the plan only starts on Fri 16.
  await addExpenseFromCheckIn(page, { amount: '20', category: 'Eating out', date: '2026-10-13' });
  await addExpenseFromCheckIn(page, { amount: '5', category: 'Eating out', date: '2026-10-17' });

  await page.goto('/check-in');
  await expectWeekLine(page, 'Eating out', '€12 planned · €5 spent · €7 under');
  const entries = section(page, 'This week').getByRole('listitem');
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText('Sat 17');
  await expect(entries.nth(0)).not.toContainText('not counted');
  await expect(entries.nth(1)).toContainText('Tue 13');
  await expect(entries.nth(1)).toContainText('€20.00');
  await expect(entries.nth(1).getByText('Before your plan started, not counted', { exact: true })).toBeVisible();
  await expect(page.getByText('Before your plan started, not counted')).toHaveCount(1);
  // No tail on this Sunday: its week starts in its own month.
  await expect(page.getByRole('heading', { level: 3, name: 'Earlier this week' })).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('home says when the check-in is and highlights it on Sunday', async ({ page }) => {
  await completeSetup(page);
  const card = page.getByRole('link', { name: /Weekly check-in/ });
  const border = () => card.evaluate((element) => getComputedStyle(element).borderTopColor);

  await expect(card.getByText('Your weekly check-in is on Sunday.', { exact: true })).toBeVisible();
  await expect(page.getByText(/time for your weekly check-in/)).toHaveCount(0);
  const ordinaryBorder = await border();

  // Sunday 18 Oct. Nothing is written; the app only comes back from the background.
  await page.clock.setFixedTime(new Date(2026, 9, 18, 12, 0, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByText("It's Sunday — time for your weekly check-in.", { exact: true })).toBeVisible();
  await expect(page.getByText('Your weekly check-in is on Sunday.')).toHaveCount(0);
  expect(await border()).not.toBe(ordinaryBorder);

  // Monday morning: back to the ordinary card.
  await page.clock.setFixedTime(new Date(2026, 9, 19, 8, 0, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card.getByText('Your weekly check-in is on Sunday.', { exact: true })).toBeVisible();
  expect(await border()).toBe(ordinaryBorder);

  await card.click();
  await expect(page).toHaveURL('/check-in');
  await expect(page.getByRole('heading', { level: 2, name: 'Weekly check-in' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('without a plan the check-in points to setup', async ({ page }) => {
  await page.goto('/check-in');
  await expect(page.getByText('Set up your plan to check in on your week.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start setup' })).toHaveAttribute('href', '/setup');
});
