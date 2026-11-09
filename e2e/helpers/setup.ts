import { expect, type Page } from '@playwright/test';
import { openApp, waitForHome } from './app';
import { acceptPrivacyNotes } from './privacy';

export type FlexibleId = 'food' | 'eating-out' | 'going-out' | 'transport' | 'shopping' | 'other';

/**
 * What a test types into the setup wizard. Every amount is text, in euros except the opening balances; an empty
 * string leaves the field blank.
 */
export type SetupFixture = {
  rent: string;
  /**
   * Opening balances of the accounts, in order: Local bank (EUR), Home bank (INR), Cash (EUR). Setup starts with Local
   * bank and Cash; the helpers add Home bank between them (`HOME_BANK`).
   */
  openingBalances: [string, string, string];
  incomes: { parents: string; job: string };
  /**
   * A one-off cost, which a new setup no longer asks: `seedSetup` adds it as Edit plan would on the setup day, and the
   * wizard walk leaves it out. Without an amount (`NO_ONE_OFF`) there is none.
   */
  oneOff: { name: string; amount: string; dueMonth: string };
  /** The everyday budget, asked at the top of the envelopes step; blank skips the question. */
  budget: string;
  envelopes: Record<FlexibleId, string>;
};

export const DEFAULT_SETUP: SetupFixture = {
  rent: '400',
  openingBalances: ['1000', '50000', '50'],
  incomes: { parents: '500', job: '400' },
  oneOff: { name: 'Semester fee', amount: '300', dueMonth: '2027-03' },
  budget: '',
  envelopes: { food: '310', 'eating-out': '124', 'going-out': '0', transport: '0', shopping: '0', other: '0' },
};

/**
 * The fixture's home-country account. Setup starts with a bank and cash in euros (Roshan, 09-11-2026); the specs keep
 * an account in rupees between them, as a student from abroad adds it, for every currency, rate and total they check.
 */
export const HOME_BANK = { name: 'Home bank', kind: 'bank', currency: 'INR' } as const;

/** No one-off cost: what a setup walked through the wizard has. */
export const NO_ONE_OFF: SetupFixture['oneOff'] = { name: '', amount: '', dueMonth: '' };

/** The question of the everyday budget, at the top of the envelopes step. */
export const BUDGET_LABEL =
  'How much do you want to spend in a month on everyday things, apart from rent and your fixed costs?';

/** The everyday budget field. A role and an exact name: the label is long, and a text match would be ambiguous. */
export function budgetField(page: Page) {
  return page.getByRole('textbox', { name: BUDGET_LABEL, exact: true });
}

const ENVELOPE_LABEL: Record<FlexibleId, string> = {
  food: 'Food & groceries',
  'eating-out': 'Eating out',
  'going-out': 'Going out',
  transport: 'Transport',
  shopping: 'Shopping',
  other: 'Other',
};

export const FLEXIBLE_IDS = Object.keys(ENVELOPE_LABEL) as FlexibleId[];

/** Matches every request to the Frankfurter API; for tests that need the request to fail. */
export const FRANKFURTER = '**/api.frankfurter.dev/**';

/** Answers like Frankfurter v2 does (a list of rows), with INR at 95. The CORS header is what the real API sends. */
export async function mockFrankfurter(page: Page) {
  await page.route(FRANKFURTER, (route) =>
    route.fulfill({
      json: [{ date: '2026-10-16', base: 'EUR', quote: 'INR', rate: 95 }],
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
export async function ensureClock(page: Page) {
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
 * Puts the fixture's Home bank in rupees between the two accounts setup starts with: the second row (Cash) becomes
 * Home bank, and Cash comes back as a third, so the rows read Local bank, Home bank, Cash as the specs know them.
 */
async function addHomeBank(page: Page) {
  const second = page.getByRole('group', { name: 'Account 2' });
  await second.getByLabel('Name', { exact: true }).fill(HOME_BANK.name);
  await second.getByLabel('Type', { exact: true }).selectOption(HOME_BANK.kind);
  await second.getByLabel('Currency', { exact: true }).selectOption(HOME_BANK.currency);
  await page.getByRole('button', { name: 'Add account', exact: true }).click();
  const third = page.getByRole('group', { name: 'Account 3' });
  await third.getByLabel('Name', { exact: true }).fill('Cash');
  await third.getByLabel('Type', { exact: true }).selectOption('cash');
}

/**
 * Walks through every step of a new setup (Accounts, Income, Fixed costs with rent, Envelopes) and stops on the
 * envelopes step, before saving. `oneOff` is not asked: a new setup has none.
 * Mocks Frankfurter and accepts the exchange-rate note first, and pins the date to `SETUP_DAY` unless the caller set
 * `page.clock` before calling it.
 * Rent and the incomes are added by hand (no schedules) unless `options.schedules` is set.
 */
export async function fillSetup(page: Page, overrides: Partial<SetupFixture> = {}, options: SetupOptions = {}) {
  const f: SetupFixture = { ...DEFAULT_SETUP, ...overrides };
  await mockFrankfurter(page);
  // Only the note setup itself meets: the fixture's Home bank in INR would stop at the exchange-rate note
  // (privacy-notes.spec.ts tests it). The others stay unseen, so dictation.spec.ts still meets the mic's.
  await acceptPrivacyNotes(page, ['rates']);
  await ensureClock(page);

  await openApp(page, '/setup');
  // The wizard renders once it has read the database. 4 steps, or 3 when the accounts already exist and the Accounts
  // step is skipped.
  if (options.accountsExist) {
    await expect(page.getByRole('heading', { level: 3, name: 'Income' })).toBeVisible();
    await expect(page.getByText('Step 1 of 3', { exact: true })).toBeVisible();
    await expect(page.getByText('Your accounts are already set up, in Settings → Accounts and transfers.')).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { level: 3, name: 'Accounts' })).toBeVisible();
    await expect(page.getByText('Step 1 of 4', { exact: true })).toBeVisible();
    await addHomeBank(page);
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

  // Rent opens the step, with its "Add it automatically" under it.
  await page.getByRole('textbox', { name: 'Rent per month', exact: true }).fill(f.rent);
  if (!options.schedules && isPositive(f.rent)) await addByHand(page, 'Rent');
  // Every other fixed cost stays blank, which means 0.
  await nextStep(page, 'Envelopes');

  if (f.budget !== '') await budgetField(page).fill(f.budget);

  for (const id of FLEXIBLE_IDS) {
    await page.getByLabel(ENVELOPE_LABEL[id], { exact: true }).fill(f.envelopes[id]);
  }
}

/**
 * Sets up a plan from `DEFAULT_SETUP` (or the overrides) by walking the wizard, and waits until Home shows it. Specs
 * that only need a plan use `seedSetup` (seed-setup.ts), which writes the same rows without the walk.
 */
export async function completeSetup(page: Page, overrides: Partial<SetupFixture> = {}, options: SetupOptions = {}) {
  await fillSetup(page, overrides, options);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await waitForHome(page);
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0);
}
