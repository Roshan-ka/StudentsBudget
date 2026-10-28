import { expect, test, type Page } from '@playwright/test';
import { E2E_TOTP_CODE, mockSupabaseAuth, skipUnlessAccountsShow, type AuthCall } from './helpers/supabase';

// Two-step sign-in (P2.3a) at 375 px, the narrowest phone the app is made for. Supabase Auth is mocked, with an
// authenticator that accepts only E2E_TOTP_CODE.
test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

/** The message on the page. Inside main: Next's route announcer is an alert of its own, outside it. */
function alert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function twoStep(page: Page) {
  return page.getByRole('region', { name: 'Two-step sign-in', exact: true });
}

function codeField(page: Page) {
  return page.getByRole('textbox', { name: '6-digit code', exact: true });
}

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

/** Signs in and turns two-step sign-in on, with the authenticator's first code. */
async function signInAndTurnOn(page: Page) {
  await page.goto('/settings/account');
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(twoStep(page).getByText('Off.', { exact: false })).toBeVisible();
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
}

const removed = (calls: AuthCall[]) => calls.filter((c) => c.method === 'DELETE' && c.path.startsWith('/factors/'));

test('turning it on shows the ways to add the app, and takes only a right first code', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.goto('/settings/account');
  await signIn(page);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();

  // On the phone the app runs on, the link and the key; on another device, the QR code.
  const link = twoStep(page).getByRole('link', { name: 'Open in authenticator app', exact: true });
  await expect(link).toHaveAttribute('href', /^otpauth:\/\/totp\/StudentsBudget:/);
  await expect(twoStep(page).getByText('JBSW Y3DP EHPK 3PXP', { exact: true })).toBeVisible();
  const qr = twoStep(page).getByRole('img', { name: 'QR code for the authenticator app', exact: true });
  await expect(qr).toHaveAttribute('src', /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  await expect(twoStep(page).getByText('Keep the app.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await codeField(page).fill('12 34');
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(alert(page)).toHaveText('Enter the 6-digit code from your authenticator app.');

  await codeField(page).fill('000000');
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(alert(page)).toHaveText('That code didn’t work. Codes change every 30 seconds: enter the newest one.');

  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
});

test('with it on, signing in asks for the code before the account opens', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);
  await signOut(page);

  await signIn(page);
  await expect(page.getByText(`Enter the code from your authenticator app for ${EMAIL}.`, { exact: true })).toBeVisible();
  // Nothing of the account until the code: no save, no load.
  await expect(page.getByRole('button', { name: 'Save to my account', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load from my account', exact: true })).toHaveCount(0);

  await codeField(page).fill('000000');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(alert(page)).toHaveText('That code didn’t work. Codes change every 30 seconds: enter the newest one.');

  await codeField(page).fill(` ${E2E_TOTP_CODE.slice(0, 3)} ${E2E_TOTP_CODE.slice(3)} `);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
});

test('half signed in, the Settings card offers to finish, and a different account is a tap away', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);
  await signOut(page);
  await signIn(page);
  await expect(codeField(page)).toBeVisible();

  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Your account', exact: true });
  await expect(card.getByText(`${EMAIL}: the code from your authenticator app is still to come.`)).toBeVisible();
  await card.getByRole('link', { name: 'Finish signing in', exact: true }).click();
  await expect(codeField(page)).toBeVisible();

  await page.getByRole('button', { name: 'Use a different account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('turning it off asks first, and then the password alone opens the account', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);

  await twoStep(page).getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(twoStep(page).getByText('Turn off two-step sign-in? Your password alone will open your account again.')).toBeVisible();
  await twoStep(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
  expect(removed(calls)).toHaveLength(0);

  await twoStep(page).getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(twoStep(page).getByText('Turn off two-step sign-in?', { exact: false })).toBeVisible();
  await twoStep(page).getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(twoStep(page).getByText('Off.', { exact: false })).toBeVisible();
  expect(removed(calls)).toHaveLength(1);

  await signOut(page);
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
});

test('a set-up cancelled, or left open, never blocks the next one', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.goto('/settings/account');
  await signIn(page);

  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await twoStep(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(twoStep(page).getByText('Off.', { exact: false })).toBeVisible();
  expect(removed(calls)).toHaveLength(1);

  // Left open: the page reloads mid-way, and the next Turn on clears the old set-up before it starts again.
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  await page.reload();
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  expect(removed(calls)).toHaveLength(2);
  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
});
