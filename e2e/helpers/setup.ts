import { expect, type Page } from '@playwright/test';

export type FlexibleId = 'food' | 'eating-out' | 'going-out' | 'transport' | 'shopping' | 'other';

/**
 * What a test types into the setup wizard. Every amount is text, in euros except the opening balances; an empty
 * string leaves the field blank.
 */
export type SetupFixture = {
  rent: string;
  /** Opening balances of the prefilled accounts, in order: Local bank (EUR), Home bank (INR), Cash (EUR). */
  openingBalances: [string, string, string];
  incomes: { parents: string; job: string };
  oneOff: { name: string; amount: string; dueMonth: string };
  guesses: Record<FlexibleId, string>;
  /** The everyday budget, asked at the top of the envelopes step; blank skips the question. */
  budget: string;
  envelopes: Record<FlexibleId, string>;
};

export const DEFAULT_SETUP: SetupFixture = {
  rent: '400',
  openingBalances: ['1000', '50000', '50'],
  incomes: { parents: '500', job: '400' },
  oneOff: { name: 'Semester fee', amount: '300', dueMonth: '2027-03' },
  guesses: { food: '200', 'eating-out': '80', 'going-out': '60', transport: '20', shopping: '40', other: '20' },
  budget: '',
  envelopes: { food: '310', 'eating-out': '124', 'going-out': '0', transport: '0', shopping: '0', other: '0' },
};

/** The question of the everyday budget, at the top of the envelopes step. */
export const BUDGET_LABEL =
  'How much do you want to spend in a month on everyday things, apart from rent and your fixed costs?';

/** The everyday budget field. A role and an exact name: the label is long, and a text match would be ambiguous. */
export function budgetField(page: Page) {
  return page.getByRole('textbox', { name: BUDGET_LABEL, exact: true });
}

const GUESS_TOPIC: Record<FlexibleId, string> = {
  food: 'food & groceries',
  'eating-out': 'eating out',
  'going-out': 'going out',
  transport: 'transport',
  shopping: 'shopping',
  other: 'other things',
};

const ENVELOPE_LABEL: Record<FlexibleId, string> = {
  food: 'Food & groceries',
  'eating-out': 'Eating out',
  'going-out': 'Going out',
  transport: 'Transport',
  shopping: 'Shopping',
  other: 'Other',
};

const FLEXIBLE_IDS = Object.keys(GUESS_TOPIC) as FlexibleId[];

/** Matches every request to the Frankfurter API; for tests that need the request to fail. */
export const FRANKFURTER = '**/api.frankfurter.dev/**';

/** Answers like Frankfurter does, with INR at 95. The CORS header is what the real API sends. */
export async function mockFrankfurter(page: Page) {
  await page.route(FRANKFURTER, (route) =>
    route.fulfill({
      json: { amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95 } },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
}

/** Reads every row of one IndexedDB store, straight from the browser. */
export async function readStore<T>(page: Page, store: string): Promise<T[]> {
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

/** The day the fixture's numbers assume: the 300 fee is spread from October to March, and plans are created on it. */
export const SETUP_DAY = new Date('2026-10-16T12:00:00');

/**
 * Pins the browser's date to `SETUP_DAY`, unless the caller has already set a clock. Playwright cannot say
 * whether a clock is installed, but an installed one puts the page's date away from the real time, so a page
 * that still tells the real time has none. (A clock set to within a minute of now would be replaced by
 * `SETUP_DAY`; nothing does that.)
 */
async function ensureClock(page: Page) {
  const pageNow = await page.evaluate(() => Date.now());
  if (Math.abs(pageNow - Date.now()) < 60_000) await page.clock.setFixedTime(SETUP_DAY);
}

async function nextStep(page: Page, heading: string) {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: heading })).toBeVisible();
}

/** How the wizard starts out. */
export type SetupOptions = {
  /** Accounts were added in Settings first, so the wizard skips its Accounts step and `openingBalances` is unused. */
  accountsExist?: boolean;
  /**
   * Leaves "Add it automatically" on for rent and the incomes (monthly on the 1st, from the first account). Off by
   * default, so a spec that moves its clock past the 1st finds no entries it did not make.
   */
  schedules?: boolean;
};

