import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry, Plan, PlanLine, Rate } from '../src/db/types';
import { FRANKFURTER, completeSetup, readStore } from './helpers/setup';

/** Noon on a local calendar day; month is 1–12. */
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12, 0, 0);

/** The expenses or incomes of one category, oldest first, as [date, amount]. */
async function posted(page: Page, categoryId: string): Promise<[string, number][]> {
  return (await readStore<Entry>(page, 'entries'))
    .filter((e) => e.type !== 'transfer' && e.categoryId === categoryId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [e.date, e.amountMinor]);
}

async function line(page: Page, categoryId: string): Promise<PlanLine | undefined> {
  const [plan] = await readStore<Plan>(page, 'plan');
  return [...plan.incomes, ...plan.fixed].find((l) => l.categoryId === categoryId);
}

/** Posting waits for the rate refresh, which a slow network holds for up to its 10 s timeout. */
const POSTING = { timeout: 15_000 };

/** Moves the clock and reloads: the app adds what is due when it starts. */
async function openOn(page: Page, date: Date) {
  await page.clock.setFixedTime(date);
  await page.reload();
}

/** Changes one IndexedDB store straight from the browser: data other screens own is seeded or removed here. */
async function changeStore(page: Page, change: { store: string; clear?: true; delete?: string; put?: unknown }) {
  await page.evaluate(
    (c) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(c.store, 'readwrite');
          const store = tx.objectStore(c.store);
          if (c.clear) store.clear();
          if (c.delete !== undefined) store.delete(c.delete);
          if (c.put !== undefined) store.put(c.put);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    change,
  );
}

/** Deletes an entry, as deleting it in the entries list would. */
const deleteEntry = (page: Page, id: string) => changeStore(page, { store: 'entries', delete: id });
const clearStore = (page: Page, store: string) => changeStore(page, { store, clear: true });
const putRate = (page: Page, rate: Rate) => changeStore(page, { store: 'fxRates', put: rate });

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openSettings(page: Page) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Fixed costs and income', exact: true })).toBeVisible();
}

/** One of the editor's two lists. */
const list = (page: Page, name: 'Income' | 'Fixed costs') => page.getByRole('list', { name, exact: true });

// Each test sets up, then reloads on several days: well over the default 30 s on a busy machine.
test.beforeEach(() => test.setTimeout(90_000));

test('rent is added on its day, a changed day posts once, and a deleted one stays deleted', async ({ page }) => {
  await page.clock.setFixedTime(on(2026, 10, 16));
  await completeSetup(page, {}, { schedules: true });

  const local = (await readStore<Account>(page, 'accounts')).find((a) => a.name === 'Local bank');
  expect((await line(page, 'rent'))?.schedule).toMatchObject({
    frequency: 'monthly',
    day: 1,
    accountId: local?.id,
    amountMinor: 40000,
    startOn: '2026-10-17',
    postedThrough: '2026-10-16',
  });
  expect(await posted(page, 'rent')).toEqual([]);

  // 1 November: the rent is there, from Local bank.
  await openOn(page, on(2026, 11, 1));
  await expect.poll(() => posted(page, 'rent'), POSTING).toEqual([['2026-11-01', 40000]]);
  const [november] = (await readStore<Entry>(page, 'entries')).filter((e) => e.date === '2026-11-01' && e.type === 'expense');
  expect(november).toMatchObject({ accountId: local?.id, eurMinor: 40000, note: 'Rent', recurring: { scheduleId: expect.any(String) } });

  // In Settings the rent moves to the 3rd and goes up to €420.
  await openSettings(page);
  const fixed = list(page, 'Fixed costs');
  await expect(fixed.getByText('€400.00 · Monthly on day 1 · Local bank', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Rent', exact: true }).click();
  const form = page.getByRole('form', { name: 'Change Rent' });
  await expect(form.getByText("It's added on its day — don't log it by hand.", { exact: true })).toBeVisible();
  await form.getByLabel('Day', { exact: true }).selectOption('3');
  await form.getByLabel('Amount in EUR', { exact: true }).fill('420');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('€420.00 · Monthly on day 3 · Local bank', { exact: true })).toBeVisible();
  expect(await line(page, 'rent')).toMatchObject({
    monthlyMinor: 42000,
    schedule: { day: 3, amountMinor: 42000, postedThrough: '2026-11-30' },
  });

  // 3 December: the new amount, once; November is not posted again on its new day.
  await openOn(page, on(2026, 12, 3));
  await expect.poll(() => posted(page, 'rent'), POSTING).toEqual([
    ['2026-11-01', 40000],
    ['2026-12-03', 42000],
  ]);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();

  // Deleted, it does not come back: not on a reload, and not when January's rent is added.
  const december = (await readStore<Entry>(page, 'entries')).find((e) => e.date === '2026-12-03');
  await deleteEntry(page, december?.id ?? '');
  await page.reload();
  await openOn(page, on(2027, 1, 3));
  await expect.poll(() => posted(page, 'rent'), POSTING).toEqual([
    ['2026-11-01', 40000],
    ['2027-01-03', 42000],
  ]);
});

test('in Settings a line can be added automatically, paused, resumed, added and deleted', async ({ page }) => {
  await page.clock.setFixedTime(on(2026, 10, 16));
  await completeSetup(page);
  await openSettings(page);
  await expect(page.getByText('€400.00 a month · Not added automatically', { exact: true })).toHaveCount(2);

  // Rent and the job income from now on, from Local bank on the 1st.
  for (const name of ['Rent', 'Job']) {
    await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    const form = page.getByRole('form', { name: `Change ${name}` });
    await form.getByRole('checkbox', { name: 'Add it automatically', exact: true }).check();
    await form.getByLabel('Account', { exact: true }).selectOption({ label: 'Local bank (EUR)' });
    await expect(form.getByLabel('Amount in EUR', { exact: true })).toHaveValue('400');
    await form.getByRole('button', { name: 'Save', exact: true }).click();
  }
  await expect(page.getByText('€400.00 · Monthly on day 1 · Local bank', { exact: true })).toHaveCount(2);

  // Paused before the 1st: the job income still comes, the rent does not.
  await page.getByRole('button', { name: 'Pause Rent', exact: true }).click();
  await expect(page.getByText('€400.00 · Monthly on day 1 · Local bank · Paused', { exact: true })).toBeVisible();
  await openOn(page, on(2026, 11, 2));
  await expect.poll(() => posted(page, 'income-job'), POSTING).toEqual([['2026-11-01', 40000]]);
  expect(await posted(page, 'rent')).toEqual([]);

  // Resumed on 2 November: November stays skipped, December comes.
  await page.getByRole('button', { name: 'Resume Rent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause Rent', exact: true })).toBeVisible();
  await openOn(page, on(2026, 12, 1));
  await expect.poll(() => posted(page, 'income-job'), POSTING).toEqual([
    ['2026-11-01', 40000],
    ['2026-12-01', 40000],
  ]);
  expect(await posted(page, 'rent')).toEqual([['2026-12-01', 40000]]);

  // A new fixed cost that takes the plan over: said calmly, then deleted again.
  await page.getByRole('button', { name: 'Add a fixed cost or income', exact: true }).click();
  const form = page.getByRole('form', { name: 'New fixed cost or income' });
  await form.getByLabel('Fixed cost or income', { exact: true }).selectOption({ label: 'Gym & sports' });
  await form.getByRole('checkbox', { name: 'Add it automatically', exact: true }).uncheck();
  await form.getByLabel('Per month in your plan, in €', { exact: true }).fill('200');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  // 900 income - 600 fixed - 60 set aside = 240 available; the envelopes plan 434.
  await expect(page.getByText('Your plan is €194 over your income', { exact: true })).toBeVisible();
  await expect(page.getByText('€200.00 a month · Not added automatically', { exact: true })).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Delete Gym & sports', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Gym & sports', exact: true })).toHaveCount(0);
  await expect(page.getByText('Your plan is', { exact: false })).toHaveCount(0);
  expect(await line(page, 'gym')).toBeUndefined();
});

