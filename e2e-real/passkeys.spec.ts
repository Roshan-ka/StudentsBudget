import type { Page } from '@playwright/test';
import { openApp } from '../e2e/helpers/app';
import { acceptPrivacyNotes } from '../e2e/helpers/privacy';
import { addVirtualAuthenticator, signOut } from '../e2e/helpers/supabase';
import type { TestUser } from './adapter';
import { expect, signedInAs, signIn, test } from './fixtures';

// Journey 2, passkeys (P2.3b) against the real WebAuthn check. The page's origin must be one the stack lists
// (supabase/config.toml rp_origins: http://localhost:3210, the real config's fixed port).
const VIRTUAL_ONLY = 'Makes or uses a passkey: needs a virtual authenticator, which only Chromium has.';

function passkeys(page: Page) {
  return page.getByRole('region', { name: 'Passkeys', exact: true });
}

/** Signs in with the password and adds a passkey in Settings, held by Chrome's virtual authenticator. */
async function signInAndAddPasskey(page: Page, user: TestUser) {
  await acceptPrivacyNotes(page);
  await addVirtualAuthenticator(page);
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(signedInAs(page, user.email)).toBeVisible();
  await passkeys(page).getByRole('button', { name: 'Add a passkey', exact: true }).click();
  await expect(passkeys(page).getByRole('status')).toHaveText('Passkey added.');
}

test('a passkey added in Settings signs in instead of the password', async ({ page, browserName, makeUser }) => {
  test.skip(browserName !== 'chromium', VIRTUAL_ONLY);
  const user = await makeUser({ secondFactor: 'none' });
  await signInAndAddPasskey(page, user);

  await signOut(page);
  await openApp(page, '/settings/account');
  await page.getByRole('button', { name: 'Sign in with a passkey', exact: true }).click();
  await expect(signedInAs(page, user.email)).toBeVisible(); // proof: passkey-signs-in
});

test('a removed passkey no longer signs in', async ({ page, browserName, makeUser }) => {
  test.skip(browserName !== 'chromium', VIRTUAL_ONLY);
  const user = await makeUser({ secondFactor: 'none' });
  await signInAndAddPasskey(page, user);
  await passkeys(page).getByRole('button', { name: /^Remove Passkey, added / }).click();
  await passkeys(page).getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(passkeys(page).getByRole('status')).toHaveText('Passkey removed.');

  // The virtual authenticator still holds it, but the account no longer takes it.
  await signOut(page);
  await openApp(page, '/settings/account');
  await page.getByRole('button', { name: 'Sign in with a passkey', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('That passkey didn’t work. Try again, or sign in with your email and password.'); // proof: removed-passkey
  await expect(signedInAs(page, user.email)).toHaveCount(0);
});
