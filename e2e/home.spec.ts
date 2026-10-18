import { expect, test, type Page } from '@playwright/test';
import { FRANKFURTER, completeSetup, fillSetup } from './helpers/setup';

// `completeSetup` pins the clock to Friday 2026-10-16 and creates the plan that day, so the week Oct 12-18 has
// three days of budget: food 310 * 3/31 = €30 and eating out 124 * 3/31 = €12.

function safeToSpend(page: Page) {
  return page.getByRole('region', { name: 'Safe to spend this week' });
}

function envelopes(page: Page) {
  return page.getByRole('list', { name: 'Envelopes' });
}

async function quickAdd(page: Page, text: string) {
  // By role, not label: a page the router has left stays mounted but hidden, with a field of the same name.
  await page.getByRole('textbox', { name: 'Quick add' }).fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('shows what is safe to spend this week and follows quick add', async ({ page }) => {
  await completeSetup(page);
  const card = safeToSpend(page);

  await expect(card.getByText('€42', { exact: true })).toBeVisible();
  await expect(card.getByText('Mon 12 – Sun 18 Oct', { exact: true })).toBeVisible();

  // The first "döner" has no learned category, so quick add asks.
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(card.getByText('€36', { exact: true })).toBeVisible();

  // Overspending reads calmly and carries into the headline.
  await quickAdd(page, 'döner 300');
  await expect(page.getByRole('status')).toHaveText('Saved €300.00 · döner · Eating out');
  await expect(card.getByText('€264 over this week', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the envelopes show what is left this week and how much of the month is used', async ({ page }) => {
  await completeSetup(page);
  const list = envelopes(page);
  const food = list.getByRole('listitem').filter({ hasText: 'Food & groceries' });
  const eatingOut = list.getByRole('listitem').filter({ hasText: 'Eating out' });

  await expect(food.getByText('€30 left this week', { exact: true })).toBeVisible();
  await expect(eatingOut.getByText('€12 left this week', { exact: true })).toBeVisible();
  // From the setup day only: 16 of October's 31 days are planned.
  await expect(food.getByText('€0 of €160', { exact: true })).toBeVisible();
  await expect(eatingOut.getByText('€0 of €64', { exact: true })).toBeVisible();
  // Envelopes planned at €0 and unused stay out of the way.
  await expect(list.getByRole('listitem')).toHaveCount(2);

  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(eatingOut.getByText('€6 left this week', { exact: true })).toBeVisible();
  await expect(eatingOut.getByText('€6 of €64', { exact: true })).toBeVisible();
  const bar = eatingOut.getByRole('progressbar', { name: 'Eating out this month' });
  await expect(bar).toHaveAttribute('aria-valuetext', '€6 of €64');
  await expect(bar).toHaveAttribute('aria-valuenow', '9');
  await expect(food.getByText('€30 left this week', { exact: true })).toBeVisible();

  // Over the plan: the real numbers show, the bar stops at full.
  await quickAdd(page, 'döner 100');
  await expect(eatingOut.getByText('€94 over this week', { exact: true })).toBeVisible();
  await expect(eatingOut.getByText('€106 of €64', { exact: true })).toBeVisible();
  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  await expect(bar).toHaveAttribute('aria-valuemax', '100');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('an amount under 50 cents keeps its cents instead of reading as €0', async ({ page }) => {
  await completeSetup(page);
  const card = safeToSpend(page);
  const row = (name: string) => envelopes(page).getByRole('listitem').filter({ hasText: name });
  await expect(card.getByText('€42', { exact: true })).toBeVisible();

  // €29.60 of food's €30 leaves €0.40.
  await quickAdd(page, 'Rewe 29,60');
  await page.getByRole('button', { name: 'Food & groceries' }).click();
  await expect(row('Food & groceries').getByText('€0.40 left this week', { exact: true })).toBeVisible();
  await expect(card.getByText('€12', { exact: true })).toBeVisible();

  // Eating out used up exactly: a plain €0, and the whole week is down to the €0.40 in food.
  await quickAdd(page, 'döner 12');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(row('Eating out').getByText('€0 left this week', { exact: true })).toBeVisible();
  await expect(card.getByText('€0.40', { exact: true })).toBeVisible();

  // 80 cents more is €0.40 over, in food and in total.
  await quickAdd(page, 'Rewe 0,80');
  await expect(row('Food & groceries').getByText('€0.40 over this week', { exact: true })).toBeVisible();
  await expect(card.getByText('€0.40 over this week', { exact: true })).toBeVisible();
});

test('coming back from another page shows what was added there', async ({ page }) => {
  await completeSetup(page);
  await expect(safeToSpend(page).getByText('€42', { exact: true })).toBeVisible();

  // The dev server's "Cache disabled" badge covers the left of the nav on a phone, so the click goes to the link.
  await page.getByRole('link', { name: 'Entries' }).dispatchEvent('click');
  await expect(page.getByRole('heading', { level: 2, name: 'Entries' })).toBeVisible();
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  await page.getByRole('link', { name: 'Home' }).dispatchEvent('click');
  await expect(safeToSpend(page).getByText('€36', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/');
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
