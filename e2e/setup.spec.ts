import { expect, test, type Page } from '@playwright/test';
import type { Account, Guess, Plan } from '../src/db/types';
import { DEFAULT_SETUP, completeSetup, fillSetup, mockFrankfurter } from './helpers/setup';

// The fixture's numbers depend on the month (the 300 fee is spread from the current month to March).
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 12, 0, 0));
});

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

/** Reads every row of one IndexedDB store, straight from the browser. */
async function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction(name).objectStore(name).getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
        };
      }),
    store,
  ) as Promise<T[]>;
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('blocks saving while over budget', async ({ page }) => {
  await fillSetup(page, { envelopes: { ...DEFAULT_SETUP.envelopes, 'eating-out': '155' } });

  await expect(page.getByText('Available €440 · Planned €465 · Over by €25', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeDisabled();

  // The city range is information next to each envelope, and the hint appears only below it.
  // A range with a source reads plainly; one nobody published is labelled as an estimate.
  await expect(page.getByText('Students here: €180–335', { exact: true })).toBeVisible();
  await expect(page.getByText('Students here: €30–135 (estimate)', { exact: true })).toBeVisible();
  await expect(page.getByText('Below what students here typically need.')).toHaveCount(4);

  await page.getByLabel('Eating out', { exact: true }).fill('124');
  await expect(page.getByText('Available €440 · Planned €434', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save plan' })).toBeEnabled();
});

test('saves and lands on home', async ({ page }) => {
  await completeSetup(page);

  await page.reload();
  // Home only renders once the saved plan is found, so this also proves there was no redirect to /setup.
  await expect(page.getByRole('heading', { level: 2, name: 'Home' })).toBeVisible();
  await expect(page).toHaveURL('/');

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
  await expect(page.getByRole('heading', { level: 2, name: 'Home' })).toBeVisible();
  await expect(page).toHaveURL('/');
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
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await expect(page.getByLabel('Rent per month')).toHaveValue('400');
  await page.getByLabel('Rent per month').fill('410');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'Income' })).toBeVisible();
  await expect(page.getByLabel('Parents', { exact: true })).toHaveValue('500');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'Fixed costs' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(page.getByRole('heading', { level: 3, name: 'One-off costs' })).toBeVisible();
  const oneOff = page.getByRole('group', { name: 'One-off cost 1' });
  await expect(oneOff.getByLabel('Name')).toHaveValue('Semester fee');
  await expect(oneOff.getByLabel('Due month')).toHaveValue('2027-03');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // 900 income - 410 rent - 60 set aside for the fee (still spread from October) = 430.
  await expect(page.getByRole('heading', { level: 3, name: 'Envelopes' })).toBeVisible();
  await expect(page.getByText('Available €430 · Planned €434 · Over by €4', { exact: true })).toBeVisible();
  await page.getByLabel('Eating out', { exact: true }).fill('120');
  await expect(page.getByText('Available €430 · Planned €430', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save plan' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Home' })).toBeVisible();

  const plans = await readStore<Plan>(page, 'plan');
  expect(plans).toHaveLength(1);
  expect(plans[0].createdOn).toBe('2026-10-16');
  expect(plans[0].fixed).toContainEqual({ categoryId: 'rent', monthlyMinor: 41000 });
  expect(plans[0].oneOffs).toMatchObject([{ name: 'Semester fee', createdMonth: '2026-10' }]);
  expect(plans[0].envelopes.find((e) => e.categoryId === 'eating-out')?.monthlyMinor).toBe(12000);
  // Neither accounts nor guesses were touched.
  expect(await readStore<Account>(page, 'accounts')).toHaveLength(3);
  const guesses = await readStore<Guess>(page, 'guesses');
  expect(guesses).toHaveLength(6);
  expect(guesses.every((g) => g.guessedOn === '2026-10-16')).toBe(true);
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
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Home' })).toBeVisible();
});

test('the wizard fits a phone without sideways scrolling', async ({ page }) => {
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
});