const isPositive = (amount: string): boolean => Number(amount.trim().replace(',', '.')) > 0;

/** Turns "Add it automatically" off for a line the wizard shows with an amount. */
async function addByHand(page: Page, name: string) {
  await page
    .getByRole('group', { name: `${name} schedule`, exact: true })
    .getByRole('checkbox', { name: 'Add it automatically', exact: true })
    .uncheck();
}

/**
 * Walks through every step of a new setup and stops on the envelopes step, before saving.
 * Mocks Frankfurter first, and pins the date to `SETUP_DAY` unless the caller set `page.clock` before calling it.
 * Rent and the incomes are added by hand (no schedules) unless `options.schedules` is set.
 */
export async function fillSetup(page: Page, overrides: Partial<SetupFixture> = {}, options: SetupOptions = {}) {
  const f: SetupFixture = { ...DEFAULT_SETUP, ...overrides };
  await mockFrankfurter(page);
  await ensureClock(page);

  await page.goto('/setup');
  // The wizard renders once it has read the database, so the first heading proves the page is live.
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
  // 7 steps, or 6 when the accounts already exist and the Accounts step is skipped.
  await expect(page.getByText(`Step 1 of ${options.accountsExist ? 6 : 7}`, { exact: true })).toBeVisible();
  await page.getByLabel('Rent per month').fill(f.rent);

  if (options.accountsExist) {
    await nextStep(page, 'Income');
    await expect(page.getByText('Your accounts are already set up in Settings.')).toBeVisible();
  } else {
    await nextStep(page, 'Accounts');
    for (const [i, opening] of f.openingBalances.entries()) {
      await page.getByRole('group', { name: `Account ${i + 1}` }).getByLabel('Opening balance').fill(opening);
    }
    await nextStep(page, 'Income');
  }

  await page.getByLabel('Parents', { exact: true }).fill(f.incomes.parents);
  await page.getByLabel('Job', { exact: true }).fill(f.incomes.job);
  if (!options.schedules) {
    if (isPositive(f.incomes.parents)) await addByHand(page, 'Parents');
    if (isPositive(f.incomes.job)) await addByHand(page, 'Job');
  }
  await nextStep(page, 'Fixed costs');

  // Rent's "Add it automatically" sits here, once the accounts are known.
  if (!options.schedules && isPositive(f.rent)) await addByHand(page, 'Rent');
  // Every other fixed cost stays blank, which means 0.
  await nextStep(page, 'One-off costs');

  await page.getByRole('button', { name: 'Add a one-off cost' }).click();
  const oneOff = page.getByRole('group', { name: 'One-off cost 1' });
  await oneOff.getByLabel('Name').fill(f.oneOff.name);
  await oneOff.getByLabel('Amount').fill(f.oneOff.amount);
  // A blank month is the field's own state: there is nothing to clear.
  if (f.oneOff.dueMonth !== '') await oneOff.getByLabel('Due month').fill(f.oneOff.dueMonth);
  await nextStep(page, 'Guesses');

  for (const id of FLEXIBLE_IDS) {
    await page.getByLabel(`What do you think you spend on ${GUESS_TOPIC[id]} a month?`).fill(f.guesses[id]);
  }
  await nextStep(page, 'Envelopes');

  if (f.budget !== '') await budgetField(page).fill(f.budget);

  for (const id of FLEXIBLE_IDS) {
    await page.getByLabel(ENVELOPE_LABEL[id], { exact: true }).fill(f.envelopes[id]);
  }
}

/** Sets up a plan from `DEFAULT_SETUP` (or the overrides) and waits until the wizard has handed over to home. */
export async function completeSetup(page: Page, overrides: Partial<SetupFixture> = {}, options: SetupOptions = {}) {
  await fillSetup(page, overrides, options);
  await page.getByRole('button', { name: 'Save plan' }).click();
  // Not tied to what home shows: the URL moved on and the wizard is gone.
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0);
}
