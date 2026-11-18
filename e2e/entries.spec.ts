import { expect, test, type Page } from '@playwright/test';
import type { Account, Entry, Rate } from '../src/db/types';
import { formatDate } from '../src/lib/dates';
import { openApp } from './helpers/app';
import { seedSetup } from './helpers/seed-setup';
import { FRANKFURTER, readStore } from './helpers/setup';

// Next adds its own role="alert" route announcer outside <main>; the messages under test are inside it.
function inlineAlert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function entriesList(page: Page) {
  return page.getByRole('region', { name: 'Entries' });
}

/** The month switcher: the month in the middle, between Previous and Next. */
function monthNav(page: Page) {
  return page.getByRole('navigation', { name: 'Month', exact: true });
}

/** The chip of the category kept from Charts, which takes it off in the same month (18-11-2026). */
function categoryChip(page: Page, category: string) {
  return page.getByRole('link', { name: `${category}: show all categories`, exact: true });
}

/** The way back to the current month from another one, keeping the category. */
function thisMonthLink(page: Page) {
  return page.getByRole('link', { name: 'This month', exact: true });
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
  await seedSetup(page);
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

  // "lunch" is on no word list (review P2), so the first line asks.
  await quickAdd(page, 'lunch 6');
  // The question's chips take the focus, and after a pick it is back in the field (accessibility, chunk 5).
  await expect(page.getByRole('group', { name: 'Category' }).getByRole('button').first()).toBeFocused();
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect(status).toHaveText('Saved €6.00 · lunch · Eating out');
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeFocused();
  await expect(list.getByText('lunch')).toBeVisible();
  await expect(list.getByText('€6.00')).toBeVisible();
  await expect(page.getByLabel('Quick add')).toHaveValue('');

  // The category was learned from the first entry: no chips this time.
  await quickAdd(page, 'lunch 4');
  await expect(status).toHaveText('Saved €4.00 · lunch · Eating out');
  await expect(page.getByRole('group', { name: 'Category' })).toHaveCount(0);
  await expect(list.getByText('€4.00')).toBeVisible();
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(list.getByText('€4.00')).toHaveCount(0);
  await expect(list.getByText('€6.00')).toBeVisible();
  await expect(status).toHaveText('');
  await expect(page.getByRole('textbox', { name: 'Quick add' })).toBeFocused();
  const entries = await readStore<Entry>(page, 'entries');
  expect(entries.map((e) => [e.amountMinor, e.note])).toEqual([[600, 'lunch']]);
});

test('the hint’s own example saves under Eating out on a phone with no history', async ({ page }) => {
  await setupAndOpenEntries(page);

  // Review P2 (17-11-2026): "döner" is on quick add's food and drink words, so a first line needs no question.
  await quickAdd(page, 'döner 6');
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out'); // proof: word-list-category
  await expect(page.getByRole('group', { name: 'Category' })).toHaveCount(0);
});

test('a letter typed after a line quick add asks about starts the next line', async ({ page }) => {
  await setupAndOpenEntries(page);
  const field = page.getByRole('textbox', { name: 'Quick add' });

  await quickAdd(page, 'poster 6,50');
  await expect(page.getByRole('group', { name: 'Category' })).toBeVisible();
  // Review P3: typing on at the end of the asked line starts afresh, never "poster 6,50Bücher 12".
  await field.press('End');
  await field.pressSequentially('Bücher 12');
  await expect(field).toHaveValue('Bücher 12'); // proof: next-line-after-question
});

