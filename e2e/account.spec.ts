import { expect, test, type Page } from '@playwright/test';
import type { Account, Guess, Plan } from '../src/db/types';
import { completeSetup, mockFrankfurter, readStore, SETUP_DAY } from './helpers/setup';
import {
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  SUPABASE_AUTH,
  SUPABASE_REST,
  type ServerTables,
} from './helpers/supabase';

// 375 px, the narrowest phone the app is made for. Supabase Auth is mocked: the configs point the app at a project
// that never resolves, and `mockSupabaseAuth` answers its calls.
test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

function emailField(page: Page) {
  return page.getByRole('textbox', { name: 'Email', exact: true });
}

/** A password input has no textbox role, so it is found by its label. */
function passwordField(page: Page) {
  return page.getByLabel('Password', { exact: true });
}

/** The form's message. Inside main: Next's route announcer is an alert of its own, outside it. */
function alert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function signedInLine(page: Page, email: string) {
  return page.getByText(`Signed in as ${email}.`, { exact: true });
}

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function signIn(page: Page, email: string, password: string) {
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('Settings opens with Your account; signing in and out there keeps the plan on the phone', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await completeSetup(page);

  await page.goto('/settings');
  // The first section of Settings, before Profile.
  await expect(page.getByRole('main').getByRole('heading', { level: 3 }).first()).toHaveText('Your account');
  const card = page.getByRole('region', { name: 'Your account', exact: true });
  await expect(card.getByText('everything stays on this phone', { exact: false })).toBeVisible();
  await card.getByRole('link', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL('/settings/account');
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();
  // Still under Settings in the bottom navigation.
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await signIn(page, ` ${EMAIL} `, PASSWORD);
  await expect(signedInLine(page, EMAIL)).toBeVisible();
  expect(calls.at(-1)).toMatchObject({
    method: 'POST',
    path: '/token',
    search: '?grant_type=password',
    // The email is sent trimmed, the password exactly as typed.
    body: { email: EMAIL, password: PASSWORD },
  });
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  // Settings says who is signed in.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click();
  await expect(card.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await card.getByRole('link', { name: 'Manage account', exact: true }).click();

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();
  expect(calls.at(-1)).toMatchObject({ method: 'POST', path: '/logout', search: '?scope=local' });
  // Signing out leaves the data where it was.
  expect(await readStore<Plan>(page, 'plan')).toHaveLength(1);
});

test('a new account is checked first, then signed in at once and still signed in after a reload', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page);

  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Create an account', exact: true })).toBeVisible();
  await expect(page.getByText('At least 8 characters.', { exact: true })).toBeVisible();

  // Checked on the phone: nothing is sent.
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(alert(page)).toHaveText('Enter your email.');
  await emailField(page).fill('roshan@');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(alert(page)).toHaveText('Check the email address.');
  await emailField(page).fill(EMAIL);
  await passwordField(page).fill('short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(alert(page)).toHaveText('Use at least 8 characters for the password.');
  expect(calls).toHaveLength(0);

  await passwordField(page).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(signedInLine(page, EMAIL)).toBeVisible();
  expect(calls).toEqual([expect.objectContaining({ method: 'POST', path: '/signup' })]);

  // The session is kept on the phone.
  await page.reload();
  await expect(signedInLine(page, EMAIL)).toBeVisible();
});

test('says calmly what went wrong: a wrong password, a taken email, offline, no answer', async ({ page, context }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });

  await signIn(page, EMAIL, 'wrong password');
  await expect(alert(page)).toHaveText('Email or password is wrong.');
  // The form stays: the email is kept to try again.
  await expect(emailField(page)).toHaveValue(EMAIL);

  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  // Switching clears the message.
  await expect(alert(page)).toHaveCount(0);
  await passwordField(page).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(alert(page)).toHaveText('This email already has an account. Sign in instead.');
  await page.getByRole('button', { name: 'Have an account? Sign in', exact: true }).click();

  // Offline: the form says so and sends nothing.
  const before = calls.length;
  await context.setOffline(true);
  await signIn(page, EMAIL, PASSWORD);
  await expect(alert(page)).toHaveText("You're offline. Signing in needs a connection.");
  expect(calls).toHaveLength(before);
  await context.setOffline(false);

  // Online, but the server never answers.
  await page.unroute(SUPABASE_AUTH);
  await page.route(SUPABASE_AUTH, (route) => route.abort('connectionfailed'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(alert(page)).toHaveText(
    "The account server can't be reached. Check your connection and try again.",
  );
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();
});

/** The account page's save section. */
function saveSection(page: Page) {
  return page.getByRole('region', { name: 'Save to your account', exact: true });
}

/** The rows the mock keeps for one table, sorted by id, as plain data. */
function serverRows(data: ServerTables, table: string): unknown[] {
  const rows = data.get(table) ?? new Map<string, unknown>();
  return [...rows.keys()].sort().map((id) => rows.get(id));
}

test('Save to my account copies the phone, and asks before it removes what only the account has', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const data = await mockSupabaseData(page);
  await completeSetup(page);

  await page.goto('/settings/account');
  await signIn(page, EMAIL, PASSWORD);
  await expect(signedInLine(page, EMAIL)).toBeVisible();
  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await expect(saveSection(page).getByText('Saved to your account: 3 accounts, 0 entries and your plan.')).toBeVisible();

  // The account holds exactly the phone's rows.
  const byId = <T extends object>(key: keyof T) => (a: T, b: T) => String(a[key]).localeCompare(String(b[key]));
  expect(serverRows(data, 'accounts')).toEqual((await readStore<Account>(page, 'accounts')).sort(byId<Account>('id')));
  expect(serverRows(data, 'plans')).toEqual(await readStore<Plan>(page, 'plan'));
  expect(serverRows(data, 'guesses')).toEqual(
    (await readStore<Guess>(page, 'guesses')).sort(byId<Guess>('categoryId')),
  );
  expect(serverRows(data, 'entries')).toEqual([]);

  // A row only the account has, as if saved from another phone: the save asks first, and Cancel keeps it.
  data.get('entries')?.set('from-another-phone', { id: 'from-another-phone' });
  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await expect(
    saveSection(page).getByText("Your account has 1 entry that this phone doesn't.", { exact: false }),
  ).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  // The question takes focus, so a screen reader reads it out with the button.
  await expect(saveSection(page).getByRole('button', { name: 'Save anyway', exact: true })).toBeFocused();

  // Leaving the page drops the question: the page stays mounted while hidden, and an old question would save an old
  // snapshot.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await nav.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage account', exact: true }).click();
  await expect(saveSection(page).getByRole('button', { name: 'Save anyway', exact: true })).toHaveCount(0);
  await expect(saveSection(page).getByRole('button', { name: 'Save to my account', exact: true })).toBeVisible();

  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await saveSection(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  // Cancel closes the question, gives focus back, and sends nothing.
  const saveButton = saveSection(page).getByRole('button', { name: 'Save to my account', exact: true });
  await expect(saveButton).toBeFocused();
  await expect(saveSection(page).getByRole('button', { name: 'Save anyway', exact: true })).toHaveCount(0);
  expect(data.get('entries')?.get('from-another-phone')).toEqual({ id: 'from-another-phone' });

  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await saveSection(page).getByRole('button', { name: 'Save anyway', exact: true }).click();
  await expect(saveSection(page).getByText('Saved to your account: 3 accounts, 0 entries and your plan.')).toBeVisible();
  // Deleted as a tombstone: the row stays, without data, so other phones learn of the delete.
  expect(data.get('entries')?.get('from-another-phone')).toBeNull();
});

test('without a plan there is nothing to save yet, and a refused save says so calmly', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockSupabaseData(page, { failWith: 500 });

  await signIn(page, EMAIL, PASSWORD);
  await expect(
    saveSection(page).getByText('Set up your plan on this phone first; then you can save it here.', { exact: true }),
  ).toBeVisible();
  await expect(saveSection(page).getByRole('button', { name: 'Save to my account', exact: true })).toHaveCount(0);

  await completeSetup(page);
  await page.goto('/settings/account');
  await expect(signedInLine(page, EMAIL)).toBeVisible();
  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await expect(alert(page)).toHaveText("Couldn't save to your account. Check your connection and try again.");
});

