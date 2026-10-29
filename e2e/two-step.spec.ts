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

// Signing in links the phone to the account (P2.2), which reads the account's tables: an empty account by default.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

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
  await expect(twoStep(page).getByText('Turn it on and signing in', { exact: false })).toBeVisible();
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
}

const removed = (calls: AuthCall[]) => calls.filter((c) => c.method === 'DELETE' && c.path.startsWith('/factors/'));

function restartNote(page: Page) {
  return twoStep(page).getByText('This starts the set-up again.', { exact: false });
}

/** Unlinks this phone, as a phone signed in from before linking existed: its sync state goes, straight in IndexedDB. */
async function unlink(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('studentsbudget');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const transaction = open.result.transaction('syncState', 'readwrite');
          transaction.objectStore('syncState').clear();
          transaction.oncomplete = () => {
            open.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
  );
}

/** Phone B: a new browser on the same account, which turns two-step sign-in on there. */
async function turnOnFromAnotherPhone(browser: Browser, factors: AuthFactors) {
  const phoneB = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pageB = await phoneB.newPage();
  await mockSupabaseAuth(pageB, { [EMAIL]: PASSWORD }, { factors });
  await mockSupabaseData(pageB);
  await signInAndTurnOn(pageB);
  await phoneB.close();
}

test('turning it on shows the ways to add the app, and takes only a right first code', async ({ page, context }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await page.goto('/settings/account');
  await signIn(page);

  // Offline, nothing is tried, and the message says what needs the connection.
  await context.setOffline(true);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(alert(page)).toHaveText("You're offline. Turning two-step sign-in on or off needs a connection.");
  await context.setOffline(false);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();

  // On the phone the app runs on, the link (focused: the next step) and the key; on another device, the QR code.
  const link = twoStep(page).getByRole('link', { name: 'Open in authenticator app', exact: true });
  await expect(link).toBeFocused();
  // The entry is named StudentsBudget only because the app says so: the mock, like the account server, would name it
  // after the site's host.
  await expect(link).toHaveAttribute('href', /^otpauth:\/\/totp\/StudentsBudget:.*&issuer=StudentsBudget$/);
  await expect(twoStep(page).getByText('JBSW Y3DP EHPK 3PXP', { exact: true })).toBeVisible();
  const qr = twoStep(page).getByRole('img', { name: 'QR code for the authenticator app', exact: true });
  await expect(qr).toHaveAttribute('src', /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  await expect(twoStep(page).getByText('Write the key down and keep it somewhere safe', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await codeField(page).fill('12 34');
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(alert(page)).toHaveText('Enter the 6-digit code from your authenticator app.');

  await codeField(page).fill('000000');
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(alert(page)).toHaveText('That code didn’t work. Codes change every 30 seconds: enter the newest one.');

  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
  await expect(twoStep(page).getByRole('status')).toHaveText('Two-step sign-in is on.');
  await expect(twoStep(page).getByRole('button', { name: 'Turn off', exact: true })).toBeFocused();
});

test('with it on, signing in asks for the code before the account opens', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);
  await signOut(page);

  await signIn(page);
  await expect(page.getByText(`Enter the code from your authenticator app for ${EMAIL}.`, { exact: true })).toBeVisible();
  // Nothing of the account until the code: no linking, no sync.
  await expect(page.getByRole('region', { name: 'Sync', exact: true })).toHaveCount(0);
  await codeField(page).fill('000000');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(alert(page)).toHaveText('That code didn’t work. Codes change every 30 seconds: enter the newest one.');

  await codeField(page).fill(` ${E2E_TOTP_CODE.slice(0, 3)} ${E2E_TOTP_CODE.slice(3)} `);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
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
  await expect(card.getByText(`Almost signed in as ${EMAIL}: enter the code from your authenticator app.`)).toBeVisible();
  await card.getByRole('link', { name: 'Finish signing in', exact: true }).click();
  await expect(codeField(page)).toBeVisible();

  await page.getByRole('button', { name: 'Use a different account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('turning it off asks first, and then the password alone opens the account', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);

  const turnOff = twoStep(page).getByRole('button', { name: 'Turn off', exact: true });
  await turnOff.click();
  await expect(twoStep(page).getByText('Turn off two-step sign-in? Your password alone will open your account again.')).toBeVisible();
  // The question's own Turn off has the focus, so a screen reader reads the question with it.
  await expect(turnOff).toBeFocused();
  await expect(turnOff).toHaveAccessibleDescription(/^Turn off two-step sign-in\?/);
  await twoStep(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
  await expect(turnOff).toBeFocused();
  expect(removed(calls)).toHaveLength(0);

  await twoStep(page).getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(twoStep(page).getByText('Turn off two-step sign-in?', { exact: false })).toBeVisible();
  await twoStep(page).getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(twoStep(page).getByText('Turn it on and signing in', { exact: false })).toBeVisible();
  expect(removed(calls)).toHaveLength(1);
  await expect(twoStep(page).getByRole('status')).toHaveText('Two-step sign-in is off.');
  await expect(twoStep(page).getByRole('button', { name: 'Turn on', exact: true })).toBeFocused();

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
  await expect(twoStep(page).getByText('Turn it on and signing in', { exact: false })).toBeVisible();
  expect(removed(calls)).toHaveLength(1);
  await expect(twoStep(page).getByRole('status')).toHaveText('Set-up cancelled.');
  await expect(twoStep(page).getByRole('button', { name: 'Turn on', exact: true })).toBeFocused();

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
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
});

test('leaving the page mid set-up and coming back keeps the set-up', async ({ page }) => {
  // A phone set up in full, so the bottom navigation is there to leave by.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await completeSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();

  // Off to Settings and back: the router keeps the account page mounted but hidden, and reads the account again.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL('/settings');
  await page.getByRole('region', { name: 'Your account', exact: true }).getByRole('link', { name: 'Manage account', exact: true }).click();
  await expect(page).toHaveURL('/settings/account');
  await expect(codeField(page)).toBeVisible();
  await expect(twoStep(page).getByText('JBSW Y3DP EHPK 3PXP', { exact: true })).toBeVisible();
  expect(removed(calls)).toHaveLength(0);

  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
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
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
});

test('a phone not yet linked, signed in before another turned it on, asks for the code before it links', async ({ page, browser }) => {
  // Two phones: WebKit needs more than the default 30 s.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const factors: AuthFactors = new Map();
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await page.goto('/settings/account');
  await signIn(page);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();

  await turnOnFromAnotherPhone(browser, factors);
  // A phone signed in from before linking existed: its password-only session, and no link yet.
  await unlink(page);
  await page.reload();

  // The account shows that session nothing, which looks empty: the code step takes over, and nothing is linked.
  await expect(codeField(page)).toBeVisible();
  await codeField(page).fill(E2E_TOTP_CODE);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Sync', exact: true }).getByText('Synced just now.', { exact: true })).toBeVisible();
});

test('a phone signed in before another turned it on asks for the code on Sync now, not "couldn’t sync"', async ({ page, browser }) => {
  // Two phones, the first set up in full: WebKit needs more than the default 30 s.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const factors: AuthFactors = new Map();
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await completeSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  // Linked: the phone's data went to the account.
  await expect(page.getByRole('region', { name: 'Sync', exact: true }).getByText('Synced just now.', { exact: true })).toBeVisible();

  await turnOnFromAnotherPhone(browser, factors);
  // A change on this phone, waiting to be sent.
  await page.goto('/settings');
  await page.getByRole('region', { name: 'Profile', exact: true }).getByRole('textbox', { name: 'Your name', exact: true }).fill('Changed here');
  await page.getByRole('region', { name: 'Profile', exact: true }).getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.goto('/settings/account');

  // Row-level security now refuses this session's rows, as the database does (Postgres insufficient_privilege).
  await page.route(SUPABASE_REST, (route) =>
    route.request().method() === 'POST' && !route.request().url().includes('/rpc/')
      ? route.fulfill({
          status: 403,
          headers: { 'access-control-allow-origin': '*' },
          json: { code: '42501', message: 'new row violates row-level security policy' },
        })
      : route.fallback(),
  );
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(codeField(page)).toBeVisible();
  await expect(alert(page)).toHaveCount(0);
});

test('a set-up removed from another phone says so, and Turn on then finds it on', async ({ page, browser }) => {
  // Two phones: WebKit needs more than the default 30 s.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const factors: AuthFactors = new Map();
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD }, { factors });
  await page.goto('/settings/account');
  await signIn(page);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(codeField(page)).toBeVisible();

  // Phone B turns it on meanwhile, which first clears this phone's unfinished set-up.
  await turnOnFromAnotherPhone(browser, factors);

  await codeField(page).fill(E2E_TOTP_CODE);
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(alert(page)).toHaveText('This set-up was cancelled, maybe from another phone. Turn on to start again.');
  await twoStep(page).getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(twoStep(page).getByText('Signing in asks for the code from your authenticator app.')).toBeVisible();
  await expect(twoStep(page).getByRole('status')).toHaveText('Two-step sign-in is already on.');
});

test('a half sign-in the account server has ended asks to sign in again', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signInAndTurnOn(page);
  await signOut(page);
  await signIn(page);
  await expect(codeField(page)).toBeVisible();

  // The server no longer knows this session (the code was given on another device, which ends password-only ones).
  await page.route('**/auth/v1/factors/*/challenge', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fallback()
      : route.fulfill({
          status: 403,
          headers: { 'access-control-allow-origin': '*' },
          json: { error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' },
        }),
  );
  await codeField(page).fill(E2E_TOTP_CODE);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(alert(page)).toHaveText(`This sign-in for ${EMAIL} has ended, maybe because it was finished on another device.`);
  await expect(page.getByRole('button', { name: 'Sign in again', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Sign in again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
