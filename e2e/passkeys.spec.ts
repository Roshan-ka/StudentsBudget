import { expect, test, type Page, type Route } from '@playwright/test';
import {
  addVirtualAuthenticator,
  E2E_TOTP_CODE,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthCall,
} from './helpers/supabase';

// Passkeys (P2.3b) at 375 px. Supabase Auth is mocked. Where a test makes or uses a passkey, Chrome's virtual
// authenticator plays the phone that keeps it and says yes, as Face ID would: those run on Chromium only. The others
// run wherever the browser has passkeys.
test.use({ viewport: { width: 375, height: 812 } });

// Signing in links the phone to the account (P2.2), which reads the account's tables: an empty account by default.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

const VIRTUAL_ONLY = 'Makes or uses a passkey: needs a virtual authenticator, which only Chromium has.';

/** Skips a test that needs no virtual authenticator where the browser has no passkeys at all. */
async function skipUnlessPasskeys(page: Page) {
  const supported = await page.evaluate(() => typeof window.PublicKeyCredential === 'function');
  test.skip(!supported, 'This browser has no passkeys (WebAuthn).');
}

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

/** The message on the page. Inside main: Next's route announcer is an alert of its own, outside it. */
function alert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function passkeys(page: Page) {
  return page.getByRole('region', { name: 'Passkeys', exact: true });
}

function passkeyButton(page: Page) {
  return page.getByRole('button', { name: 'Sign in with a passkey', exact: true });
}

const removed = (calls: AuthCall[]) => calls.filter((c) => c.method === 'DELETE' && c.path.startsWith('/passkeys/'));

/** Today as the app writes a full date: "29-10-2026". */
function today(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
}

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

test('a passkey added in Settings signs in instead of the password, and stops when removed', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', VIRTUAL_ONLY);
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await addVirtualAuthenticator(page);
  await page.goto('/settings/account');
  await signIn(page);

  const add = passkeys(page).getByRole('button', { name: 'Add a passkey', exact: true });
  await add.click();
  const item = passkeys(page).getByRole('listitem');
  await expect(item).toHaveCount(1);
  await expect(item.getByText('Passkey', { exact: true })).toBeVisible();
  // With the time, so two passkeys added the same day can be told apart.
  await expect(item.getByText(new RegExp(`^Added ${today()}, \\d{2}:\\d{2}$`))).toBeVisible();
  await expect(passkeys(page).getByRole('status')).toHaveText('Passkey added.');
  await expect(add).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // No email, no password: the device's passkey is enough.
  await signOut(page);
  await passkeyButton(page).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(item.getByText(new RegExp(`^Added ${today()}, \\d{2}:\\d{2}; last used ${today()}$`))).toBeVisible();

  // Removing asks first, and Cancel keeps it.
  const remove = passkeys(page).getByRole('button', { name: new RegExp(`^Remove Passkey, added ${today()}, \\d{2}:\\d{2}$`) });
  await remove.click();
  await expect(passkeys(page).getByText('Remove this passkey?', { exact: false })).toBeVisible();
  const confirm = passkeys(page).getByRole('button', { name: 'Remove', exact: true });
  await expect(confirm).toBeFocused();
  await passkeys(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(remove).toBeFocused();
  await expect(item).toHaveCount(1);
  expect(removed(calls)).toHaveLength(0);

  await remove.click();
  await confirm.click();
  await expect(item).toHaveCount(0);
  expect(removed(calls)).toHaveLength(1);
  await expect(passkeys(page).getByRole('status')).toHaveText('Passkey removed.');
  await expect(add).toBeFocused();

  // The device still holds it, but the account no longer takes it.
  await signOut(page);
  await passkeyButton(page).click();
  await expect(alert(page)).toHaveText('That passkey didn’t work. Try again, or sign in with your email and password.');
});