test('a second phone signs in from setup and loads what the first one saved', async ({ page, browser }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const data = await mockSupabaseData(page);
  await completeSetup(page);
  const homeA = (await page.getByRole('region', { name: 'Left to spend this month', exact: true }).textContent()) ?? '';

  await page.goto('/settings/account');
  await signIn(page, EMAIL, PASSWORD);
  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await expect(saveSection(page).getByText('Saved to your account:', { exact: false })).toBeVisible();

  // Phone B: a new browser with nothing on it, sharing the account, on the same day as phone A.
  const phoneB = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageB = await phoneB.newPage();
  await pageB.clock.setFixedTime(SETUP_DAY);
  await mockFrankfurter(pageB);
  await mockSupabaseAuth(pageB, { [EMAIL]: PASSWORD });
  await mockSupabaseData(pageB, { tables: data });

  await pageB.goto('/setup');
  await pageB.getByRole('link', { name: 'Sign in to load it', exact: true }).click();
  await expect(pageB).toHaveURL('/settings/account');
  await signIn(pageB, EMAIL, PASSWORD);

  // Without a plan, loading comes first.
  const loadSection = pageB.getByRole('region', { name: 'Load from your account', exact: true });
  await expect(loadSection).toBeVisible();
  const headings = await pageB.getByRole('main').getByRole('heading', { level: 3 }).allTextContents();
  expect(headings.slice(1)).toEqual(['Load from your account', 'Save to your account']);
  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(
    loadSection.getByText("This replaces the data on this phone with your account's: 3 accounts, 0 entries and your plan."),
  ).toBeVisible();
  await loadSection.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(
    loadSection.getByText('Loaded from your account: 3 accounts, 0 entries and your plan.', { exact: true }),
  ).toBeVisible();
  expect(await overflow(pageB)).toBeLessThanOrEqual(0);

  // Phone B now holds phone A's data, and Home says the same.
  const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  expect(sorted(await readStore<Account>(pageB, 'accounts'))).toEqual(sorted(await readStore<Account>(page, 'accounts')));
  expect(await readStore<Plan>(pageB, 'plan')).toEqual(await readStore<Plan>(page, 'plan'));
  await pageB.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(pageB.getByRole('region', { name: 'Left to spend this month', exact: true })).toHaveText(homeA);
  await phoneB.close();
});

