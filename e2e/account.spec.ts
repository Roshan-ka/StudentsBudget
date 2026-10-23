import { expect, test, type Page } from '@playwright/test';
import type { Plan } from '../src/db/types';
import { completeSetup, readStore } from './helpers/setup';
import { mockSupabaseAuth, skipUnlessAccountsShow, SUPABASE_AUTH } from './helpers/supabase';

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
