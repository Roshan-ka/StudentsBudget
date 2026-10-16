import { expect, type Page } from '@playwright/test';

export type FlexibleId = 'food' | 'eating-out' | 'going-out' | 'transport' | 'shopping' | 'other';

/** What a test types into the setup wizard. Every amount is text, in euros except the opening balances. */
export type SetupFixture = {
  rent: string;
  /** Opening balances of the prefilled accounts, in order: Local bank (EUR), Home bank (INR), Cash (EUR). */
  openingBalances: [string, string, string];
  incomes: { parents: string; job: string };
  oneOff: { name: string; amount: string; dueMonth: string };
  guesses: Record<FlexibleId, string>;
  envelopes: Record<FlexibleId, string>;
};

export const DEFAULT_SETUP: SetupFixture = {
  rent: '400',
  openingBalances: ['1000', '50000', '50'],
  incomes: { parents: '500', job: '400' },
  oneOff: { name: 'Semester fee', amount: '300', dueMonth: '2027-03' },
  guesses: { food: '200', 'eating-out': '80', 'going-out': '60', transport: '20', shopping: '40', other: '20' },
  envelopes: { food: '310', 'eating-out': '124', 'going-out': '0', transport: '0', shopping: '0', other: '0' },
};

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

/** Answers like Frankfurter does, with INR at 95. The CORS header is what the real API sends. */
export async function mockFrankfurter(page: Page) {
  await page.route('**/api.frankfurter.dev/**', (route) =>
    route.fulfill({
      json: { amount: 1, base: 'EUR', date: '2026-10-16', rates: { INR: 95 } },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
}

async function nextStep(page: Page, heading: string) {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: heading })).toBeVisible();
}

/**
 * Walks through every step of a new setup and stops on the envelopes step, before saving.
 * Mocks Frankfurter first. Callers may set `page.clock` before calling it.
 */
export async function fillSetup(page: Page, overrides: Partial<SetupFixture> = {}) {
  const f: SetupFixture = { ...DEFAULT_SETUP, ...overrides };
  await mockFrankfurter(page);

  await page.goto('/setup');
  // The wizard renders once it has read the database, so the first heading proves the page is live.
  await expect(page.getByRole('heading', { level: 3, name: 'City and rent' })).toBeVisible();
  await page.getByLabel('Rent per month').fill(f.rent);
  await nextStep(page, 'Accounts');

  for (const [i, opening] of f.openingBalances.entries()) {
    await page.getByRole('group', { name: `Account ${i + 1}` }).getByLabel('Opening balance').fill(opening);
  }
  await nextStep(page, 'Income');

  await page.getByLabel('Parents', { exact: true }).fill(f.incomes.parents);
  await page.getByLabel('Job', { exact: true }).fill(f.incomes.job);
  await nextStep(page, 'Fixed costs');

  // Every other fixed cost stays blank, which means 0.
  await nextStep(page, 'One-off costs');

  await page.getByRole('button', { name: 'Add a one-off cost' }).click();
  const oneOff = page.getByRole('group', { name: 'One-off cost 1' });
  await oneOff.getByLabel('Name').fill(f.oneOff.name);
  await oneOff.getByLabel('Amount').fill(f.oneOff.amount);
  await oneOff.getByLabel('Due month').fill(f.oneOff.dueMonth);
  await nextStep(page, 'Guesses');

  for (const id of FLEXIBLE_IDS) {
    await page.getByLabel(`What do you think you spend on ${GUESS_TOPIC[id]} a month?`).fill(f.guesses[id]);
  }
  await nextStep(page, 'Envelopes');

  for (const id of FLEXIBLE_IDS) {
    await page.getByLabel(ENVELOPE_LABEL[id], { exact: true }).fill(f.envelopes[id]);
  }
}

/** Sets up a plan from `DEFAULT_SETUP` (or the overrides) and waits until home is showing. */
export async function completeSetup(page: Page, overrides: Partial<SetupFixture> = {}) {
  await fillSetup(page, overrides);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Home' })).toBeVisible();
}
