import { expect, test, type Browser, type Page, type Route } from '@playwright/test';
import { completeSetup } from './helpers/setup';
import {
  E2E_TOTP_CODE,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  SUPABASE_REST,
  type AuthCall,
  type AuthFactors,
} from './helpers/supabase';

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

function restartNote(page: Page) {
  return twoStep(page).getByText('This starts the set-up again.', { exact: false });
}

/** Phone B: a new browser on the same account, which turns two-step sign-in on there. */
async function turnOnFromAnotherPhone(browser: Browser, factors: AuthFactors) {
  const phoneB = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageB = await phoneB.newPage();
  await mockSupabaseAuth(pageB, { [EMAIL]: PASSWORD }, { factors });
  await signInAndTurnOn(pageB);
  await phoneB.close();
}

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

  // Left open: the page reloads mid-way, and the next Turn on clears the old set-up before it starts again, saying so.
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  await expect(restartNote(page)).toHaveCount(0);
  await page.reload();
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  await expect(restartNote(page)).toBeVisible();
  expect(removed(calls)).toHaveLength(2);
  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
});

test('leaving the page mid set-up and coming back keeps the set-up', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.goto('/settings/account');
  await signIn(page);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();

  // Off to setup and back: the router keeps the account page mounted but hidden, and reads the account again.
  await page.getByRole('link', { name: 'Set up this phone', exact: true }).click();
  await expect(page).toHaveURL('/setup');
  await page.goBack();
  await expect(page).toHaveURL('/settings/account');
  await expect(codeField(page)).toBeVisible();
  await expect(twoStep(page).getByText('JBSW Y3DP EHPK 3PXP', { exact: true })).toBeVisible();
  expect(removed(calls)).toHaveLength(0);

  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
});

test('when the account can’t be checked, it says so instead of "Off", and Try again checks once more', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);

  // The next read of the account's authenticators doesn't reach the server.
  const unreachable = (route: Route) => route.abort();
  await page.route('**/auth/v1/user', unreachable);
  await page.reload();
  await expect(twoStep(page).getByText('Couldn\'t check whether two-step sign-in is on.', { exact: true })).toBeVisible();
  await expect(twoStep(page).getByRole('button', { name: 'Turn on', exact: true })).toHaveCount(0);
  await expect(alert(page)).toHaveText("The account server can't be reached. Check your connection and try again.");

  await page.unroute('**/auth/v1/user', unreachable);
  await twoStep(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(twoStep(page).getByText('On: signing in asks for the code from your authenticator app.')).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
});

test('a phone signed in before another turned it on asks for the code on Load, not "nothing saved"', async ({ page, browser }) => {
  // Two phones: WebKit needs more than the default 30 s.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const factors: AuthFactors = new Map();
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await mockSupabaseData(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  await turnOnFromAnotherPhone(browser, factors);

  // Phone A still holds its password-only session, so the account shows it nothing: the code step takes over.
  await page.getByRole('button', { name: 'Load from my account', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  await expect(page.getByText('Your account has nothing saved yet.', { exact: true })).toHaveCount(0);
  await codeField(page).fill(E2E_TOTP_CODE);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load from my account', exact: true })).toBeVisible();
});

test('a phone signed in before another turned it on asks for the code on Save, not "couldn’t take"', async ({ page, browser }) => {
  // Two phones, the first set up in full: WebKit needs more than the default 30 s.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const factors: AuthFactors = new Map();
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await mockSupabaseData(page);
  await completeSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  await turnOnFromAnotherPhone(browser, factors);

  // Row-level security now refuses this session's rows, as the database does (Postgres insufficient_privilege).
  await page.route(SUPABASE_REST, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 403,
          headers: { 'access-control-allow-origin': '*' },
          json: { code: '42501', message: 'new row violates row-level security policy' },
        })
      : route.fallback(),
  );
  await page.getByRole('button', { name: 'Save to my account', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
});
