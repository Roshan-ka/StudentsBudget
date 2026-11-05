import { expect, test, type Page } from '@playwright/test';
import { acceptPrivacyNotes } from './helpers/privacy';
import {
  e2eUserIdOf,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthCall,
  type ServerProfiles,
} from './helpers/supabase';

// The name a student posts under (the hacks feed, chunk 2; docs/superpowers/plans/2026-11-05-hacks-feed.md): sign-up
// asks for a unique @username, a label and an optional batch, and Your account shows and changes them. Supabase is
// mocked: `profiles` holds the accounts' names, and the sign-up trigger that makes one from the sign-up isn't played.

test.use({ viewport: { width: 375, height: 812 } });

// The account note before the first sign-up has its own spec (privacy-notes.spec.ts).
test.beforeEach(async ({ page }) => {
  await acceptPrivacyNotes(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const OTHER = 'dana@example.com';

/** The form's message. Inside main: Next's route announcer is an alert of its own, outside it. */
function alert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function username(page: Page, label = 'Username') {
  return page.getByRole('textbox', { name: label, exact: true });
}

function card(page: Page, heading = 'Your name on posts') {
  return page.getByRole('region', { name: heading, exact: true });
}

const signUps = (calls: AuthCall[]) => calls.filter((c) => c.path === '/signup');

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

test('sign-up asks for a username, checks it, and sends it with the label and batch', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { profiles: new Map([[e2eUserIdOf(OTHER), { username: 'dana', label: null, batch: null }]]) });
  const calls = await mockSupabaseAuth(page);
  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  const create = page.getByRole('button', { name: 'Create account', exact: true });

  // Checked on the phone first: nothing is sent.
  await create.click();
  await expect(alert(page)).toHaveText('Enter a username.');
  await username(page).fill('ro');
  await create.click();
  await expect(alert(page)).toHaveText('Use at least 3 characters for the username.');
  await username(page).fill('ro-shan');
  await create.click();
  await expect(alert(page)).toHaveText('Use only letters a–z, digits and _ in the username.');
  await username(page).fill('roshan');
  await page.getByRole('textbox', { name: 'Batch (optional)', exact: true }).fill('27');
  await create.click();
  await expect(alert(page)).toHaveText('Enter the batch as a year, like 2027.');
  expect(signUps(calls)).toHaveLength(0);

  // A name someone has is said before the account exists. The field keeps what is typed in lower case.
  await username(page).fill('Dana');
  await expect(username(page)).toHaveValue('dana');
  await page.getByRole('textbox', { name: 'Batch (optional)', exact: true }).fill('2027');
  await create.click();
  await expect(alert(page)).toHaveText('That username is taken. Pick another.');
  expect(signUps(calls)).toHaveLength(0);

  // A free name: the account is made with the language, the name, the label and the batch.
  await username(page).fill('roshan');
  await page.getByRole('combobox', { name: 'You are', exact: true }).selectOption({ label: 'Graduate' });
  await create.click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  expect(signUps(calls)).toHaveLength(1);
  expect(signUps(calls)[0].body).toMatchObject({
    data: { lang: 'en', username: 'roshan', label: 'graduate', batch: 2027 },
  });
});

test('a username that cannot be checked stops the sign-up', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page, { failWith: 500 });
  const calls = await mockSupabaseAuth(page);
  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await username(page).fill('roshan');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(alert(page)).toHaveText("The username couldn't be checked. Check your connection and try again.");
  expect(signUps(calls)).toHaveLength(0);
});

test('Your account shows the name others see, and changes it', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const profiles: ServerProfiles = new Map([
    [e2eUserIdOf(EMAIL), { username: 'roshan', label: 'student', batch: 2027 }],
    [e2eUserIdOf(OTHER), { username: 'dana', label: null, batch: null }],
  ]);
  await mockSupabaseData(page, { profiles });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);

  await expect(card(page)).toContainText("@roshan · Student · Batch '27");
  await card(page).getByRole('button', { name: 'Change', exact: true }).click();
  await expect(username(page)).toHaveValue('roshan');

  // Someone else's name is refused, as the database refuses it.
  await username(page).fill('dana');
  await card(page).getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(card(page).getByRole('alert')).toHaveText('That username is taken. Pick another.');

  await username(page).fill('roshan_k');
  await card(page).getByRole('combobox', { name: 'You are', exact: true }).selectOption({ label: 'Alumni' });
  await card(page).getByRole('textbox', { name: 'Batch (optional)', exact: true }).fill('');
  await card(page).getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(card(page).getByRole('status')).toHaveText('Name saved.');
  await expect(card(page)).toContainText('@roshan_k · Alumni');
  await expect(card(page).getByRole('button', { name: 'Change', exact: true })).toBeFocused();
  expect(profiles.get(e2eUserIdOf(EMAIL))).toEqual({ username: 'roshan_k', label: 'alumni', batch: null });
});

test('an account without a name yet picks one', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const profiles: ServerProfiles = new Map();
  await mockSupabaseData(page, { profiles });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);

  await expect(card(page)).toContainText('No name yet. Pick one now, or before your first post.');
  await card(page).getByRole('button', { name: 'Pick a name', exact: true }).click();
  await username(page).fill('roshan');
  await card(page).getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(card(page)).toContainText('@roshan · Student');
  expect(profiles.get(e2eUserIdOf(EMAIL))).toEqual({ username: 'roshan', label: 'student', batch: null });
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the name others see, in German', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    await mockSupabaseData(page, {
      profiles: new Map([[e2eUserIdOf(EMAIL), { username: 'roshan', label: 'graduate', batch: 2026 }]]),
    });
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await page.getByRole('textbox', { name: 'E-Mail', exact: true }).fill(EMAIL);
    await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

    await expect(card(page, 'Dein Name bei Beiträgen')).toContainText('@roshan · Mit Abschluss · Jahrgang 2026');
  });
});
