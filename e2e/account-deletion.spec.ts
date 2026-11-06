import { expect, test, type Page } from '@playwright/test';
import type { Plan } from '../src/db/types';
import { seedSetup } from './helpers/seed-setup';
import { readStore } from './helpers/setup';
import {
  E2E_TOTP_CODE,
  e2eUserIdOf,
  endSession,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthFactors,
} from './helpers/supabase';

// Deleting the account (P2.5, docs/superpowers/plans/2026-11-04-account-deletion.md): Settings → Your account →
// Delete my account. Supabase is mocked: `delete_my_account` empties the account's tables, and with `twoStep` only a
// session that gave the authenticator's code may call it. The real function is checked by pgTAP and
// src/features/account/account-deletion.contract.test.ts.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

const ENGLISH = {
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',
  signedIn: `Signed in as ${EMAIL}.`,
  card: 'Delete my account',
  word: 'Type DELETE to confirm',
  typed: 'DELETE',
  deleted: 'Your account is deleted. Everything on this phone stays.',
};

async function signIn(page: Page, words = ENGLISH, email = EMAIL) {
  await page.getByRole('textbox', { name: words.email, exact: true }).fill(email);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(words.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: words.signIn, exact: true }).click();
}

function card(page: Page, words = ENGLISH) {
  return page.getByRole('region', { name: words.card, exact: true });
}

/** Fills the card and presses its button. */
async function deleteWith(page: Page, password: string, words = ENGLISH) {
  await card(page, words).getByLabel(words.password, { exact: true }).fill(password);
  await card(page, words).getByRole('textbox', { name: words.word, exact: true }).fill(words.typed);
  await card(page, words).getByRole('button', { name: words.card, exact: true }).click();
}

/** Signing in links the phone (P2.2); deleting waits until that is done, as a person would. */
async function linked(page: Page) {
  await expect.poll(async () => (await readStore<{ userId: string | null }>(page, 'syncState'))[0]?.userId ?? null).toBeTruthy();
}

test('the account and its rows go, the phone keeps its data and unlinks', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const tables = await mockSupabaseData(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(page.getByText(ENGLISH.signedIn, { exact: true })).toBeVisible();
  await linked(page);
  // Linking sends the phone's plan to the empty account, a moment after it marks the phone linked.
  await expect.poll(() => tables.get('plans')?.size).toBe(1);

  // The button waits for the word, and a wrong password deletes nothing.
  const button = card(page).getByRole('button', { name: 'Delete my account', exact: true });
  await expect(button).toBeDisabled();
  await deleteWith(page, 'not my password');
  await expect(card(page).getByRole('alert')).toHaveText('Email or password is wrong.');
  expect(tables.get('plans')?.size).toBe(1);

  await deleteWith(page, PASSWORD);
  await expect(page.getByText(ENGLISH.deleted, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();
  expect(tables.size).toBe(0);
  // Unlinked, with nothing waiting for the account; the plan is still on the phone.
  expect(await readStore(page, 'syncState')).toEqual([]);
  expect(await readStore(page, 'outbox')).toEqual([]);
  expect(await readStore<Plan>(page, 'plan')).toHaveLength(1);
});

test('an account with two-step sign-in needs the authenticator’s code too', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const tables = await mockSupabaseData(page, { twoStep: true });
  const factors: AuthFactors = new Map([
    [EMAIL, [{ id: 'factor-owner', friendly_name: 'Owner phone', factor_type: 'totp', status: 'verified' } as const]],
  ]);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await signIn(page);
  await page.getByRole('textbox', { name: '6-digit code', exact: true }).fill(E2E_TOTP_CODE);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(ENGLISH.signedIn, { exact: true })).toBeVisible();
  await linked(page);

  // The card asks for the code, since this account has two-step sign-in.
  const code = card(page).getByRole('textbox', { name: '6-digit code', exact: true });
  await expect(code).toBeVisible();
  await deleteWith(page, PASSWORD);
  await expect(card(page).getByRole('alert')).toHaveText('Enter the 6-digit code from your authenticator app.');

  await code.fill(E2E_TOTP_CODE);
  await card(page).getByRole('button', { name: 'Delete my account', exact: true }).click();
  await expect(page.getByText(ENGLISH.deleted, { exact: true })).toBeVisible();
  expect(tables.size).toBe(0);
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('deleting the account speaks German, the typed word included', async ({ page }) => {
    const words = {
      email: 'E-Mail',
      password: 'Passwort',
      signIn: 'Anmelden',
      signedIn: `Angemeldet als ${EMAIL}.`,
      card: 'Mein Konto löschen',
      word: 'Gib zur Bestätigung LÖSCHEN ein',
      typed: 'LÖSCHEN',
      deleted: 'Dein Konto ist gelöscht. Alles auf diesem Handy bleibt.',
    };
    await skipUnlessAccountsShow(page);
    const tables = await mockSupabaseData(page);
    await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
    await signIn(page, words);
    await expect(page.getByText(words.signedIn, { exact: true })).toBeVisible();
    await linked(page);

    await deleteWith(page, PASSWORD, words);
    await expect(page.getByText(words.deleted, { exact: true })).toBeVisible();
    expect(tables.size).toBe(0);
  });
});

test('a phone linked to an account deleted elsewhere links to a new one instead of being blocked', async ({ page }) => {
  const other = 'new-account@example.com';
  await skipUnlessAccountsShow(page);
  const gone = new Set<string>();
  await mockSupabaseData(page, { gone });
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD, [other]: PASSWORD });
  await signIn(page);
  await expect(page.getByText(ENGLISH.signedIn, { exact: true })).toBeVisible();
  await linked(page);
  // The session runs out with the link kept (signing out would clear the phone and the link).
  await endSession(page);
  await expect(page.getByRole('heading', { level: 3, name: 'Sign in', exact: true })).toBeVisible();

  // The account is deleted on another phone; this one signs in to a new account.
  gone.add(e2eUserIdOf(EMAIL));
  await signIn(page, ENGLISH, other);
  await expect(page.getByText(`Signed in as ${other}.`, { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await readStore<{ userId: string | null }>(page, 'syncState'))[0]?.userId ?? null)
    .toBe(e2eUserIdOf(other));
});
