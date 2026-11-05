import { expect, test, type Page } from '@playwright/test';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { MESSAGES } from '../src/i18n/messages';
import {
  addVirtualAuthenticator,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthCall,
} from './helpers/supabase';

// The one-time data-protection notes (docs/superpowers/plans/2026-11-05-privacy-notes.md) before the first account and
// the first passkey on a phone: Cancel sends nothing, Continue goes on, and the phone isn't asked again. Supabase Auth is
// mocked. The mic's note is tested in dictation.spec.ts.

test.use({ viewport: { width: 375, height: 812 } });

// Signing in links the phone to the account (P2.2), which reads the account's tables: an empty account.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

const EMAIL = 'new@example.com';
const PASSWORD = 'correct horse';
const EN = MESSAGES.en.auth;

function note(page: Page, label = EN.privacy.label) {
  return page.getByRole('group', { name: label, exact: true });
}

async function fillNewAccount(page: Page, email: string, words = EN.signIn) {
  await page.getByRole('button', { name: words.toCreate, exact: true }).click();
  await page.getByRole('textbox', { name: words.email, exact: true }).fill(email);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(words.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: words.create, exact: true }).click();
}

const signUps = (calls: AuthCall[]) => calls.filter((c) => c.path === '/signup');

function noteFlag(page: Page, key: string) {
  return page.evaluate((name) => localStorage.getItem(name), key);
}

test('the first account on a phone waits for the note on where its data is kept', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page);
  await fillNewAccount(page, EMAIL);

  // Cancel: nothing is sent, and the form is back.
  await expect(note(page)).toContainText(EN.privacy.account);
  await note(page).getByRole('button', { name: EN.privacy.cancel, exact: true }).click();
  await expect(note(page)).toHaveCount(0);
  expect(signUps(calls)).toHaveLength(0);
  expect(await noteFlag(page, PRIVACY_NOTES.account)).toBeNull();

  // Continue: the account is made.
  await page.getByRole('button', { name: EN.signIn.create, exact: true }).click();
  await note(page).getByRole('button', { name: EN.privacy.continue, exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  expect(signUps(calls)).toHaveLength(1);
  expect(await noteFlag(page, PRIVACY_NOTES.account)).toBe('seen');

  // The next account on this phone goes straight on.
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await fillNewAccount(page, 'other@example.com');
  await expect.poll(() => signUps(calls).length).toBe(2);
  await expect(note(page)).toHaveCount(0);
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the account note speaks German', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    const calls = await mockSupabaseAuth(page);
    const de = MESSAGES.de.auth;
    await fillNewAccount(page, EMAIL, de.signIn);

    await expect(note(page, de.privacy.label)).toContainText(de.privacy.account);
    await note(page, de.privacy.label).getByRole('button', { name: de.privacy.continue, exact: true }).click();
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();
    expect(signUps(calls)).toHaveLength(1);
  });
});

test('the first passkey on a phone waits for the note on where it is kept', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Makes a passkey: needs a virtual authenticator, which only Chromium has.');
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await addVirtualAuthenticator(page);
  await page.goto('/settings/account');
  await page.getByRole('textbox', { name: EN.signIn.email, exact: true }).fill(EMAIL);
  await page.getByLabel(EN.signIn.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: EN.signIn.signIn, exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  const passkeys = page.getByRole('region', { name: EN.passkeys.heading, exact: true });
  const add = passkeys.getByRole('button', { name: EN.passkeys.add, exact: true });
  const registrations = () => calls.filter((c) => c.path.startsWith('/passkeys/registration'));

  // Cancel: no passkey is made, and the focus is back on Add.
  await add.click();
  await expect(note(page)).toContainText(EN.privacy.passkey);
  await note(page).getByRole('button', { name: EN.privacy.cancel, exact: true }).click();
  await expect(add).toBeFocused();
  expect(registrations()).toHaveLength(0);

  // Continue: the passkey is added straight away, and the phone isn't asked again.
  await add.click();
  await note(page).getByRole('button', { name: EN.privacy.continue, exact: true }).click();
  await expect(passkeys.getByRole('listitem')).toHaveCount(1);
  expect(await noteFlag(page, PRIVACY_NOTES.passkey)).toBe('seen');
});
