import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry, Rate } from '../src/db/types';
import { FRANKFURTER, completeSetup, readStore } from './helpers/setup';

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function entriesList(page: Page) {
  return page.getByRole('region', { name: 'Entries' });
}

/**
 * Opens /entries and waits until the list has read the database. It loads the page rather than tapping
 * the nav link: the dev server's "Cache disabled" badge sits over the middle of the bar on a phone.
 */
async function openEntries(page: Page) {
  await page.goto('/entries');
  // The month line only renders once the page has hydrated and the live query has answered, so typing
  // after it cannot hit the server-rendered field before React is listening.
  await expect(page.getByText('Oct 2026')).toBeVisible();
}

async function quickAdd(page: Page, text: string) {
  await page.getByLabel('Quick add').fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

/** Changes one IndexedDB store straight in the browser: clears it, deletes by key, then puts the rows. */
async function writeStore(page: Page, store: string, change: { clear?: boolean; remove?: string[]; put?: unknown[] }) {
  await page.evaluate(
    ({ name, clear, remove, put }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(name, 'readwrite');
          const objectStore = transaction.objectStore(name);
          if (clear) objectStore.clear();
          for (const key of remove ?? []) objectStore.delete(key);
          for (const row of put ?? []) objectStore.put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    { name: store, ...change },
  );
}

async function setupAndOpenEntries(page: Page) {
  await completeSetup(page);
  await openEntries(page);
}

test('quick add asks for the category once, then saves by itself, and Undo removes the entry', async ({ page }) => {
  await setupAndOpenEntries(page);
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Entries' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const status = page.getByRole('status');
  const list = entriesList(page);

  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(status).toHaveText('Saved €6.00 · döner · Eating out');
  await expect(list.getByText('döner')).toBeVisible();
  await expect(list.getByText('€6.00')).toBeVisible();
  await expect(page.getByLabel('Quick add')).toHaveValue('');

  // The category was learned from the first entry: no chips this time.
  await quickAdd(page, 'döner 4');
  await expect(status).toHaveText('Saved €4.00 · döner · Eating out');
  await expect(page.getByRole('group', { name: 'Category' })).toHaveCount(0);
  await expect(list.getByText('€4.00')).toBeVisible();
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(list.getByText('€4.00')).toHaveCount(0);
  await expect(list.getByText('€6.00')).toBeVisible();
  await expect(status).toHaveText('');
  const entries = await readStore<Entry>(page, 'entries');
  expect(entries.map((e) => [e.amountMinor, e.note])).toEqual([[600, 'döner']]);
});

test('quick add saves to the cash account, dated today, with the amount in euro cents', async ({ page }) => {
  await setupAndOpenEntries(page);

  await quickAdd(page, 'Rewe 12,50');
  await page.getByRole('button', { name: 'Food & groceries' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €12.50 · Rewe · Food & groceries');

  const accounts = await readStore<{ id: string; name: string }>(page, 'accounts');
  const cash = accounts.find((a) => a.name === 'Cash');
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({
    type: 'expense',
    accountId: cash?.id,
    amountMinor: 1250,
    eurMinor: 1250,
    categoryId: 'food',
    note: 'Rewe',
    date: '2026-10-16',
  });
});

test('quick add without an amount says so and saves nothing', async ({ page }) => {
  await setupAndOpenEntries(page);

  await quickAdd(page, 'döner');

  await expect(inlineAlert(page)).toHaveText('Add an amount, like “döner 6”');
  await expect(page.getByRole('group', { name: 'Category' })).toHaveCount(0);
  await expect(page.getByLabel('Quick add')).toHaveValue('döner');
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
});

test('the typed line stays while the chips wait, and changing it takes the chips away', async ({ page }) => {
  await setupAndOpenEntries(page);

  await quickAdd(page, 'bus 3');
  await expect(page.getByRole('group', { name: 'Category' })).toBeVisible();
  await expect(page.getByLabel('Quick add')).toHaveValue('bus 3');
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);

  await page.getByLabel('Quick add').fill('bus 4');
  await expect(page.getByRole('group', { name: 'Category' })).toHaveCount(0);
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
});

test('quick add refuses an account whose currency has no rate yet', async ({ page }) => {
  await completeSetup(page);
  // Setup refreshes the INR rate in the background. Wait for it, take it away again, and let the next
  // refresh (every page load starts one) answer without an INR rate, so the rate stays gone.
  await expect.poll(async () => (await readStore<Rate>(page, 'fxRates')).length).toBe(1);
  await page.route(FRANKFURTER, (route) =>
    route.fulfill({
      json: { amount: 1, base: 'EUR', date: '2026-10-16', rates: {} },
      headers: { 'access-control-allow-origin': '*' },
    }),
  );
  await writeStore(page, 'fxRates', { clear: true });
  // Quick add saves to the first cash account: make the INR account the only cash account.
  const accounts = await readStore<Account>(page, 'accounts');
  const cash = accounts.find((a) => a.name === 'Cash');
  const homeBank = accounts.find((a) => a.name === 'Home bank');
  expect(cash && homeBank).toBeTruthy();
  await writeStore(page, 'accounts', { remove: [cash!.id], put: [{ ...homeBank, kind: 'cash' }] });
  await openEntries(page);

  await quickAdd(page, 'chai 40');
  await page.getByRole('button', { name: 'Food & groceries' }).click();

  await expect(inlineAlert(page)).toHaveText('No exchange rate for INR yet. Set one in Settings.');
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
});

test('tapping an entry edits it in place: same entry, new amount', async ({ page }) => {
  await setupAndOpenEntries(page);
  const list = entriesList(page);
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(list.getByText('€6.00')).toBeVisible();
  const [before] = await readStore<Entry>(page, 'entries');

  await list.getByRole('button', { name: /döner/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await expect(panel.getByLabel('Amount')).toHaveValue('6');
  await panel.getByLabel('Amount').fill('7,50');
  await panel.getByRole('button', { name: 'Save changes' }).click();

  await expect(list.getByText('€7.50')).toBeVisible();
  await expect(list.getByText('€6.00')).toHaveCount(0);
  await expect(panel).toHaveCount(0);
  const after = await readStore<Entry>(page, 'entries');
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ id: before.id, createdAt: before.createdAt, amountMinor: 750, eurMinor: 750 });
});

test('delete asks first: Cancel keeps the entry, Yes removes it', async ({ page }) => {
  // The question is on the page, not a browser dialog.
  let dialogs = 0;
  page.on('dialog', (dialog) => {
    dialogs += 1;
    void dialog.dismiss();
  });
  await setupAndOpenEntries(page);
  const list = entriesList(page);
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(list.getByText('€6.00')).toBeVisible();

  await list.getByRole('button', { name: /döner/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(panel.getByText('Delete this entry?')).toBeVisible();
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel.getByText('Delete this entry?')).toHaveCount(0);
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(1);

  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  await panel.getByRole('button', { name: 'Yes' }).click();

  await expect(list.getByText('€6.00')).toHaveCount(0);
  await expect(list.getByText('Nothing logged here yet.')).toBeVisible();
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
  expect(dialogs).toBe(0);
});

test('the entry form saves an expense in a foreign currency, converted at save time', async ({ page }) => {
  await setupAndOpenEntries(page);
  // Setup refreshes the INR rate in the background; the form needs it, so wait until it is stored.
  await expect.poll(async () => (await readStore<Rate>(page, 'fxRates')).map((r) => r.currency)).toEqual(['INR']);

  await page.getByRole('link', { name: 'Add entry' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'New entry' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Expense' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Date', { exact: true })).toHaveValue('2026-10-16');

  await page.getByLabel('Amount', { exact: true }).fill('950');
  await page.getByLabel('Account', { exact: true }).selectOption({ label: 'Home bank (INR)' });
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Transport' });
  await page.getByLabel('Note', { exact: true }).fill('Bus pass');
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page).toHaveURL('/entries?month=2026-10');
  const list = entriesList(page);
  await expect(list.getByText('Bus pass')).toBeVisible();
  await expect(list.getByText('₹950.00')).toBeVisible();
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({ type: 'expense', categoryId: 'transport', amountMinor: 95000, eurMinor: 1000 });
});

test('the entry form without an amount says so', async ({ page }) => {
  await setupAndOpenEntries(page);
  await page.getByRole('link', { name: 'Add entry' }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(inlineAlert(page)).toHaveText('Enter an amount.');
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
});

test('the entry form takes income, and a transfer through the transfer form', async ({ page }) => {
  await setupAndOpenEntries(page);
  await page.getByRole('link', { name: 'Add entry' }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();

  // Expense offers every category except income; Income offers only income categories.
  const rent = page.getByLabel('Category', { exact: true }).getByRole('option', { name: 'Rent', exact: true });
  await expect(rent).toHaveCount(1);
  await page.getByRole('tab', { name: 'Income' }).click();
  await expect(rent).toHaveCount(0);
  await page.getByLabel('Amount', { exact: true }).fill('400');
  await page.getByLabel('Account', { exact: true }).selectOption({ label: 'Local bank (EUR)' });
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Job' });
  await page.getByRole('button', { name: 'Save income' }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  await expect(entriesList(page).getByText('+€400.00')).toBeVisible();

  // Transfer: the same form as in Settings.
  await page.getByRole('link', { name: 'Add entry' }).click();
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await page.getByLabel('From', { exact: true }).selectOption({ label: 'Local bank (EUR)' });
  await page.getByLabel('To', { exact: true }).selectOption({ label: 'Cash (EUR)' });
  await page.getByLabel('Amount', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Move money', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  const list = entriesList(page);
  await expect(list.getByText('Local bank → Cash')).toBeVisible();
  await expect(list.getByText('€20.00')).toBeVisible();

  const entries = await readStore<Entry>(page, 'entries');
  expect(entries.map((e) => [e.type, e.amountMinor]).sort()).toEqual([
    ['income', 40000],
    ['transfer', 2000],
  ]);
});

/** Fills the Transfer tab of /entries/new and saves. Leave `received` out between accounts in one currency. */
async function addTransfer(page: Page, transfer: { from: string; to: string; amount: string; received?: string }) {
  await page.getByRole('link', { name: 'Add entry' }).click();
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await page.getByLabel('From', { exact: true }).selectOption({ label: transfer.from });
  await page.getByLabel('To', { exact: true }).selectOption({ label: transfer.to });
  await page.getByLabel('Amount', { exact: true }).fill(transfer.amount);
  if (transfer.received !== undefined) await page.getByLabel('Amount received').fill(transfer.received);
  await page.getByRole('button', { name: 'Move money', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
}

test('editing a transfer opens the transfer form and keeps the entry', async ({ page }) => {
  await setupAndOpenEntries(page);
  await addTransfer(page, { from: 'Local bank (EUR)', to: 'Cash (EUR)', amount: '20' });
  const list = entriesList(page);
  await expect(list.getByText('€20.00')).toBeVisible();
  const [before] = await readStore<Entry>(page, 'entries');

  await list.getByRole('button', { name: /Transfer/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await expect(panel.getByLabel('Amount', { exact: true })).toHaveValue('20');
  await expect(panel.getByLabel('From', { exact: true }).locator('option:checked')).toHaveText('Local bank (EUR)');
  // Only the amount sent changes: between accounts in one currency the amount received follows it.
  await panel.getByLabel('Amount', { exact: true }).fill('25');
  await expect(panel.getByLabel('Amount received')).toHaveValue('25');
  await panel.getByRole('button', { name: 'Save changes' }).click();

  await expect(list.getByText('€25.00').first()).toBeVisible();
  const after = await readStore<Entry>(page, 'entries');
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ id: before.id, createdAt: before.createdAt, amountMinor: 2500, toAmountMinor: 2500 });
});

test('editing a transfer between currencies keeps the amount received', async ({ page }) => {
  await setupAndOpenEntries(page);
  await addTransfer(page, { from: 'Local bank (EUR)', to: 'Home bank (INR)', amount: '50', received: '4750' });
  const list = entriesList(page);
  await expect(list.getByText('€50.00')).toBeVisible();

  await list.getByRole('button', { name: /Transfer/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await expect(panel.getByLabel('Amount received')).toHaveValue('4750');
  await panel.getByLabel('Note').fill('Rent top-up');
  await panel.getByLabel('Amount', { exact: true }).fill('60');
  await expect(panel.getByLabel('Amount received')).toHaveValue('4750');
  await panel.getByRole('button', { name: 'Save changes' }).click();

  await expect(list.getByText('Rent top-up')).toBeVisible();
  const [after] = await readStore<Entry>(page, 'entries');
  expect(after).toMatchObject({ amountMinor: 6000, eurMinor: 6000, toAmountMinor: 475000, note: 'Rent top-up' });
});

test('editing the note of a same-currency transfer with a fee keeps both amounts', async ({ page }) => {
  await setupAndOpenEntries(page);
  const accounts = await readStore<Account>(page, 'accounts');
  const idOf = (name: string) => accounts.find((a) => a.name === name)?.id;
  await writeStore(page, 'entries', {
    put: [
      {
        id: 'fee',
        type: 'transfer',
        date: '2026-10-16',
        accountId: idOf('Local bank'),
        amountMinor: 2000,
        eurMinor: 2000,
        toAccountId: idOf('Cash'),
        toAmountMinor: 1900,
        note: '',
        createdAt: '2026-10-16T10:00:00.000Z',
      },
    ],
  });
  await openEntries(page);

  await entriesList(page).getByRole('button', { name: /Transfer/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await expect(panel.getByLabel('Amount received')).toHaveValue('19');
  await panel.getByLabel('Note').fill('ATM fee');
  await panel.getByRole('button', { name: 'Save changes' }).click();

  await expect(entriesList(page).getByText('ATM fee')).toBeVisible();
  const [after] = await readStore<Entry>(page, 'entries');
  expect(after).toMatchObject({ id: 'fee', amountMinor: 2000, toAmountMinor: 1900, note: 'ATM fee' });
});

test('editing an INR entry keeps its EUR value, though the rate has moved since', async ({ page }) => {
  await setupAndOpenEntries(page);
  // The stored rate is 95 by now; this entry was entered at 90: 95000 INR was worth 1055.56, stored as 1056 cents.
  await expect.poll(async () => (await readStore<Rate>(page, 'fxRates')).length).toBe(1);
  const homeBank = (await readStore<Account>(page, 'accounts')).find((a) => a.name === 'Home bank');
  await writeStore(page, 'entries', {
    put: [
      {
        id: 'old',
        type: 'expense',
        date: '2026-10-10',
        accountId: homeBank?.id,
        amountMinor: 95000,
        eurMinor: 1056,
        categoryId: 'food',
        note: 'Groceries',
        createdAt: '2026-10-10T10:00:00.000Z',
      },
    ],
  });
  await openEntries(page);

  await entriesList(page).getByRole('button', { name: /Groceries/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await panel.getByLabel('Category', { exact: true }).selectOption({ label: 'Shopping' });
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel).toHaveCount(0);

  const [after] = await readStore<Entry>(page, 'entries');
  expect(after).toMatchObject({ id: 'old', categoryId: 'shopping', amountMinor: 95000, eurMinor: 1056 });
});

test('the list groups by day, newest first, and filters by category and month', async ({ page }) => {
  await setupAndOpenEntries(page);
  // Seed three entries on three days, two of them in October.
  const accountId = (await readStore<{ id: string; name: string }>(page, 'accounts')).find((a) => a.name === 'Cash')?.id;
  expect(accountId).toBeDefined();
  const base = { type: 'expense', accountId, createdAt: '2026-10-16T10:00:00.000Z' };
  await writeStore(page, 'entries', {
    put: [
      { ...base, id: 'a', date: '2026-10-14', amountMinor: 300, eurMinor: 300, categoryId: 'food', note: 'Rewe' },
      { ...base, id: 'b', date: '2026-10-16', amountMinor: 650, eurMinor: 650, categoryId: 'eating-out', note: 'döner' },
      { ...base, id: 'c', date: '2026-08-31', amountMinor: 900, eurMinor: 900, categoryId: 'food', note: 'Aldi' },
    ],
  });

  await page.goto('/entries');
  const list = entriesList(page);
  await expect(page.getByText('Oct 2026')).toBeVisible();
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(['Friday, 16 October', 'Wednesday, 14 October']);
  await expect(list.getByText('Aldi')).toHaveCount(0);

  await page.goto('/entries?category=food&month=2026-10');
  await expect(page.getByText('Food & groceries · Oct 2026 · Clear')).toBeVisible();
  await expect(list.getByText('Rewe')).toBeVisible();
  await expect(list.getByText('döner')).toHaveCount(0);

  await page.getByRole('link', { name: 'Clear' }).click();
  await expect(page).toHaveURL('/entries');
  await expect(list.getByText('döner')).toBeVisible();

  await page.goto('/entries?month=2026-08');
  await expect(page.getByText('Aug 2026 · Clear')).toBeVisible();
  await expect(list.getByText('Aldi')).toBeVisible();
  await expect(list.getByText('Rewe')).toHaveCount(0);

  await page.goto('/entries?month=2026-11');
  await expect(page.getByText('Nov 2026 · Clear')).toBeVisible();
  await expect(list.getByText('Nothing logged here yet.')).toBeVisible();
});

test('the entries pages fit a phone without sideways scrolling', async ({ page }) => {
  await setupAndOpenEntries(page);
  await quickAdd(page, 'a long note about a very expensive kebab dinner with friends 12');
  await expect(page.getByRole('group', { name: 'Category' })).toBeVisible();
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(page.getByRole('status')).toContainText('Saved €12.00');
  await entriesList(page).getByRole('button', { name: /kebab/ }).click();
  await expect(page.getByRole('region', { name: 'Edit entry' })).toBeVisible();

  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.goto('/entries/new');
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test('a manual entry dated in another month opens that month, and the month links move on from it', async ({ page }) => {
  await setupAndOpenEntries(page);
  await page.getByRole('link', { name: 'Add entry' }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();
  await page.getByLabel('Amount', { exact: true }).fill('9,50');
  await page.getByLabel('Date', { exact: true }).fill('2026-09-30');
  await page.getByLabel('Note', { exact: true }).fill('Mensa');
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page).toHaveURL('/entries?month=2026-09');
  const list = entriesList(page);
  await expect(list.getByText('Mensa')).toBeVisible();
  await expect(list.getByText('€9.50')).toBeVisible();
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(['Wednesday, 30 September']);

  await page.getByRole('link', { name: 'Next ›' }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  await expect(page.getByText('Oct 2026')).toBeVisible();
  await expect(list.getByText('Mensa')).toHaveCount(0);

  await page.getByRole('link', { name: '‹ Previous' }).click();
  await expect(list.getByText('Mensa')).toBeVisible();
  await page.getByRole('link', { name: '‹ Previous' }).click();
  await expect(page).toHaveURL('/entries?month=2026-08');
  await expect(list.getByText('Mensa')).toHaveCount(0);
});

test('the month links keep the category and roll over the year', async ({ page }) => {
  await setupAndOpenEntries(page);

  await page.goto('/entries?category=food&month=2026-12');
  await expect(page.getByText('Food & groceries · Dec 2026 · Clear')).toBeVisible();
  await page.getByRole('link', { name: 'Next ›' }).click();
  await expect(page).toHaveURL(/month=2027-01/);
  await expect(page).toHaveURL(/category=food/);
  await expect(page.getByText('Food & groceries · Jan 2027 · Clear')).toBeVisible();

  // Wait for each page before the next tap, or both taps hit the link of the page that was showing.
  await page.getByRole('link', { name: '‹ Previous' }).click();
  await expect(page).toHaveURL(/month=2026-12/);
  await page.getByRole('link', { name: '‹ Previous' }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(page).toHaveURL(/category=food/);

  // Without a month in the address the links start from the current month, and Clear is not needed.
  await page.goto('/entries');
  await expect(page.getByText('Oct 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clear' })).toHaveCount(0);
  await page.getByRole('link', { name: '‹ Previous' }).click();
  await expect(page).toHaveURL('/entries?month=2026-09');
  await expect(page.getByRole('link', { name: 'Clear' })).toBeVisible();
  await page.getByRole('link', { name: 'Next ›' }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  // Back in the current month there is nothing left to clear.
  await expect(page.getByRole('link', { name: 'Clear' })).toHaveCount(0);
});