test('with two-step sign-in on, a passkey stands in for the password, not for the code', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', VIRTUAL_ONLY);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await addVirtualAuthenticator(page);
  await page.goto('/settings/account');
  await signIn(page);

  const twoStep = page.getByRole('region', { name: 'Two-step sign-in', exact: true });
  const code = page.getByRole('textbox', { name: '6-digit code', exact: true });
  await twoStep.getByRole('button', { name: 'Turn on', exact: true }).click();
  await code.fill(E2E_TOTP_CODE);
  await twoStep.getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep.getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
  await passkeys(page).getByRole('button', { name: 'Add a passkey', exact: true }).click();
  await expect(passkeys(page).getByRole('listitem')).toHaveCount(1);

  await signOut(page);
  await passkeyButton(page).click();
  await expect(page.getByText(`Enter the code from your authenticator app for ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sync', exact: true })).toHaveCount(0);
  await code.fill(E2E_TOTP_CODE);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
});

test('a passkey prompt closed without a passkey says nothing, and the password still works', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  // As when the person taps Cancel, or the device holds no passkey for this site.
  await page.addInitScript(() => {
    navigator.credentials.get = () =>
      Promise.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError'));
  });
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.goto('/settings/account');
  await skipUnlessPasskeys(page);

  await passkeyButton(page).click();
  // The sign-in really started (the account handed out a challenge), and ended in silence.
  await expect.poll(() => calls.some((c) => c.path === '/passkeys/authentication/options')).toBe(true);
  await expect(passkeyButton(page)).toBeEnabled();
  await expect(alert(page)).toHaveCount(0);
  await signIn(page);
});

test('creating an account offers no passkey: it belongs to an account that exists', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page);
  await page.goto('/settings/account');
  await skipUnlessPasskeys(page);
  await expect(passkeyButton(page)).toBeVisible();
  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await expect(passkeyButton(page)).toHaveCount(0);
});

test('the sign-in shows one message at a time, from the passkey or the password', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  // Passkeys switched off in the account server.
  await page.route('**/auth/v1/passkeys/authentication/options', (route: Route) =>
    route.request().method() === 'OPTIONS'
      ? route.fallback()
      : route.fulfill({
          status: 422,
          headers: { 'access-control-allow-origin': '*' },
          json: { error_code: 'passkey_disabled', msg: 'Passkeys are disabled' },
        }),
  );
  await page.goto('/settings/account');
  await skipUnlessPasskeys(page);

  await passkeyButton(page).click();
  await expect(alert(page)).toHaveText('Passkeys are switched off right now. Sign in with your email and password.');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(alert(page)).toHaveText('Email or password is wrong.');
});

test('passkeys that can’t be read say so, Try again reads them, and switched off shows no Add', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.goto('/settings/account');
  await skipUnlessPasskeys(page);
  const unreachable = (route: Route) => (route.request().method() === 'GET' ? route.abort() : route.fallback());
  await page.route('**/auth/v1/passkeys', unreachable);
  await signIn(page);

  await expect(passkeys(page).getByText("Couldn't load your passkeys.", { exact: true })).toBeVisible();
  await expect(passkeys(page).getByRole('button', { name: 'Add a passkey', exact: true })).toHaveCount(0);
  await page.unroute('**/auth/v1/passkeys', unreachable);
  await passkeys(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(passkeys(page).getByText('None yet', { exact: true })).toBeVisible();
  await expect(passkeys(page).getByRole('button', { name: 'Add a passkey', exact: true })).toBeFocused();

  // Switched off in the account server: said once, and nothing to add.
  await page.route('**/auth/v1/passkeys', (route: Route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 422,
          headers: { 'access-control-allow-origin': '*' },
          json: { error_code: 'passkey_disabled', msg: 'Passkeys are disabled' },
        })
      : route.fallback(),
  );
  await page.reload();
  await expect(passkeys(page).getByText('Passkeys are switched off right now.', { exact: true })).toBeVisible();
  await expect(passkeys(page).getByRole('button', { name: 'Add a passkey', exact: true })).toHaveCount(0);
  await expect(alert(page)).toHaveCount(0);
});
