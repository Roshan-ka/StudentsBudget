import { expect, test, type Page } from '@playwright/test';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type AuthCall } from './helpers/supabase';

// Change password (Settings → Your account → Sign-in and security → Password). Supabase Auth is mocked; its sessions
// carry how they signed in (`amr`), so after a password sign-in the card asks for the current password. The rule for
// other sign-ins (a passkey sets a new one without the old) is unit-tested (`asksCurrentPassword`).

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';
const NEW_PASSWORD = 'battery staple';

async function signIn(page: Page, password: string) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

const newPasswords = (calls: AuthCall[]) => calls.filter((c) => c.method === 'PUT' && c.path === '/user').map((c) => c.body);

test('after a password sign-in it asks for the current password, and the new one signs in', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseData(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page, PASSWORD);

  const card = page.getByRole('region', { name: 'Password', exact: true });
  await card.getByRole('button', { name: 'Change password', exact: true }).click();
  const current = card.getByLabel('Current password', { exact: true });
  const next = card.getByLabel('New password', { exact: true });
  const save = card.getByRole('button', { name: 'Save password', exact: true });

  await current.fill('not my password');
  await next.fill(NEW_PASSWORD);
  await save.click();
  await expect(card.getByRole('alert')).toHaveText("That isn't your current password.");
  expect(newPasswords(calls)).toEqual([]);

  await current.fill(PASSWORD);
  await next.fill(PASSWORD);
  await save.click();
  await expect(card.getByRole('alert')).toHaveText("That's your current password. Choose a different one.");

  await next.fill(NEW_PASSWORD);
  await save.click();
  await expect(card.getByText('Password changed.', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Change password', exact: true })).toBeVisible();
  expect(newPasswords(calls)).toEqual([
    expect.objectContaining({ password: PASSWORD }),
    expect.objectContaining({ password: NEW_PASSWORD }),
  ]);

  // The new password is the one that signs in now.
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signIn(page, NEW_PASSWORD);
});