test('a line on a foreign account waits for a rate, then catches up', async ({ page }) => {
  await page.clock.setFixedTime(on(2026, 10, 16));
  await completeSetup(page);
  // From here Frankfurter is down and the rate setup fetched is gone: INR has no rate.
  await page.unrouteAll();
  await page.route(FRANKFURTER, (route) => route.abort());
  await clearStore(page, 'fxRates');
  await openSettings(page);

  await page.getByRole('button', { name: 'Edit Parents', exact: true }).click();
  const form = page.getByRole('form', { name: 'Change Parents' });
  await form.getByRole('checkbox', { name: 'Add it automatically', exact: true }).check();
  await form.getByLabel('Account', { exact: true }).selectOption({ label: 'Home bank (INR)' });
  await form.getByLabel('Amount in INR', { exact: true }).fill('50000');
  await expect(form.getByLabel('Per month in your plan, in €', { exact: true })).toHaveValue('500');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('₹50,000.00 · Monthly on day 1 · Home bank', { exact: true })).toBeVisible();

  // An account a line is added to cannot be deleted, though it has no entries yet.
  await page.getByRole('button', { name: 'Delete Home bank', exact: true }).click();
  await expect(
    page.getByText(
      'This account pays or receives a fixed cost or income. Change that first in Fixed costs and income.',
      { exact: true },
    ),
  ).toBeVisible();
  expect((await readStore<Account>(page, 'accounts')).map((a) => a.name)).toContain('Home bank');

  // 1 November without a rate: the euro rent from Local bank comes, the INR income waits with its watermark.
  await page.getByRole('button', { name: 'Edit Rent', exact: true }).click();
  const rent = page.getByRole('form', { name: 'Change Rent' });
  await rent.getByRole('checkbox', { name: 'Add it automatically', exact: true }).check();
  await rent.getByLabel('Account', { exact: true }).selectOption({ label: 'Local bank (EUR)' });
  await rent.getByRole('button', { name: 'Save', exact: true }).click();
  await openOn(page, on(2026, 11, 1));
  await expect.poll(() => posted(page, 'rent'), POSTING).toEqual([['2026-11-01', 40000]]);
  expect(await posted(page, 'income-parents')).toEqual([]);
  expect((await line(page, 'income-parents'))?.schedule?.postedThrough).toBe('2026-10-16');

  // Once a rate is set, the next start adds it, converted with that rate.
  await putRate(page, { currency: 'INR', perEur: 100, rateDate: '2026-11-01', fetchedOn: '2026-11-01', source: 'manual' });
  await page.reload();
  await expect.poll(() => posted(page, 'income-parents'), POSTING).toEqual([['2026-11-01', 5_000_000]]);
  const [parents] = (await readStore<Entry>(page, 'entries')).filter((e) => e.type === 'income');
  expect(parents.eurMinor).toBe(50000);
  expect((await line(page, 'income-parents'))?.schedule?.postedThrough).toBe('2026-11-30');
});
