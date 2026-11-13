import { expect, test, type Page } from '@playwright/test';
import type { Plan, Profile } from '../src/db/types';
import { MESSAGES } from '../src/i18n/messages';
import { openApp, waitForApp, waitForHome } from './helpers/app';
import { acceptPrivacyNotes } from './helpers/privacy';
import { seedSetup } from './helpers/seed-setup';
import { fillSetup, readStore, SETUP_DAY } from './helpers/setup';
import {
  E2E_EMAIL_CODE,
  mockSupabaseAuth,
  mockSupabaseData,
  signOut,
  skipUnlessAccountsShow,
  SUPABASE_REST,
} from './helpers/supabase';

// The start page (06-11-2026; redesigned 13-11-2026): a phone with no plan and nobody signed in chooses "Create an
// account", "I have an account" or "Continue without an account", and signing out syncs, clears the phone and ends
// there. The language is the globe in the header. Supabase is mocked: the configs point the app at a project that never
// resolves.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

test.beforeEach(async ({ page }) => {
  // The notes before the first account has their own spec (privacy-notes.spec.ts).
  await acceptPrivacyNotes(page);
});

function startHeading(page: Page) {
  return page.getByRole('heading', { level: 2, name: 'Welcome', exact: true });
}

function syncRegion(page: Page) {
  return page.getByRole('region', { name: 'Sync', exact: true });
}

/** The sign-in form, wherever it shows: on the start page it goes on by itself once signed in. */
async function fillSignIn(page: Page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Renames the profile in Settings: a change this phone records, to be sent with the next sync. */
async function renameProfile(page: Page, name: string) {
  await page.goto('/settings/profile');
  const profile = page.getByRole('region', { name: 'Profile', exact: true });
  await profile.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
  await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(profile.getByText('Profile saved.', { exact: true })).toBeVisible();
}

/** A seeded phone, signed in on Settings → Your account: linked, its data in the account. */
async function linkedPhone(page: Page) {
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await openApp(page, '/settings/account');
  await fillSignIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  return account;
}

test('a first visit offers an account or the guest way, and each leads on', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await page.goto('/');
  await expect(page).toHaveURL('/start');
  await expect(startHeading(page)).toBeVisible();
  // No line about signing out: nobody did.
  await expect(page.getByText("You're signed out. Your data was removed from this phone.")).toHaveCount(0);

  // What the app is and does, then the three ways on.
  await expect(page.getByText('Your money, sorted for student life.', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveText([
    'Plan your month',
    'Log spending in seconds',
    'Know your weekly budget',
    'Local tips with sources',
  ]);
  await expect(page.getByRole('link', { name: 'Create an account', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'I have an account', exact: true })).toBeVisible();

  // Sign in, and back.
  await page.getByRole('link', { name: 'I have an account', exact: true }).click();
  await expect(page).toHaveURL('/start/sign-in');
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL('/start');

  // Create an account opens on the sign-up form.
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page).toHaveURL('/start/new-account');
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back', exact: true }).click();

  // The guest goes on to setup, and Home keeps sending a phone without a plan there.
  await page.getByRole('link', { name: 'Continue without an account', exact: true }).click();
  await expect(page).toHaveURL('/setup');
  await expect(page.getByRole('heading', { level: 3, name: 'Accounts' })).toBeVisible();
  // The globe follows on to setup (13-11-2026), where the language select was.
  await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveCount(0);
});

test('the sign-in and new-account pages lead to each other, and the password can be shown', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await openApp(page, '/start/sign-in');
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();

  // What is typed can be shown and hidden again; the button says what a tap does now.
  const password = page.getByLabel('Password', { exact: true });
  await password.fill(PASSWORD);
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');

  // The other form is the other page, its fields in two named groups.
  await page.getByRole('link', { name: 'New here? Create an account', exact: true }).click();
  await expect(page).toHaveURL('/start/new-account');
  await expect(page.getByRole('heading', { level: 3, name: 'Create your account', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Sign-in details', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your name on posts', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Have an account? Sign in', exact: true }).click();
  await expect(page).toHaveURL('/start/sign-in');
});

test('the globe in the header picks the language, and the choice stays after a reload', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await openApp(page, '/start');
  const de = MESSAGES.de;

  await page.getByRole('button', { name: 'Language', exact: true }).click();
  // Each language in its own name, the phone's checked.
  await expect(page.getByRole('menuitemradio')).toHaveText(['English', 'Deutsch', 'Français', 'Español']);
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: 'Deutsch', exact: true }).click();

  // The menu closes, and the page is German at once.
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByText(de.account.start.headline, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: de.account.start.create, exact: true })).toBeVisible();

  // Kept on this phone.
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText(de.account.start.headline, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: de.language.label, exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Deutsch', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('a new account is created from the start page, set up next, and its plan saved to the account', async ({
  page,
}) => {
  await skipUnlessAccountsShow(page);
  await page.clock.setFixedTime(SETUP_DAY);
  await mockSupabaseAuth(page, {}, { confirmations: true });
  const account = await mockSupabaseData(page);

  await openApp(page, '/start');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page).toHaveURL('/start/new-account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('new_user');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // The emailed code, then an empty account: setup follows.
  await page.getByRole('textbox', { name: '6-digit code', exact: true }).fill(E2E_EMAIL_CODE);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page).toHaveURL('/setup');

  // Saving the plan on the linked phone sends it to the account without a Sync now.
  await fillSetup(page);
  await page.getByRole('button', { name: 'Save plan' }).click();
  await waitForHome(page);
  await expect.poll(() => account.get('plans')?.get('current') ?? null).not.toBeNull();
});