test('a date in the line saves the entry on that day, and a day still to come is refused', async ({ page }) => {
  // Quick add dates (18-11-2026): read on the phone, no AI. The clock is the setup day, 16.10.2026.
  await setupAndOpenEntries(page);

  await quickAdd(page, 'döner 6 yesterday');
  await expect(page.getByRole('status')).toHaveText(`Saved €6.00 · döner · Eating out · ${formatDate('2026-10-15')}`); // proof: line-date

  await quickAdd(page, 'döner 4 on 3 december 2026');
  await expect(inlineAlert(page)).toHaveText('That day is still to come. Quick add saves what you’ve already spent.');

  // A weekday (chunk 3): the setup day is a Friday, so "last friday" is the one a week before.
  await quickAdd(page, 'döner 3 last friday');
  await expect(page.getByRole('status')).toHaveText(`Saved €3.00 · döner · Eating out · ${formatDate('2026-10-09')}`); // proof: line-weekday
  const entries = await readStore<Entry>(page, 'entries');
  expect(entries.map((e) => [e.note, e.date, e.amountMinor]).sort()).toEqual([
    ['döner', '2026-10-09', 300],
    ['döner', '2026-10-15', 600],
  ]);
});

test('an asked line the next one replaces says it wasn’t saved, and one tap brings it back', async ({ page }) => {
  await setupAndOpenEntries(page);
  const field = page.getByRole('textbox', { name: 'Quick add' });
  const note = page.getByText('“poster 6,50” wasn’t saved.', { exact: true });

  await quickAdd(page, 'poster 6,50');
  await expect(page.getByRole('group', { name: 'Category' })).toBeVisible();
  // 18-11-2026, after review P3: the next line starts and saves, and the asked one is named, never gone without a word.
  await field.press('End');
  await field.pressSequentially('döner 3');
  await field.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved €3.00 · döner · Eating out');
  await expect(note).toBeVisible(); // proof: dropped-line-said
  await expect(entriesList(page).getByText('poster')).toHaveCount(0);

  // The line comes back with its question, and a chip saves it; the note goes.
  await page.getByRole('button', { name: 'Bring it back: poster 6,50', exact: true }).click();
  await expect(field).toHaveValue('poster 6,50');
  await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Shopping', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved €6.50 · poster · Shopping');
  await expect(note).toHaveCount(0);
  const entries = await readStore<Entry>(page, 'entries');
  expect(entries.map((e) => [e.note, e.amountMinor]).sort()).toEqual([
    ['döner', 300],
    ['poster', 650],
  ]);
});

test('a double tap on Add saves the entry once and leaves the Saved line alone', async ({ page }) => {
  await setupAndOpenEntries(page);
  const status = page.getByRole('status');
  const list = entriesList(page);

  // "döner" is on the word list, so both lines save by themselves.
  await quickAdd(page, 'döner 6');
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
  // The second tap lands where the chip was: nothing that moved up into its place opens (the import link once did, on
  // the iPhone). Quick add keeps its height for a moment, so neither the import nor the receipt scan under it opens.
  await expect(page).toHaveURL(/\/entries$/);
  await expect(page.getByRole('group', { name: 'Scan a receipt', exact: true })).toHaveCount(0);
  await expect(entriesList(page).getByText('€3.00')).toHaveCount(1);
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(1);
});

