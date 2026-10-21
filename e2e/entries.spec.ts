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

test('a double tap on Add saves the entry once and leaves the Saved line alone', async ({ page }) => {
  await setupAndOpenEntries(page);
  const status = page.getByRole('status');
  const list = entriesList(page);

  // Learn the category, so the second line saves by itself.
  await quickAdd(page, 'döner 6');
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(status).toHaveText('Saved €6.00 · döner · Eating out');

  await page.getByRole('textbox', { name: 'Quick add' }).fill('döner 4');
  await page.getByRole('button', { name: 'Add', exact: true }).dblclick();

  await expect(status).toHaveText('Saved €4.00 · döner · Eating out');
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toHaveValue('');
  await expect(list.getByText('€4.00')).toHaveCount(1);
  // The store is ordered by id, not by time, so sort the amounts before comparing.
  const amounts = (await readStore<Entry>(page, 'entries')).map((e) => e.amountMinor);
  expect(amounts.sort((a, b) => a - b)).toEqual([400, 600]);

  // A tap on the now empty field is not a second save, and says nothing.
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(status).toHaveText('Saved €4.00 · döner · Eating out');
  await expect(inlineAlert(page)).toHaveCount(0);
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(2);
});

test('a double tap on a category chip saves the entry once', async ({ page }) => {
  await setupAndOpenEntries(page);

  await quickAdd(page, 'bus 3');
  await page.getByRole('button', { name: 'Transport' }).dblclick();

  await expect(page.getByRole('status')).toHaveText('Saved €3.00 · bus · Transport');
  await expect(entriesList(page).getByText('€3.00')).toHaveCount(1);
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(1);
});