test('signing out clears the phone and opens the start page; signing in there brings the data back', async ({
  page,
}) => {
  // A seeded phone, a sign-in with its sync, the sign-out's sync, then a sign-in that downloads it all.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const account = await linkedPhone(page);
  await renameProfile(page, 'Changed before signing out');

  await page.goto('/settings/account');
  // Cancel leaves everything as it was.
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Sign out of this phone?', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Sign out of this phone?', { exact: true })).toHaveCount(0);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  await signOut(page);
  // The last change reached the account before the phone was cleared.
  expect((account.get('profiles')?.get('current') as Profile | undefined)?.name).toBe('Changed before signing out');
  await expect(
    page.getByRole('status').filter({ hasText: "You're signed out. Your data was removed from this phone." }),
  ).toBeVisible();
  await expect(startHeading(page)).toBeVisible();
  expect(await readStore<Plan>(page, 'plan')).toEqual([]);
  expect(await readStore(page, 'syncState')).toEqual([]);

  // The line goes once a way is picked; the account's data comes down and Home opens.
  await page.getByRole('link', { name: 'I have an account', exact: true }).click();
  await expect(page).toHaveURL('/start/sign-in');
  await fillSignIn(page);
  await waitForHome(page);
  expect(await readStore<Plan>(page, 'plan')).toHaveLength(1);
  expect((await readStore<Profile>(page, 'profile'))[0]?.name).toBe('Changed before signing out');

  // A plan on the phone: the start page goes on to Home.
  await page.goto('/start');
  await waitForHome(page);
});

test('when the last sync can’t send everything, signing out asks first', async ({ page, context }) => {
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const account = await linkedPhone(page);
  // The account refuses from before the change: the phone's automatic sync (on opening, and after the change) can't
  // send it either, so it waits (automatic sync, docs/superpowers/plans/2026-11-10-automatic-sync.md).
  await page.route(SUPABASE_REST, (route) => route.abort());
  await renameProfile(page, 'Not in the account');
  await openApp(page, '/settings/account');

  // Offline: the change waits, and staying signed in keeps it.
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  // The rename, and whatever else the phone wrote since the last sync.
  await expect(page.getByText(/^\d+ changes? (isn't|aren't) in your account yet\.$/)).toBeFocused();
  await expect(
    page.getByText("You're offline. Stay signed in and sync later, or sign out and lose these changes.", { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Stay signed in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  expect((await readStore<Profile>(page, 'profile'))[0]?.name).toBe('Not in the account');
  await context.setOffline(false);

  // Online, but the account refuses it (the route above): signing out anyway loses the change.
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByText("They couldn't be sent. Stay signed in and sync later, or sign out and lose these changes.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out and lose them', exact: true }).click();
  await expect(page).toHaveURL('/start');
  await expect(startHeading(page)).toBeVisible();
  expect((account.get('profiles')?.get('current') as Profile | undefined)?.name).not.toBe('Not in the account');
  expect(await readStore<Plan>(page, 'plan')).toEqual([]);
});