test('quick add saves to the default bank account, not to cash, dated today, with the amount in euro cents', async ({
  page,
}) => {
  await setupAndOpenEntries(page);

  await quickAdd(page, 'Rewe 12,50');
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
  await seedSetup(page);

  await page.goto('/settings/accounts');
  // The row buttons only exist once the accounts have been read, so a click cannot hit the prerendered page.
  const makeCash = page.getByRole('button', { name: 'Make default: Cash', exact: true });
  await expect(makeCash).toBeVisible();
  await makeCash.click();
  await expect(makeCash).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make default: Local bank', exact: true })).toBeVisible();

  const accounts = await readStore<Account>(page, 'accounts');
  const cash = accounts.find((a) => a.name === 'Cash');
  expect(accounts.filter((a) => a.isDefault).map((a) => a.name)).toEqual(['Cash']);

  // Quick add.
  await openEntries(page);
  await quickAdd(page, 'Rewe 12,50');
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

  await expect(inlineAlert(page)).toHaveText('Add an amount, like “döner 6”.');
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
  await seedSetup(page);
  // Setup refreshes the INR rate in the background. Wait for it, take it away again, and let the next
  // refresh (every page load starts one) answer without an INR rate, so the rate stays gone.
  await expect.poll(async () => (await readStore<Rate>(page, 'fxRates')).length).toBe(1);
  await page.route(FRANKFURTER, (route) =>
    route.fulfill({
      json: [],
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

  await expect(inlineAlert(page)).toHaveText('No exchange rate for INR yet. Set one in Settings → Accounts and transfers.');
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
});

test('tapping an entry edits it in place: same entry, new amount', async ({ page }) => {
  await setupAndOpenEntries(page);
  const list = entriesList(page);
  await quickAdd(page, 'döner 6');
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
  await expect(list.getByText('€6.00')).toBeVisible();

  await list.getByRole('button', { name: /döner/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  // The keyboard keeps its place: the panel opens on its heading, and Cancel returns to the entry.
  await expect(panel.getByRole('heading', { name: 'Edit entry', exact: true })).toBeFocused();
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(list.getByRole('button', { name: /döner/ })).toBeFocused();
  await list.getByRole('button', { name: /döner/ }).click();

  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  // The question takes the focus, so a screen reader says it first; Cancel gives it back to Delete.
  await expect(panel.getByText('Delete this entry?')).toBeFocused();
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel.getByText('Delete this entry?')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(1);

  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  // Exact, since the edit form's Yesterday chip also starts with "Yes".
  await panel.getByRole('button', { name: 'Yes', exact: true }).click();

  await expect(list.getByText('€6.00')).toHaveCount(0);
  await expect(list.getByText('Nothing logged here yet.')).toBeVisible();
  // The month's only entry went, so the list itself has the focus.
  await expect(list).toBeFocused();
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
  await expect(page.getByLabel('Date', { exact: true })).toHaveValue(formatDate('2026-10-16'));

  await page.getByLabel('Amount', { exact: true }).fill('950');
  await page.getByLabel('Account', { exact: true }).selectOption({ label: 'Home bank (INR)' });
  await page.getByRole('radiogroup', { name: 'Category', exact: true }).getByRole('radio', { name: 'Transport', exact: true }).check();
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
  // The field it is about says so, and reads it after its currency (accessibility, chunk 6).
  const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(amount).toHaveAccessibleDescription(/^[A-Z]{3} Enter an amount\.$/);
  await expect(page.getByRole('combobox', { name: 'Account', exact: true })).not.toHaveAttribute('aria-invalid');
  expect(await readStore<Entry>(page, 'entries')).toHaveLength(0);
});

test('the entry form in the new look: type chips, the amount in the accent card, categories as chips, and the last one kept', async ({
  page,
}) => {
  await setupAndOpenEntries(page);
  await page.getByRole('link', { name: 'Add entry' }).click();
  const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
  await expect(amount).toBeVisible();

  // The type is a row of chips that are still tabs.
  await expect(page.getByRole('tablist', { name: 'Entry type', exact: true }).getByRole('tab')).toHaveText([
    'Expense',
    'Income',
    'Transfer',
  ]);

  // The amount sits in the yellow accent card.
  const amountCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('textbox', { name: 'Amount', exact: true }) });
  await expect(amountCard).toHaveClass(/\bbg-accent\b/); // proof: amount-accent

  // The categories are chips in their groups, each with its icon, and one is chosen.
  const categories = page.getByRole('radiogroup', { name: 'Category', exact: true });
  await expect(
    categories.getByRole('group', { name: 'Fixed costs', exact: true }).getByRole('radio', { name: 'Rent', exact: true }),
  ).toBeVisible();
  const transport = categories.getByRole('radio', { name: 'Transport', exact: true });
  const transportChip = categories.locator('label').filter({ has: page.getByRole('radio', { name: 'Transport', exact: true }) });
  await expect(transportChip.locator('svg')).toHaveCount(1); // proof: category-chip-icon
  await transport.check();
  await expect(transport).toBeChecked();
  await expect(categories.getByRole('radio', { checked: true })).toHaveCount(1);

  // The account and the date share one card.
  const accountAndDate = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('combobox', { name: 'Account', exact: true }) })
    .filter({ has: page.getByRole('textbox', { name: 'Date', exact: true }) });
  await expect(accountAndDate).toHaveCount(1);

  // Saving remembers the chip for the next expense on this phone. A full load, so the form starts afresh rather than
  // as the hidden page it stayed mounted as.
  await amount.fill('4');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  await openApp(page, '/entries/new');
  await expect(categories.getByRole('radio', { name: 'Transport', exact: true })).toBeChecked();
});

test('the entry form takes income, and a transfer through the transfer form', async ({ page }) => {
  await setupAndOpenEntries(page);
  await page.getByRole('link', { name: 'Add entry' }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();

  // Expense offers every category except income; Income offers only income categories.
  const rent = page.getByRole('radiogroup', { name: 'Category', exact: true }).getByRole('radio', { name: 'Rent', exact: true });
  await expect(rent).toHaveCount(1);
  await page.getByRole('tab', { name: 'Income' }).click();
  await expect(rent).toHaveCount(0);
  await page.getByLabel('Amount', { exact: true }).fill('400');
  await page.getByLabel('Account', { exact: true }).selectOption({ label: 'Local bank (EUR)' });
  await page.getByRole('radiogroup', { name: 'Category', exact: true }).getByRole('radio', { name: 'Job', exact: true }).check();
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
  await panel.getByRole('radiogroup', { name: 'Category', exact: true }).getByRole('radio', { name: 'Shopping', exact: true }).check();
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

  // The category kept from Charts is a chip that takes it off; in the current month there is no way back to show.
  await page.goto('/entries?category=food&month=2026-10');
  await expect(monthNav(page).getByText('Oct 2026', { exact: true })).toBeVisible();
  await expect(categoryChip(page, 'Food & groceries')).toBeVisible();
  await expect(thisMonthLink(page)).toHaveCount(0);
  await expect(list.getByText('Rewe')).toBeVisible();
  await expect(list.getByText('döner')).toHaveCount(0);

  await categoryChip(page, 'Food & groceries').click();
  await expect(page).toHaveURL('/entries');
  await expect(list.getByText('döner')).toBeVisible();

  await page.goto('/entries?month=2026-08');
  await expect(monthNav(page).getByText('Aug 2026', { exact: true })).toBeVisible();
  await expect(thisMonthLink(page)).toBeVisible();
  await expect(list.getByText('Aldi')).toBeVisible();
  await expect(list.getByText('Rewe')).toHaveCount(0);

  await page.goto('/entries?month=2026-11');
  await expect(monthNav(page).getByText('Nov 2026', { exact: true })).toBeVisible();
  await expect(thisMonthLink(page)).toBeVisible();
  await expect(list.getByText('Nothing logged here yet.')).toBeVisible();

  // 18-11-2026: one "Clear" for both read as deleting the list. Now the chip keeps the month it is in, and This month
  // keeps the category.
  await page.goto('/entries?category=food&month=2026-08');
  await categoryChip(page, 'Food & groceries').click();
  await expect(page).toHaveURL('/entries?month=2026-08'); // proof: chip-keeps-month
  await expect(list.getByText('Aldi')).toBeVisible();
  await page.goto('/entries?category=food&month=2026-08');
  await thisMonthLink(page).click();
  await expect(page).toHaveURL('/entries?category=food');
  await expect(list.getByText('Rewe')).toBeVisible();
  await expect(list.getByText('döner')).toHaveCount(0);
});

test('the entries pages fit a phone without sideways scrolling', async ({ page }) => {
  await setupAndOpenEntries(page);
  await quickAdd(page, 'a long note about a very expensive kebab dinner with friends 12');
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
  await page.getByLabel('Date', { exact: true }).fill(formatDate('2026-09-30'));
  await page.getByLabel('Note', { exact: true }).fill('Mensa');
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page).toHaveURL('/entries?month=2026-09');
  const list = entriesList(page);
  await expect(list.getByText('Mensa')).toBeVisible();
  await expect(list.getByText('€9.50')).toBeVisible();
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(['Wednesday, 30 September']);

  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  await expect(page.getByText('Oct 2026')).toBeVisible();
  await expect(list.getByText('Mensa')).toHaveCount(0);

  await page.getByRole('link', { name: 'Previous', exact: true }).click();
  await expect(list.getByText('Mensa')).toBeVisible();
  await page.getByRole('link', { name: 'Previous', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-08');
  await expect(list.getByText('Mensa')).toHaveCount(0);
});

test('the month links keep the category and roll over the year', async ({ page }) => {
  await setupAndOpenEntries(page);

  await page.goto('/entries?category=food&month=2026-12');
  await expect(monthNav(page).getByText('Dec 2026', { exact: true })).toBeVisible();
  await expect(categoryChip(page, 'Food & groceries')).toBeVisible();
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/month=2027-01/);
  await expect(page).toHaveURL(/category=food/);
  await expect(monthNav(page).getByText('Jan 2027', { exact: true })).toBeVisible();
  await expect(categoryChip(page, 'Food & groceries')).toBeVisible();

  // Wait for each page before the next tap, or both taps hit the link of the page that was showing.
  await page.getByRole('link', { name: 'Previous', exact: true }).click();
  await expect(page).toHaveURL(/month=2026-12/);
  await page.getByRole('link', { name: 'Previous', exact: true }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(page).toHaveURL(/category=food/);

  // Without a month in the address the links start from the current month, and This month is not needed.
  await page.goto('/entries');
  await expect(page.getByText('Oct 2026')).toBeVisible();
  await expect(thisMonthLink(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-09');
  await expect(thisMonthLink(page)).toBeVisible();
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  // Back in the current month there is no way back to show.
  await expect(thisMonthLink(page)).toHaveCount(0);
});

test('the list moves on to the new month when the app is opened again after a month end', async ({ page }) => {
  await setupAndOpenEntries(page);
  await expect(page.getByText('Oct 2026')).toBeVisible();

  // An installed app is resumed, not reloaded: nothing is read or written, only the date moves.
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Nov 2026')).toBeVisible();
  await expect(page.getByText('Oct 2026')).toHaveCount(0);
  // November is the current month again, so there is no way back to show.
  await expect(thisMonthLink(page)).toHaveCount(0);
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

test('the date field is a text box in DD.MM.YYYY, and digits typed on a number pad get their dots', async ({ page }) => {
  await setupAndOpenEntries(page);
  await openNewEntry(page);
  const date = page.getByRole('textbox', { name: 'Date', exact: true });

  await expect(date).toHaveValue(formatDate('2026-10-16'));
  await expect(date).toHaveAttribute('inputmode', 'numeric');
  await expect(date).toHaveAccessibleDescription('Type it like DD.MM.YYYY, or open the calendar.');

  // A phone's number pad has no dot: the field puts them in, and a date without its year is this year's.
  await date.fill('');
  await expect(date).toHaveAttribute('placeholder', 'DD.MM.YYYY');
  await date.pressSequentially('0910');
  await expect(date).toHaveValue('09.10.');
  await date.blur();
  await expect(date).toHaveValue(formatDate('2026-10-09'));
  // Neither chip stands for another date.
  await expect(dateChip(page, 'Today')).toHaveAttribute('aria-pressed', 'false');
  await expect(dateChip(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'false');

  // Short forms with dots, and a two-digit year, are written out in full once the field is left.
  await date.fill('1.10.26');
  await date.blur();
  await expect(date).toHaveValue(formatDate('2026-10-01'));

  // A whole date counts as it is typed: the chip that matches lights up before the field is left.
  await date.fill(formatDate('2026-10-15'));
  await expect(dateChip(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Amount', { exact: true }).fill('8,40');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page).toHaveURL('/entries?month=2026-10');
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({ amountMinor: 840, date: '2026-10-15' });
});

test('a typed date that does not exist says so in place of the hint, and nothing is saved', async ({ page }) => {
  await setupAndOpenEntries(page);
  await openNewEntry(page);
  const date = page.getByRole('textbox', { name: 'Date', exact: true });
  await page.getByLabel('Amount', { exact: true }).fill('8,40');

  await date.fill('31.02.2026');
  await date.blur();
  await expect(date).toHaveValue('31.02.2026');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(date).toHaveAccessibleDescription('That’s not a date. Type it like DD.MM.YYYY.');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText('Pick a date.', { exact: true })).toBeVisible();
  expect(await readStore<Entry>(page, 'entries')).toEqual([]);

  // Enter reads a short form and stays on the page; the next Enter saves.
  await date.fill('15.10');
  await expect(date).not.toHaveAccessibleDescription(/not a date/);
  await date.press('Enter');
  await expect(date).toHaveValue(formatDate('2026-10-15'));
  await expect(page).toHaveURL(/\/entries\/new/);
  await date.press('Enter');
  await expect(page).toHaveURL('/entries?month=2026-10');
  const [entry] = await readStore<Entry>(page, 'entries');
  expect(entry).toMatchObject({ amountMinor: 840, date: '2026-10-15' });
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
  await expect(date).toHaveValue(formatDate('2026-10-15'));
  await expect(yesterday).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toHaveAttribute('aria-pressed', 'false');

  await today.click();
  await expect(date).toHaveValue(formatDate('2026-10-16'));
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
  await expect(date).toHaveValue(formatDate('2026-10-17'));
  await expect(dateChip(page, 'Today')).toHaveAttribute('aria-pressed', 'true');
  await dateChip(page, 'Yesterday').click();
  await expect(date).toHaveValue(formatDate('2026-10-16'));

  // A picked date stays where it was, and the chips now say it is neither of the two.
  await page.clock.setFixedTime(new Date(2026, 9, 18, 0, 5, 0));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(date).toHaveValue(formatDate('2026-10-16'));
  await expect(dateChip(page, 'Today')).toHaveAttribute('aria-pressed', 'false');
  await expect(dateChip(page, 'Yesterday')).toHaveAttribute('aria-pressed', 'false');
});

test('editing an entry shows its date as DD.MM.YYYY, with the chip that matches', async ({ page }) => {
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
  await expect(panel.getByLabel('Date', { exact: true })).toHaveValue(formatDate('2026-10-15'));
  await expect(panel.getByRole('button', { name: 'Yesterday', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Today moves the entry to today's date and keeps it the same entry.
  await panel.getByRole('button', { name: 'Today', exact: true }).click();
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel).toHaveCount(0);
  const after = await readStore<Entry>(page, 'entries');
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ id: 'e', date: '2026-10-16' });
});

test('quick add shows the original six categories first, tinted, and More gives way to the other six', async ({ page }) => {
  await setupAndOpenEntries(page);
  // 375 px, the narrowest phone the app is made for.
  await page.setViewportSize({ width: 375, height: 812 });

  await quickAdd(page, 'pharmacy 7');
  const group = page.getByRole('group', { name: 'Category' });
  const moreChip = group.getByRole('button', { name: 'More', exact: true });
  const names = () => group.getByRole('button').allTextContents();
  const original = ['Food & groceries', 'Eating out', 'Going out', 'Transport', 'Shopping', 'Other'];
  const more = ['Health & pharmacy', 'Personal care', 'Personal', 'Study materials', 'Household', 'Travel', 'Gifts'];

  await expect(moreChip).toHaveAttribute('aria-expanded', 'false');
  expect(await names()).toEqual([...original, 'More']);
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  // Each chip sits on its category's tint, with its icon, as on Tips, Discounts and Add entry (18-11-2026).
  const eatingOut = group.getByRole('button', { name: 'Eating out', exact: true });
  await expect(eatingOut).toHaveAttribute('style', /background-color/); // proof: chips-tinted
  await expect(eatingOut.locator('svg')).toHaveCount(1);

  // More gives way to the categories it held, and the focus moves to the first of them, since More is gone.
  await moreChip.click();
  await expect(moreChip).toHaveCount(0); // proof: more-goes
  await expect(group.getByRole('button', { name: 'Health & pharmacy', exact: true })).toBeFocused(); // proof: more-focus
  expect(await names()).toEqual([...original, ...more]);
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

test('an entry a schedule posted shows an Automatic tag in the list', async ({ page }) => {
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
  await expect(list.getByRole('listitem').filter({ hasText: 'Rent' }).getByText('Automatic', { exact: true })).toBeVisible();
  await expect(list.getByRole('listitem').filter({ hasText: 'Rewe' }).getByText('Automatic')).toHaveCount(0);
  await expect(list.getByText('Automatic', { exact: true })).toHaveCount(1);
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
  await expect(renamed.getByText('Automatic', { exact: true })).toBeVisible();
  // A note of its own brings the category back under it.
  await expect(renamed.getByText('Rent', { exact: true })).toBeVisible();
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
});

test('the list leads to the bank statement import', async ({ page }) => {
  await seedSetup(page);
  await openEntries(page);
  await page.getByRole('link', { name: 'Import a bank statement', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Import and export', exact: true })).toBeVisible();
  await expect(page).toHaveURL('/settings/import');
});

test('each entry is its own card with its category and account; an empty month points to quick add; the import is at the foot', async ({
  page,
}) => {
  await setupAndOpenEntries(page);
  const list = entriesList(page);

  // An empty month: one card that says where to log.
  await expect(list.getByText('Nothing logged here yet.', { exact: true })).toBeVisible();
  await expect(list.getByText('Log with quick add above.', { exact: true })).toBeVisible(); // proof: empty-hint

  // The receipt scan under quick add; Previous and Next keep their names around the month.
  await expect(page.getByRole('button', { name: 'Scan a receipt', exact: true })).toBeVisible();
  await expect(monthNav(page).getByRole('link', { name: 'Previous', exact: true })).toBeVisible();
  await expect(monthNav(page).getByText('Oct 2026', { exact: true })).toBeVisible();
  await expect(monthNav(page).getByRole('link', { name: 'Next', exact: true })).toBeVisible();

  await quickAdd(page, 'döner 6');
  await expect(page.getByRole('status')).toHaveText('Saved €6.00 · döner · Eating out');

  // "Category · Account" under the title: quick add saved to Local bank, the first euro bank account.
  const card = list.getByRole('button', { name: /döner/ });
  await expect(card.getByText('Eating out', { exact: true })).toBeVisible();
  await expect(card.getByText('Local bank', { exact: true })).toBeVisible(); // proof: entry-account
  await expect(list.getByText('Nothing logged here yet.', { exact: true })).toHaveCount(0);

  // The bank statement import comes after the list, at the page's foot.
  await expect(list.locator('xpath=following::a[normalize-space()="Import a bank statement"]')).toBeVisible();
  expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('quick add reads German number words', async ({ page }) => {
    // Number words (18-11-2026): on a German phone, "sechs Euro fünfzig" is €6.50.
    await seedSetup(page);
    await page.goto('/entries');
    await expect(page.getByText('Okt. 2026')).toBeVisible();
    await page.getByRole('textbox', { name: 'Schnell erfassen', exact: true }).fill('Döner sechs Euro fünfzig');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(/^Gespeichert: 6,50\s€ · Döner · Essen auswärts$/); // proof: number-words
  });
});
