import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry, Guess, Plan } from '../src/db/types';
import { DEFAULT_SETUP, budgetField, completeSetup, fillSetup, mockFrankfurter, readStore } from './helpers/setup';

// The fixture's numbers depend on the month (the 300 fee is spread from the current month to March).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 12, 0, 0));
});

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

/** On home, whatever it shows: the URL is '/', the wizard is gone, and Quick add is up (home renders it once it has found the plan). */
async function expectOnHome(page: Page) {
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeVisible();
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** The income-based line of the edit wizard. A new setup shows none of it. */
function incomeMath(page: Page) {
  return page.getByText(/Available €|Planned €|Over by €/);
}

function box(page: Page, name: string) {
  return page.getByRole('textbox', { name, exact: true });
}

/** The calm total under the envelopes: "€394 of your €600 budget" or "€40 over your €600 budget". */
function budgetTotal(page: Page, budget: string) {
  return page.getByText(new RegExp(`^€[\\d,]+ (of|over) your ${budget} budget$`));
}

/** The envelopes' "Suggested: €X" lines, read where a person finds them: in the description of each field. */
async function expectSuggested(page: Page, suggested: Record<string, number>) {
  for (const [name, euros] of Object.entries(suggested)) {
    await expect(box(page, name), name).toHaveAccessibleDescription(new RegExp(`Suggested: €${euros}(?!\\d)`));
  }
}

/** Opens what the page keeps collapsed under the everyday budget, down to the longest source text (food). */
async function openBudgetSources(page: Page) {
  await page.getByText('Where this comes from', { exact: true }).click();
  await page.getByText('Source: Food & groceries', { exact: true }).click();
  await expect(page.getByText('DSW 22nd Sozialerhebung 2021, national mean €194').first()).toBeVisible();
}

/** What a €600 budget suggests for each of the six envelopes while none is set. */
const SUGGESTED_AT_600 = {
  'Food & groceries': 250,
  'Eating out': 75,
  'Going out': 70,
  Transport: 30,
  Shopping: 45,
  Other: 130,
};

test('saves a plan that is over what is available, with no income math in the way', async ({ page }) => {
  // €310 + €155 = €465 of envelopes against €440 available (900 income, 400 rent, 60 set aside).
  await fillSetup(page, { envelopes: { ...DEFAULT_SETUP.envelopes, 'eating-out': '155' } });

  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes' })).toBeVisible();
  await expect(incomeMath(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled();

  // The city range is information next to each envelope, and the hint appears only below it.
  // A range with a source reads plainly; one nobody published is labelled as an estimate.
  await expect(page.getByText('Students here: €180–335', { exact: true })).toBeVisible();
  await expect(page.getByText('Students here: €30–135 (estimate)', { exact: true })).toBeVisible();
  await expect(page.getByText('Below what students here typically need.')).toHaveCount(4);
  // Without a budget there is nothing to suggest and no budget line.
  await expect(budgetField(page)).toHaveValue('');
  await expect(page.getByText(/^Suggested: /)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use the suggested amounts', exact: true })).toHaveCount(0);
  await expect(budgetTotal(page, '€[\\d,]+')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan.envelopes.find((e) => e.categoryId === 'eating-out')?.monthlyMinor).toBe(15500);
  expect(plan).not.toHaveProperty('spendingBudgetMinor');
});

test('saves a plan with everything at €0 and every guess left blank', async ({ page }) => {
  const blank = { food: '', 'eating-out': '', 'going-out': '', transport: '', shopping: '', other: '' };
  await fillSetup(page, {
    rent: '0',
    incomes: { parents: '', job: '' },
    // A row without an amount is left out, whatever else it holds.
    oneOff: { name: 'Laptop', amount: '', dueMonth: '' },
    guesses: blank,
    envelopes: blank,
  });

  await expect(incomeMath(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);

  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan.incomes).toEqual([]);
  expect(plan.fixed).toEqual([{ categoryId: 'rent', monthlyMinor: 0 }]);
  expect(plan.oneOffs).toEqual([]);
  expect(plan.envelopes.every((e) => e.monthlyMinor === 0)).toBe(true);
  expect(plan).not.toHaveProperty('spendingBudgetMinor');
  // A guess left blank is not saved, so there is nothing to compare later.
  expect(await readStore<Guess>(page, 'guesses')).toEqual([]);

  // So home has no guesses card to wait for (it has found its data once it shows the total), and the reveal page
  // says there is nothing to compare, with no unlock date.
  await expect(page.getByText(/^Across all accounts/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your guesses' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'See how your guesses compare' })).toHaveCount(0);
  await page.goto('/reveal');
  await expect(
    page.getByText('No guesses were saved in setup, so there is nothing to compare.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/unlock on/)).toHaveCount(0);
});

test('a budget of €600 suggests all of it, and Use the suggested amounts fills the six envelopes', async ({ page }) => {
  const nothing = { food: '', 'eating-out': '', 'going-out': '', transport: '', shopping: '', other: '' };
  await fillSetup(page, { budget: '600', envelopes: nothing });
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes' })).toBeVisible();
  await expect(incomeMath(page)).toHaveCount(0);

  // €600 is between the minimums (€380) and the middles (€640): each envelope sits the same share up its range,
  // and the six suggestions add up to the whole budget.
  await expectSuggested(page, SUGGESTED_AT_600);
  await expect(page.getByText('Students here: €180–335', { exact: true })).toBeVisible();
  const total = budgetTotal(page, '€600');
  await expect(total).toHaveText('€0 of your €600 budget');
  await expect(page.locator('[aria-live="polite"]', { has: total })).toHaveCount(1);

  await page.getByRole('button', { name: 'Use the suggested amounts', exact: true }).click();
  const filled: Record<string, string> = {
    'Food & groceries': '250',
    'Eating out': '75',
    'Going out': '70',
    Transport: '30',
    Shopping: '45',
    Other: '130',
  };
  for (const [name, value] of Object.entries(filled)) await expect(box(page, name)).toHaveValue(value);
  await expect(total).toHaveText('€600 of your €600 budget');
  // Nothing is left to fill, so the button is gone.
  await expect(page.getByRole('button', { name: 'Use the suggested amounts', exact: true })).toHaveCount(0);

  // Going over reads plainly and calmly, and nothing stops Save.
  await box(page, 'Food & groceries').fill('450');
  await expect(total).toHaveText('€200 over your €600 budget');
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled();
  await box(page, 'Food & groceries').fill('250');

  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan.spendingBudgetMinor).toBe(60000);
  expect(plan.envelopes.find((e) => e.categoryId === 'other')?.monthlyMinor).toBe(13000);
});

test('typing into one envelope moves the suggestions of the others, and the button fills only the empty ones', async ({
  page,
}) => {
  const nothing = { food: '', 'eating-out': '', 'going-out': '', transport: '', shopping: '', other: '' };
  await fillSetup(page, { budget: '600', envelopes: nothing });
  await expectSuggested(page, SUGGESTED_AT_600);

  // Food is set to €300: it keeps its own suggestion, and the other five share the €300 that is left.
  await box(page, 'Food & groceries').fill('300');
  await expectSuggested(page, {
    'Food & groceries': 250,
    'Eating out': 60,
    'Going out': 55,
    Transport: 25,
    Shopping: 45,
    Other: 115,
  });
  // The city ranges are information, and stay as they were.
  await expect(page.getByText('Students here: €180–335', { exact: true })).toBeVisible();
  await expect(page.getByText('Students here: €30–135 (estimate)', { exact: true })).toBeVisible();
  await expect(budgetTotal(page, '€600')).toHaveText('€300 of your €600 budget');

  await page.getByRole('button', { name: 'Use the suggested amounts', exact: true }).click();
  const expected: Record<string, string> = {
    'Food & groceries': '300',
    'Eating out': '60',
    'Going out': '55',
    Transport: '25',
    Shopping: '45',
    Other: '115',
  };
  for (const [name, value] of Object.entries(expected)) await expect(box(page, name)).toHaveValue(value);
  await expect(budgetTotal(page, '€600')).toHaveText('€600 of your €600 budget');
  await expect(page.getByRole('button', { name: 'Use the suggested amounts', exact: true })).toHaveCount(0);

  // Clearing an envelope sets it free again: it is suggested what is left, and the button is back for it.
  await box(page, 'Transport').fill('');
  await expect(page.getByRole('button', { name: 'Use the suggested amounts', exact: true })).toBeVisible();
  await expect(box(page, 'Transport')).toHaveAccessibleDescription(/Suggested: €25(?!\d)/);
});

test('the first setup asks only the basic questions, with the budget at the top of the envelopes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockFrankfurter(page);
  await page.goto('/setup');
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
  await expect(page.getByText('Step 1 of 7', { exact: true })).toBeVisible();
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const heading = (name: string) => page.getByRole('heading', { level: 3, name, exact: true });

  const go = async (name: string) => {
    await next.click();
    await expect(heading(name)).toBeVisible();
  };

  await go('Accounts');
  await go('Income');
  for (const name of ['Job', 'Parents', 'Blocked account', 'Other income']) await expect(box(page, name)).toBeVisible();
  for (const name of ['BAföG', 'Scholarship']) await expect(box(page, name)).toHaveCount(0);
  await expect(
    page.getByText(
      "Living off savings? Add what you use each month under Other income and switch off Add it automatically, so money already in your account isn't counted twice.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Get BAföG or a scholarship? Add it later under Edit plan in Settings.', { exact: true }),
  ).toBeVisible();

  await go('Fixed costs');
  for (const name of ['Phone & internet', 'Insurance', 'Deutschlandticket / semester ticket']) {
    await expect(box(page, name)).toBeVisible();
  }
  for (const name of ['Subscriptions', 'Gym & sports', 'Utilities & Rundfunkbeitrag']) {
    await expect(box(page, name)).toHaveCount(0);
  }
  await expect(
    page.getByText(
      'Subscriptions, the gym, utilities and the Rundfunkbeitrag can be added later under Edit plan in Settings.',
      { exact: true },
    ),
  ).toBeVisible();

  await go('One-off costs');
  await expect(page.getByText(/A cost without an amount isn't saved\./)).toBeVisible();
  await go('Guesses');
  await expect(page.getByText(/Skip any you're not sure about\./)).toBeVisible();
  // Every guess is blank, and Next goes on.
  await go('Envelopes');
  await expect(page.getByText('Step 7 of 7', { exact: true })).toBeVisible();
  for (const name of ['Food & groceries', 'Eating out', 'Going out', 'Transport', 'Shopping', 'Other']) {
    await expect(box(page, name)).toBeVisible();
  }
  for (const name of ['Health & pharmacy', 'Personal care', 'Study materials', 'Household', 'Travel', 'Gifts']) {
    await expect(box(page, name)).toHaveCount(0);
  }
  await expect(incomeMath(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled();

  // The budget is the first question of this step, blank, with what students here typically spend: the six
  // minimums to the six maximums, and which of those are estimates.
  await expect(page.getByText('An everyday budget is optional: with one, each envelope below gets a suggested amount.', { exact: true })).toBeVisible();
  await expect(budgetField(page)).toHaveValue('');
  await expect(
    page.getByText(
      'Students here typically spend about €380–890 a month on these. Eating out, going out and transport are estimates.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'How much do you want to allow yourself for each of these a month, in euros? You can change them, and add envelopes like study materials or travel, under Edit plan in Settings.',
      { exact: true },
    ),
  ).toBeVisible();
  const budgetBox = await budgetField(page).boundingBox();
  const foodBox = await box(page, 'Food & groceries').boundingBox();
  expect(budgetBox && foodBox && budgetBox.y < foodBox.y).toBe(true);
  await openBudgetSources(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('the sources under the budget list the six ranges, and Eating out says it is an estimate', async ({ page }) => {
  await fillSetup(page);

  await expect(page.locator('details[open]')).toHaveCount(0);
  await page.getByText('Where this comes from', { exact: true }).click();
  await expect(page.locator('details[open]')).toHaveCount(1);
  await expect(page.getByText(/^Source: /)).toHaveCount(6);
  for (const name of ['Food & groceries', 'Eating out', 'Going out', 'Transport', 'Shopping', 'Other']) {
    await expect(page.getByText(`Source: ${name}`, { exact: true })).toBeVisible();
  }

  const eatingOut = page.getByText('Source: Eating out', { exact: true });
  await eatingOut.click();
  await expect(eatingOut.locator('xpath=..').getByText('Estimate', { exact: true })).toBeVisible();
  await expect(eatingOut.locator('xpath=..').getByRole('link', { name: 'stwno.de' })).toHaveAttribute(
    'href',
    'https://stwno.de/de/gastronomie/speiseplan/uni-regensburg/mensa-ur',
  );
});

test('text that is not an amount in the everyday budget is named, and fixing it lets the plan save', async ({
  page,
}) => {
  await fillSetup(page);

  await budgetField(page).fill('abc');
  await budgetField(page).blur();
  await expect(page.getByText('Enter a number, like 250 or 12.50.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(inlineAlert(page)).toHaveText('Check the amount for your everyday budget.');
  await expect(page).toHaveURL('/setup');

  await budgetField(page).fill('600');
  await expect(inlineAlert(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan.spendingBudgetMinor).toBe(60000);
});

test('the rent range shows where it comes from, collapsed until asked for', async ({ page }) => {
  await mockFrankfurter(page);
  await page.goto('/setup');
  await expect(page.getByLabel('Rent per month')).toBeVisible();

  await expect(page.getByText('Rooms here: €215–561', { exact: true })).toBeVisible();
  await expect(page.getByText('Source', { exact: true })).toHaveCount(1);
  await expect(page.locator('details[open]')).toHaveCount(0);

  await page.getByText('Source', { exact: true }).click();
  await expect(page.getByText('Universität Regensburg: cheapest Studierendenwerk room')).toBeVisible();
  await expect(page.getByText('checked 16-10-2026', { exact: true })).toBeVisible();
  const link = page.getByRole('link', { name: 'uni-regensburg.de' });
  await expect(link).toHaveAttribute(
    'href',
    'https://www.uni-regensburg.de/studieren/rund-ums-studium/wohnen-in-regensburg',
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('every envelope range shows its source, and an estimate says so', async ({ page }) => {
  await fillSetup(page);

  await expect(page.getByText('Source', { exact: true })).toHaveCount(6);
  await expect(page.locator('details[open]')).toHaveCount(0);

  // The sources under the everyday budget are details of their own ("Source: Food & groceries" and so on, inside
  // "Where this comes from"); these are the six that say just "Source", one under each envelope.
  const sources = page.locator('details').filter({ has: page.getByText('Source', { exact: true }) });
  await expect(sources).toHaveCount(6);

  // Food has the longest source text; it has to wrap on a phone.
  const food = sources.nth(0);
  await food.getByText('Source', { exact: true }).click();
  await expect(food.getByText('DSW 22nd Sozialerhebung 2021, national mean €194')).toBeVisible();
  await expect(food.getByText('checked 16-10-2026', { exact: true })).toBeVisible();
  await expect(food.getByRole('link', { name: 'studierendenwerke.de' })).toHaveAttribute('target', '_blank');
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Eating out is an estimate: its source says so and links to a price it was built from, without a cache-buster.
  const eatingOut = sources.nth(1);
  await eatingOut.getByText('Source', { exact: true }).click();
  await expect(eatingOut.getByText('Estimate', { exact: true })).toBeVisible();
  await expect(eatingOut.getByRole('link', { name: 'stwno.de' })).toHaveAttribute(
    'href',
    'https://stwno.de/de/gastronomie/speiseplan/uni-regensburg/mensa-ur',
  );
});

test('saves and lands on home', async ({ page }) => {
  await completeSetup(page);

  await page.reload();
  // The nav only shows once the saved plan is found, so this also proves there was no redirect to /setup.
  await expectOnHome(page);

  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan).toMatchObject({
    id: 'current',
    cityId: 'regensburg',
    createdOn: '2026-10-16',
    incomes: [
      { categoryId: 'income-job', monthlyMinor: 40000 },
      { categoryId: 'income-parents', monthlyMinor: 50000 },
    ],
    fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }],
  });
  // The helper adds rent and income by hand unless a test asks for schedules.
  expect([...plan.incomes, ...plan.fixed].some((line) => line.schedule)).toBe(false);
  expect(plan.oneOffs).toMatchObject([
    { name: 'Semester fee', amountMinor: 30000, createdMonth: '2026-10', dueMonth: '2027-03' },
  ]);
  expect(plan.envelopes.find((e) => e.categoryId === 'eating-out')?.monthlyMinor).toBe(12400);

  const guesses = await readStore<Guess>(page, 'guesses');
  expect(guesses).toHaveLength(6);
  expect(guesses.every((g) => g.guessedOn === '2026-10-16')).toBe(true);
  expect(guesses.find((g) => g.categoryId === 'eating-out')?.monthlyMinor).toBe(8000);

  const accounts = await readStore<Account>(page, 'accounts');
  expect(accounts.map((a) => [a.name, a.currency, a.openingMinor]).sort()).toEqual([
    ['Cash', 'EUR', 5000],
    ['Home bank', 'INR', 5000000],
    ['Local bank', 'EUR', 100000],
  ]);

  // Setup fetched the INR rate for the new account.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText('50,000.00')).toBeVisible();
  await expect(page.getByText('1 € = 95 INR')).toBeVisible();
});

test('home sends a first-time visitor to setup', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/setup');
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
});

test('setup cannot run a second time', async ({ page }) => {
  await completeSetup(page);
  await page.goto('/setup');
  await expectOnHome(page);
});

test('explains what is missing before moving on and keeps what was typed', async ({ page }) => {
  await mockFrankfurter(page);
  await page.goto('/setup');
  const rent = page.getByLabel('Rent per month');
  await expect(rent).toBeVisible();
  await expect(page.getByText('Rooms here: €215–561', { exact: true })).toBeVisible();

  await rent.fill('abc');
  await rent.blur();
  await expect(page.getByText('Enter a number, like 250 or 12.50.')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(inlineAlert(page)).toHaveText('Check the amount for Rent.');
  await rent.fill('400');
  await expect(inlineAlert(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'Accounts' })).toBeVisible();
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Remove account 1' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(inlineAlert(page)).toHaveText('Add at least one account');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Rent per month')).toHaveValue('400');
});

test.describe('the install hint', () => {
  const HINT = 'Install first: tap Share → Add to Home Screen, then set up there. Data entered in Safari stays in Safari.';
  const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const DESKTOP_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  test.describe('on an iPhone in Safari', () => {
    test.use({ userAgent: IPHONE_UA });

    test('is shown', async ({ page }) => {
      await page.goto('/setup');
      await expect(page.getByText(HINT, { exact: true })).toBeVisible();
    });

    test('is hidden once the app runs from the home screen', async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
      await page.goto('/setup');
      await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
      await expect(page.getByText('Install first')).toHaveCount(0);
    });
  });

  test.describe('on an iPad, which calls itself a Mac', () => {
    test.use({ userAgent: DESKTOP_UA });

    test('is shown', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel' });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
      });
      await page.goto('/setup');
      await expect(page.getByText(HINT, { exact: true })).toBeVisible();
    });
  });

  test.describe('on a desktop browser', () => {
    test.use({ userAgent: DESKTOP_UA });

    test('is hidden', async ({ page }) => {
      // The iPhone project is a touch device, which would pass for an iPad; make this one a plain PC.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'platform', { value: 'Win32' });
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });
      });
      await page.goto('/setup');
      await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
      await expect(page.getByText('Install first')).toHaveCount(0);
    });
  });
});

test('editing the plan skips accounts and guesses and keeps what setup stored', async ({ page }) => {
  await completeSetup(page);

  // A later day in a later month: a kept plan stays 'created on 2026-10-16' and a kept one-off 'from 2026-10'.
  await page.clock.setFixedTime(new Date(2026, 10, 5, 12, 0, 0));
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Edit plan' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Adjust your plan' })).toBeVisible();
  // Accounts and guesses are skipped: five steps.
  await expect(page.getByText('Step 1 of 5', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Rent per month')).toHaveValue('400');
  await page.getByLabel('Rent per month').fill('410');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Edit plan asks about every income source and every fixed cost, not only the basic ones.
  await expect(page.getByRole('heading', { level: 3, name: 'Income' })).toBeVisible();
  await expect(page.getByLabel('Parents', { exact: true })).toHaveValue('500');
  for (const name of ['Job', 'Parents', 'BAföG', 'Blocked account', 'Scholarship', 'Other income']) {
    await expect(box(page, name)).toBeVisible();
  }
  // The pointers to Edit plan are for a new setup: here every source is asked.
  await expect(page.getByText(/Add it later under Edit plan/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'Fixed costs' })).toBeVisible();
  for (const name of [
    'Phone & internet',
    'Insurance',
    'Subscriptions',
    'Deutschlandticket / semester ticket',
    'Gym & sports',
    'Utilities & Rundfunkbeitrag',
  ]) {
    await expect(box(page, name)).toBeVisible();
  }
  await expect(page.getByText(/can be added later under Edit plan/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'One-off costs' })).toBeVisible();
  const oneOff = page.getByRole('group', { name: 'One-off cost 1' });
  await expect(oneOff.getByLabel('Name')).toHaveValue('Semester fee');
  await expect(oneOff.getByLabel('Due month')).toHaveValue('2027-03');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // The everyday budget is the first question of the envelopes step. Nothing is asked of it.
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes' })).toBeVisible();
  await expect(page.getByText('Step 5 of 5', { exact: true })).toBeVisible();
  await expect(budgetField(page)).toHaveValue('');
  await expect(
    page.getByText(
      'How much do you want to allow yourself for each of these a month, in euros? You can change these any time.',
      { exact: true },
    ),
  ).toBeVisible();
  await budgetField(page).fill('500');

  // 900 income - 410 rent - 60 set aside for the fee (still spread from October) = 430. Every envelope is asked, and
  // the income line is shown with the budget line, in one live region, but being over it never stops Save.
  for (const name of ['Health & pharmacy', 'Personal care', 'Study materials', 'Household', 'Travel', 'Gifts']) {
    await expect(box(page, name)).toBeVisible();
  }
  await expect(page.getByText('Available €430 · Planned €434 · Over by €4', { exact: true })).toBeVisible();
  await expect(page.getByText('€434 of your €500 budget', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]', { hasText: 'Available €430' })).toContainText(
    '€434 of your €500 budget',
  );
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled();
  await page.getByLabel('Eating out', { exact: true }).fill('120');
  await expect(page.getByText('Available €430 · Planned €430', { exact: true })).toBeVisible();
  await expect(page.getByText('€430 of your €500 budget', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expectOnHome(page);

  const plans = await readStore<Plan>(page, 'plan');
  expect(plans).toHaveLength(1);
  expect(plans[0].createdOn).toBe('2026-10-16');
  expect(plans[0].fixed).toContainEqual({ categoryId: 'rent', monthlyMinor: 41000 });
  expect(plans[0].oneOffs).toMatchObject([{ name: 'Semester fee', createdMonth: '2026-10' }]);
  expect(plans[0].envelopes.find((e) => e.categoryId === 'eating-out')?.monthlyMinor).toBe(12000);
  expect(plans[0].spendingBudgetMinor).toBe(50000);
  // Neither accounts nor guesses were touched.
  expect(await readStore<Account>(page, 'accounts')).toHaveLength(3);
  const guesses = await readStore<Guess>(page, 'guesses');
  expect(guesses).toHaveLength(6);
  expect(guesses.every((g) => g.guessedOn === '2026-10-16')).toBe(true);
});

test('in Edit plan the suggested amounts fill only the envelopes that are not set, whatever the plan already holds', async ({
  page,
}) => {
  const nothing = { food: '', 'eating-out': '', 'going-out': '', transport: '', shopping: '', other: '' };
  await completeSetup(page, { envelopes: nothing });
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Edit plan' }).click();
  for (const step of ['Income', 'Fixed costs', 'One-off costs', 'Envelopes']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }

  // Edit plan asks about every envelope, and a budget with nothing set suggests the six the way a new setup does.
  await budgetField(page).fill('600');
  await expectSuggested(page, SUGGESTED_AT_600);

  // Travel (an envelope setup does not ask) takes €40 of the budget, and Shopping is set to €100.
  await box(page, 'Travel').fill('40');
  await box(page, 'Shopping').fill('100');
  await expectSuggested(page, {
    'Food & groceries': 220,
    'Eating out': 55,
    'Going out': 50,
    Transport: 20,
    Shopping: 45,
    Other: 115,
  });
  await expect(page.getByText('Students here: €180–335', { exact: true })).toBeVisible();
  await expect(box(page, 'Travel')).not.toHaveAccessibleDescription(/Suggested/);

  const use = page.getByRole('button', { name: 'Use the suggested amounts', exact: true });
  await expect(page.getByText("It fills only the envelopes you haven't set.", { exact: true })).toBeVisible();
  await use.click();
  const expected: Record<string, string> = {
    'Food & groceries': '220',
    'Eating out': '55',
    'Going out': '50',
    Transport: '20',
    // What was typed stays as it was.
    Shopping: '100',
    Other: '115',
    Travel: '40',
  };
  for (const [name, value] of Object.entries(expected)) await expect(box(page, name)).toHaveValue(value);
  await expect(use).toHaveCount(0);
  await expect(page.getByText('€600 of your €600 budget', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]', { hasText: /Available €/ })).toContainText(
    '€600 of your €600 budget',
  );

  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);
  const [plan] = await readStore<Plan>(page, 'plan');
  expect(plan.spendingBudgetMinor).toBe(60000);
  const amountOf = (id: string) => plan.envelopes.find((e) => e.categoryId === id)?.monthlyMinor;
  expect([amountOf('food'), amountOf('shopping'), amountOf('other'), amountOf('travel')]).toEqual([
    22000, 10000, 11500, 4000,
  ]);
});

test('a one-off whose due month has passed does not block editing the plan', async ({ page }) => {
  await completeSetup(page);

  // April 2027: the semester fee was due in March and is still in the plan, untouched.
  await page.clock.setFixedTime(new Date(2027, 3, 10, 12, 0, 0));
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Edit plan' }).click();
  for (const step of ['Income', 'Fixed costs', 'One-off costs']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }
  await expect(page.getByRole('group', { name: 'One-off cost 1' }).getByLabel('Due month')).toHaveValue('2027-03');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes' })).toBeVisible();
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);
});

test('the wizard fits a phone without sideways scrolling', async ({ page }) => {
  // 375 px, the narrowest phone the app is made for; the project's own device is wider.
  await page.setViewportSize({ width: 375, height: 812 });
  await mockFrankfurter(page);
  await page.goto('/setup');
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Accounts' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  for (const step of ['Income', 'Fixed costs', 'One-off costs']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Add a one-off cost' }).click();
  await expect(page.getByLabel('Due month')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  // A named cost with no amount says, under its amount, that it is not saved, and nothing stops the step.
  const oneOff = page.getByRole('group', { name: 'One-off cost 1' });
  await expect(oneOff.getByText("Without an amount, this cost isn't saved.")).toHaveCount(0);
  await oneOff.getByLabel('Name').fill('Laptop');
  await expect(oneOff.getByText("Without an amount, this cost isn't saved.", { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Guesses' })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes' })).toBeVisible();
  // The longest texts of the step: the budget question and its hint, and the food source, opened.
  await openBudgetSources(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await budgetField(page).fill('600');
  await page.getByRole('button', { name: 'Use the suggested amounts', exact: true }).click();
  await expect(budgetTotal(page, '€600')).toHaveText('€600 of your €600 budget');
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('rent and income can be added on their day, from any account', async ({ page }) => {
  await fillSetup(page, {}, { schedules: true });
  await page.setViewportSize({ width: 375, height: 812 });
  for (const step of ['Guesses', 'One-off costs', 'Fixed costs', 'Income']) {
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }

  // Parents pay into the Indian account: setup has no rate, so it asks for the rupee amount.
  const parents = page.getByRole('group', { name: 'Parents schedule', exact: true });
  await expect(parents.getByRole('checkbox', { name: 'Add it automatically', exact: true })).toBeChecked();
  await expect(parents.getByText("It's added on its day — don't log it by hand.", { exact: true })).toBeVisible();
  await parents.getByLabel('Account', { exact: true }).selectOption({ label: 'Home bank (INR)' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(inlineAlert(page)).toHaveText('Enter the amount in INR for Parents.');
  await parents.getByLabel('Amount in INR', { exact: true }).fill('50000');

  // The job pays weekly on Fridays; the plan keeps the €400 a month.
  const job = page.getByRole('group', { name: 'Job schedule', exact: true });
  await job.getByLabel('Repeats', { exact: true }).selectOption({ label: 'Weekly on' });
  await job.getByLabel('Day', { exact: true }).selectOption({ label: 'Friday' });
  await expect(job.getByText("That's €92.31 each week.", { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Rent's choice sits with the fixed costs, once the accounts are known.
  await expect(page.getByRole('heading', { level: 3, name: 'Fixed costs' })).toBeVisible();
  const rent = page.getByRole('group', { name: 'Rent schedule', exact: true });
  await expect(rent.getByLabel('Account', { exact: true }).locator('option:checked')).toHaveText('Local bank (EUR)');
  await rent.getByLabel('Day', { exact: true }).selectOption('31');
  await expect(rent.getByText("In a shorter month it's added on the last day.", { exact: true })).toBeVisible();
  // A cost without an amount asks nothing.
  await expect(page.getByRole('group', { name: 'Phone & internet schedule', exact: true })).toHaveCount(0);
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  for (const step of ['One-off costs', 'Guesses', 'Envelopes']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);

  const [plan] = await readStore<Plan>(page, 'plan');
  const accounts = await readStore<Account>(page, 'accounts');
  const idOf = (name: string) => accounts.find((a) => a.name === name)?.id;
  const from = { startOn: '2026-10-17', postedThrough: '2026-10-16' };
  expect(plan.fixed[0]).toMatchObject({
    categoryId: 'rent',
    monthlyMinor: 40000,
    schedule: { frequency: 'monthly', day: 31, accountId: idOf('Local bank'), amountMinor: 40000, ...from },
  });
  expect(plan.incomes).toMatchObject([
    {
      categoryId: 'income-job',
      monthlyMinor: 40000,
      schedule: { frequency: 'weekly', day: 5, accountId: idOf('Local bank'), amountMinor: 9231, ...from },
    },
    {
      categoryId: 'income-parents',
      monthlyMinor: 50000,
      schedule: { frequency: 'monthly', day: 1, accountId: idOf('Home bank'), amountMinor: 5_000_000, ...from },
    },
  ]);
});

test('editing the plan keeps each schedule and how far it has posted', async ({ page }) => {
  await completeSetup(page, {}, { schedules: true });
  // 1 November: rent and both incomes are added when the app opens.
  await page.clock.setFixedTime(new Date(2026, 10, 1, 12, 0, 0));
  await page.reload();
  // Posting waits for the rate refresh, which a slow network holds for up to its 10 s timeout.
  await expect.poll(async () => (await readStore<Entry>(page, 'entries')).length, { timeout: 15_000 }).toBe(3);
  const [before] = await readStore<Plan>(page, 'plan');
  expect(before.fixed[0].schedule?.postedThrough).toBe('2026-11-30');

  await page.goto('/settings');
  await page.getByRole('link', { name: 'Edit plan' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Adjust your plan' })).toBeVisible();
  await page.getByLabel('Rent per month').fill('390');
  for (const step of ['Income', 'Fixed costs']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }
  const rent = page.getByRole('group', { name: 'Rent schedule', exact: true });
  await expect(rent.getByRole('checkbox', { name: 'Add it automatically', exact: true })).toBeChecked();
  await expect(rent.getByLabel('Account', { exact: true }).locator('option:checked')).toHaveText('Local bank (EUR)');
  for (const step of ['One-off costs', 'Envelopes']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3, name: step })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expectOnHome(page);

  const [after] = await readStore<Plan>(page, 'plan');
  expect(after.fixed[0]).toEqual({
    categoryId: 'rent',
    monthlyMinor: 39000,
    schedule: { ...before.fixed[0].schedule, amountMinor: 39000 },
  });
  expect(after.incomes).toEqual(before.incomes);
});