test('quick add saves to the default bank account, not to cash, dated today, with the amount in euro cents', async ({
  page,
}) => {
  await setupAndOpenEntries(page);

  await quickAdd(page, 'Rewe 12,50');
  await page.getByRole('button', { name: 'Food & groceries' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €12.50 · Rewe · Food & groceries');

  // No account is marked as the default, so it is the first euro bank account: Local bank, which setup made first.
  const accounts = await readStore<Account>(page, 'accounts');
  const local = accounts.find((a) => a.name === 'Local bank');
  const cash = accounts.find((a) => a.name === 'Cash');
  expect(accounts.some((a) => a.isDefault)).toBe(false);
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry.accountId).not.toBe(cash?.id);
  expect(entry).toMatchObject({
    type: 'expense',
    accountId: local?.id,
    amountMinor: 1250,
    eurMinor: 1250,
    categoryId: 'food',
    note: 'Rewe',
    date: '2026-10-16',
  });
});

test('the entry form opens on the default bank account for an expense and an income, and the transfer starts there', async ({
  page,
}) => {
  await setupAndOpenEntries(page);
  await page.getByRole('link', { name: 'Add entry' }).click();
  const account = page.getByLabel('Account', { exact: true });
  await expect(account.locator('option:checked')).toHaveText('Local bank (EUR)');

  await page.getByRole('tab', { name: 'Income' }).click();
  await expect(account.locator('option:checked')).toHaveText('Local bank (EUR)');

  // The transfer sends from the default account, and receives into the first other one.
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await expect(page.getByLabel('From', { exact: true }).locator('option:checked')).toHaveText('Local bank (EUR)');
  await expect(page.getByLabel('To', { exact: true }).locator('option:checked')).toHaveText('Home bank (INR)');
});

test('making Cash the default account in Settings moves quick add, the entry form and the transfer to it', async ({
  page,
}) => {
  await completeSetup(page);

  await page.goto('/settings');
  // The row buttons only exist once the accounts have been read, so a click cannot hit the prerendered page.
  const makeCash = page.getByRole('button', { name: 'Make Cash the default', exact: true });
  await expect(makeCash).toBeVisible();
  await makeCash.click();
  await expect(makeCash).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make Local bank the default', exact: true })).toBeVisible();

  const accounts = await readStore<Account>(page, 'accounts');
  const cash = accounts.find((a) => a.name === 'Cash');
  expect(accounts.filter((a) => a.isDefault).map((a) => a.name)).toEqual(['Cash']);

  // Quick add.
  await openEntries(page);
  await quickAdd(page, 'Rewe 12,50');
  await page.getByRole('button', { name: 'Food & groceries' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €12.50 · Rewe · Food & groceries');
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({ type: 'expense', accountId: cash?.id, amountMinor: 1250 });

  // The entry form: expense, income and the transfer's From. To is the first other account.
  await page.getByRole('link', { name: 'Add entry' }).click();
  const account = page.getByLabel('Account', { exact: true });
  await expect(account.locator('option:checked')).toHaveText('Cash (EUR)');
  await page.getByRole('tab', { name: 'Income' }).click();
  await expect(account.locator('option:checked')).toHaveText('Cash (EUR)');
  await page.getByRole('tab', { name: 'Transfer' }).click();
  await expect(page.getByLabel('From', { exact: true }).locator('option:checked')).toHaveText('Cash (EUR)');
  await expect(page.getByLabel('To', { exact: true }).locator('option:checked')).toHaveText('Local bank (EUR)');
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
  // Quick add saves to the default account: make the INR account the default.
  const accounts = await readStore<Account>(page, 'accounts');
  const homeBank = accounts.find((a) => a.name === 'Home bank');
  expect(homeBank).toBeTruthy();
  await writeStore(page, 'accounts', { put: [{ ...homeBank, isDefault: true }] });
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
  // Exact, since the edit form's Yesterday chip also starts with "Yes".
  await panel.getByRole('button', { name: 'Yes', exact: true }).click();

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

test('the list moves on to the new month when the app is opened again after a month end', async ({ page }) => {
  await setupAndOpenEntries(page);
  await expect(page.getByText('Oct 2026')).toBeVisible();

  // An installed app is resumed, not reloaded: nothing is read or written, only the date moves.
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Nov 2026')).toBeVisible();
  await expect(page.getByText('Oct 2026')).toHaveCount(0);
  // November is the current month again, so there is nothing to clear.
  await expect(page.getByRole('link', { name: 'Clear' })).toHaveCount(0);
});

async function pageOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

function dateChip(page: Page, name: 'Today' | 'Yesterday') {
  return page.getByRole('button', { name, exact: true });
}

/** Opens the New entry page from /entries and waits until its form has rendered. */
async function openNewEntry(page: Page) {
  await page.getByRole('link', { name: 'Add entry' }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();
}

test('the date field shows DD-MM-YYYY and the native input keeps the ISO value and the label', async ({ page }) => {
  await setupAndOpenEntries(page);
  await openNewEntry(page);
  const date = page.getByLabel('Date', { exact: true });

  await expect(date).toHaveValue('2026-10-16');
  await expect(date).toHaveAttribute('type', 'date');
  const shown = page.getByText('16-10-2026', { exact: true });
  await expect(shown).toBeVisible();
  // The text is for the eye: the input says the date to a screen reader.
  await expect(shown).toHaveAttribute('aria-hidden', 'true');

  await date.fill('2026-10-09');
  await expect(date).toHaveValue('2026-10-09');
  await expect(page.getByText('09-10-2026', { exact: true })).toBeVisible();
  await expect(page.getByText('16-10-2026', { exact: true })).toHaveCount(0);
  // Neither chip stands for another date.
  await expect(dateChip(page, 'Today')).toHaveAttribute('aria-pressed', 'false');
  await expect(dateChip(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'false');
});

test('Yesterday dates the entry the day before, and Today takes it back', async ({ page }) => {
  await setupAndOpenEntries(page);
  await openNewEntry(page);
  const date = page.getByLabel('Date', { exact: true });
  const today = dateChip(page, 'Today');
  const yesterday = dateChip(page, 'Yesterday');

  // The chip that matches is marked, from the start.
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(yesterday).toHaveAttribute('aria-pressed', 'false');

  await yesterday.click();
  await expect(date).toHaveValue('2026-10-15');
  await expect(page.getByText('15-10-2026', { exact: true })).toBeVisible();
  await expect(yesterday).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-pressed', 'false');

  await today.click();
  await expect(date).toHaveValue('2026-10-16');
  await expect(today).toHaveAttribute('aria-pressed', 'true');

  await yesterday.click();
  await page.getByLabel('Amount', { exact: true }).fill('8,40');
  await page.getByLabel('Note', { exact: true }).fill('Mensa');
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page).toHaveURL('/entries?month=2026-10');
  await expect(entriesList(page).getByRole('heading', { level: 3 })).toHaveText(['Thursday, 15 October']);
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({ type: 'expense', note: 'Mensa', amountMinor: 840, date: '2026-10-15' });
});

test('Today and Yesterday follow the clock, and a picked date stays', async ({ page }) => {
  await setupAndOpenEntries(page);
  await openNewEntry(page);
  const date = page.getByLabel('Date', { exact: true });

  // The form stays open past midnight: "today" is the date now, not the one when it opened.
  await page.clock.setFixedTime(new Date(2026, 9, 17, 0, 5, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(date).toHaveValue('2026-10-17');
  await expect(dateChip(page, 'Today')).toHaveAttribute('aria-pressed', 'true');
  await dateChip(page, 'Yesterday').click();
  await expect(date).toHaveValue('2026-10-16');

  // A picked date stays where it was, and the chips now say it is neither of the two.
  await page.clock.setFixedTime(new Date(2026, 9, 18, 0, 5, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(date).toHaveValue('2026-10-16');
  await expect(dateChip(page, 'Today')).toHaveAttribute('aria-pressed', 'false');
  await expect(dateChip(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'false');
});

test('editing an entry shows its date as DD-MM-YYYY, with the chip that matches', async ({ page }) => {
  await setupAndOpenEntries(page);
  const accountId = (await readStore<Account>(page, 'accounts')).find((a) => a.name === 'Cash')?.id;
  await writeStore(page, 'entries', {
    put: [
      {
        id: 'e',
        type: 'expense',
        date: '2026-10-15',
        accountId,
        amountMinor: 300,
        eurMinor: 300,
        categoryId: 'food',
        note: 'Rewe',
        createdAt: '2026-10-15T10:00:00.000Z',
      },
    ],
  });
  await openEntries(page);

  await entriesList(page).getByRole('button', { name: /Rewe/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await expect(panel.getByLabel('Date', { exact: true })).toHaveValue('2026-10-15');
  await expect(panel.getByText('15-10-2026', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Yesterday', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Today moves the entry to today's date and keeps it the same entry.
  await panel.getByRole('button', { name: 'Today', exact: true }).click();
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel).toHaveCount(0);
  const after = await readStore<Entry>(page, 'entries');
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ id: 'e', date: '2026-10-16' });
});

test('a tap anywhere on the date field lands on the native date input', async ({ page, isMobile }) => {
  await setupAndOpenEntries(page);
  await openNewEntry(page);
  const date = page.getByLabel('Date', { exact: true });
  const shown = await page.getByText('16-10-2026', { exact: true }).boundingBox();
  const input = await date.boundingBox();
  const inputId = await date.getAttribute('id');
  expect(shown && input && inputId).toBeTruthy();

  // The input lies over the whole field: the text, the calendar icon and the padding around them.
  expect(input!.width).toBeGreaterThan(shown!.width * 2);
  expect(input!.x).toBeLessThanOrEqual(shown!.x);
  const y = input!.y + input!.height / 2;
  const xs = [input!.x + 3, shown!.x + shown!.width / 2, input!.x + input!.width - 3];
  for (const x of xs) {
    const topId = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id, [x, y] as const);
    expect(topId).toBe(inputId);
  }

  // A tap at the far end, over the icon, reaches it. A mouse click also asks the browser for the picker.
  await page.evaluate(() => {
    const calls = { count: 0 };
    Object.assign(window, { pickerCalls: calls });
    HTMLInputElement.prototype.showPicker = () => {
      calls.count += 1;
    };
  });
  const tapX = xs[xs.length - 1];
  if (isMobile) await page.touchscreen.tap(tapX, y);
  else await page.mouse.click(tapX, y);
  await expect(date).toBeFocused();
  const pickerCalls = await page.evaluate(
    () => (window as unknown as { pickerCalls: { count: number } }).pickerCalls.count,
  );
  // A touch tap is left to the browser, which opens the picker by itself.
  expect(pickerCalls).toBe(isMobile ? 0 : 1);
});

test('quick add shows the original six categories first, and More shows the other six', async ({ page }) => {
  await setupAndOpenEntries(page);
  // 375 px, the narrowest phone the app is made for.
  await page.setViewportSize({ width: 375, height: 812 });

  await quickAdd(page, 'pharmacy 7');
  const group = page.getByRole('group', { name: 'Category' });
  const moreChip = group.getByRole('button', { name: 'More', exact: true });
  const names = () => group.getByRole('button').allTextContents();
  const original = ['Food & groceries', 'Eating out', 'Going out', 'Transport', 'Shopping', 'Other'];
  const more = ['Health & pharmacy', 'Personal care', 'Study materials', 'Household', 'Travel', 'Gifts'];

  await expect(moreChip).toHaveAttribute('aria-expanded', 'false');
  expect(await names()).toEqual([...original, 'More']);
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

  await moreChip.click();
  await expect(moreChip).toHaveAttribute('aria-expanded', 'true');
  expect(await names()).toEqual([...original, 'More', ...more]);
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

  await group.getByRole('button', { name: 'Health & pharmacy', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €7.00 · pharmacy · Health & pharmacy');
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({ type: 'expense', categoryId: 'health', note: 'pharmacy', amountMinor: 700 });

  // The next line that has to ask starts with the six again.
  await quickAdd(page, 'poster 3');
  await expect(moreChip).toHaveAttribute('aria-expanded', 'false');
  expect(await names()).toEqual([...original, 'More']);
});

test('an entry a schedule posted shows a Recurring tag in the list', async ({ page }) => {
  await setupAndOpenEntries(page);
  const accountId = (await readStore<Account>(page, 'accounts')).find((a) => a.name === 'Cash')?.id;
  const base = { type: 'expense', accountId, createdAt: '2026-10-16T10:00:00.000Z' };
  await writeStore(page, 'entries', {
    put: [
      {
        ...base,
        id: 'rent',
        date: '2026-10-01',
        amountMinor: 40000,
        eurMinor: 40000,
        categoryId: 'rent',
        note: 'Rent',
        recurring: { scheduleId: 's-rent' },
      },
      { ...base, id: 'once', date: '2026-10-02', amountMinor: 900, eurMinor: 900, categoryId: 'food', note: 'Rewe' },
    ],
  });

  await openEntries(page);
  const list = entriesList(page);
  await expect(list.getByRole('listitem').filter({ hasText: 'Rent' }).getByText('Recurring', { exact: true })).toBeVisible();
  await expect(list.getByRole('listitem').filter({ hasText: 'Rewe' }).getByText('Recurring')).toHaveCount(0);
  await expect(list.getByText('Recurring', { exact: true })).toHaveCount(1);
  // The note is the category name, so the row says "Rent" once, not "Rent" over "Rent". Rewe keeps its category.
  await expect(list.getByRole('listitem').filter({ hasText: 'Rent' }).getByText('Rent', { exact: true })).toHaveCount(1);
  await expect(list.getByRole('listitem').filter({ hasText: 'Rewe' }).getByText('Food & groceries', { exact: true })).toBeVisible();

  // Editing the entry keeps its tag.
  await list.getByRole('button', { name: /Rent/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await panel.getByLabel('Note').fill('October rent');
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel).toHaveCount(0);
  const renamed = list.getByRole('listitem').filter({ hasText: 'October rent' });
  await expect(renamed.getByText('Recurring', { exact: true })).toBeVisible();
  // A note of its own brings the category back under it.
  await expect(renamed.getByText('Rent', { exact: true })).toBeVisible();
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
});