test('loading from an empty account, or one with rows the app cannot read, leaves the phone as it was', async ({
  page,
}) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const data = await mockSupabaseData(page);
  await completeSetup(page);
  const planBefore = await readStore<Plan>(page, 'plan');

  await page.goto('/settings/account');
  await signIn(page, EMAIL, PASSWORD);
  const loadSection = page.getByRole('region', { name: 'Load from your account', exact: true });
  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(loadSection.getByText('Your account has nothing saved yet.', { exact: true })).toBeVisible();

  // Rows without a plan: a first save that stopped halfway.
  data.set('entries', new Map([['e1', { id: 'e1' }]]));
  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(alert(page)).toHaveText(
    "Your account's last save didn't finish, so nothing changed on this phone. Save again from the phone that has your data.",
  );

  // A plan, but a row that isn't the app's data.
  data.set('plans', new Map([['current', planBefore[0]]]));
  data.set('entries', new Map([['e1', { id: 'e1', amountMinor: 'not money' }]]));
  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(alert(page)).toHaveText("Your account's data couldn't be read, so nothing changed on this phone.");

  // The account's server fails.
  await page.unroute(SUPABASE_REST);
  await mockSupabaseData(page, { failWith: 500 });
  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(alert(page)).toHaveText("Couldn't load from your account. Check your connection and try again.");
  expect(await readStore<Plan>(page, 'plan')).toEqual(planBefore);
});

test("loading onto a phone with its own data replaces it with the account's, after asking", async ({ page, browser }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const data = await mockSupabaseData(page);
  await completeSetup(page);
  await page.goto('/settings/account');
  await signIn(page, EMAIL, PASSWORD);
  await saveSection(page).getByRole('button', { name: 'Save to my account', exact: true }).click();
  await expect(saveSection(page).getByText('Saved to your account:', { exact: false })).toBeVisible();
  const planA = await readStore<Plan>(page, 'plan');

  // Phone B was set up on its own, with another rent.
  const phoneB = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageB = await phoneB.newPage();
  await mockSupabaseAuth(pageB, { [EMAIL]: PASSWORD });
  await mockSupabaseData(pageB, { tables: data });
  await completeSetup(pageB, { rent: '520' });
  expect(await readStore<Plan>(pageB, 'plan')).not.toEqual(planA);

  await pageB.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings', exact: true }).click();
  await pageB.getByRole('region', { name: 'Your account', exact: true }).getByRole('link', { name: 'Sign in' }).click();
  await signIn(pageB, EMAIL, PASSWORD);
  // With a plan, saving comes first and loading second.
  const loadSection = pageB.getByRole('region', { name: 'Load from your account', exact: true });
  await expect(loadSection).toBeVisible();
  const headings = await pageB.getByRole('main').getByRole('heading', { level: 3 }).allTextContents();
  expect(headings.slice(1)).toEqual(['Save to your account', 'Load from your account']);

  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(
    loadSection.getByText("This replaces the data on this phone with your account's:", { exact: false }),
  ).toBeVisible();
  await loadSection.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(loadSection.getByRole('button', { name: 'Load from my account', exact: true })).toBeFocused();
  expect(await readStore<Plan>(pageB, 'plan')).not.toEqual(planA);

  await loadSection.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await loadSection.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(loadSection.getByText('Loaded from your account:', { exact: false })).toBeVisible();
  expect(await readStore<Plan>(pageB, 'plan')).toEqual(planA);
  await phoneB.close();
});
