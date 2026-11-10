import { expect, test, type Browser, type Page } from '@playwright/test';
import { aiSwitchedOff } from './helpers/ai';
import { openApp } from './helpers/app';
import type { Profile } from '../src/db/types';
import { seedSetup } from './helpers/seed-setup';
import { mockFrankfurter } from './helpers/setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, SUPABASE_REST, type ServerTables } from './helpers/supabase';

// Automatic sync (docs/superpowers/plans/2026-11-10-automatic-sync.md) at 375 px, against the mocked account: a linked
// phone sends a change a few seconds after it, pulls on opening, sends what waited once back online, and while it
// stays visible syncs every minute, backing off after a failure. No tap on Sync now anywhere here.
test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await aiSwitchedOff(page);
});

const EMAIL = 'roshan@example.com';
const PASSWORD = 'correct horse';

/**
 * A change is sent 3 s after it (at most 5 s after the first unsent one), and starts are at least 5 s apart: a line that
 * says so waits up to 15 s, the schedule's own delays and not a slow page (automatic sync, chunk 6).
 */
const SENT_BY_ITSELF = { timeout: 15_000 };

function syncRegion(page: Page) {
  return page.getByRole('region', { name: 'Sync', exact: true });
}

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

/** A seeded phone, signed in on Settings → Your account: linked, its data in the account. */
async function linkedPhone(page: Page, account?: ServerTables): Promise<ServerTables> {
  await mockFrankfurter(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const tables = await mockSupabaseData(page, account === undefined ? {} : { tables: account });
  await seedSetup(page);
  await openApp(page, '/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  return tables;
}

/** A second phone on the same account: empty, so linking loads the account's data. */
async function secondPhone(browser: Browser, account: ServerTables): Promise<Page> {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await phone.newPage();
  await aiSwitchedOff(page);
  await mockFrankfurter(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockSupabaseData(page, { tables: account });
  await openApp(page, '/settings/account');
  await signIn(page);
  return page;
}

async function renameProfile(page: Page, name: string) {
  await page.goto('/settings/profile');
  const profile = page.getByRole('region', { name: 'Profile', exact: true });
  await profile.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
  await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(profile.getByText('Profile saved.', { exact: true })).toBeVisible();
}

function accountName(account: ServerTables): string | undefined {
  return (account.get('profiles')?.get('current') as Profile | undefined)?.name;
}

async function profileName(page: Page) {
  await openApp(page, '/settings/profile');
  return page.getByRole('region', { name: 'Profile', exact: true }).getByRole('textbox', { name: 'Your name', exact: true });
}

test('a change reaches the account a few seconds after it, with no tap', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const account = await linkedPhone(page);
  await renameProfile(page, 'Sent by itself');
  await expect.poll(() => accountName(account), SENT_BY_ITSELF).toBe('Sent by itself');
  await page.goto('/settings/account');
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  await expect(syncRegion(page).getByText('This phone syncs by itself while the app is open. Sync now syncs straight away.', { exact: true })).toBeVisible();
});

test('opening the app on another phone pulls the change', async ({ page, browser }) => {
  // Two phones, each linked: more than the default 30 s.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  const account = await linkedPhone(page);
  const other = await secondPhone(browser, account);
  await expect(syncRegion(other).getByText('Synced just now.', { exact: true })).toBeVisible();

  await renameProfile(page, 'From the first phone');
  await expect.poll(() => accountName(account), SENT_BY_ITSELF).toBe('From the first phone');
  // Opening the app (a full load) syncs before anything else.
  await expect(await profileName(other)).toHaveValue('From the first phone', SENT_BY_ITSELF);
  await other.context().close();
});

test('a change made offline is sent once the phone is back online', async ({ page, context }) => {
  await skipUnlessAccountsShow(page);
  const account = await linkedPhone(page);
  // The page opens online and stays: offline, no page loads here (service workers are blocked), and a client-side
  // navigation falls back to a full load when its fetch fails. "Offline: 1 change waits" is linking.spec's.
  await page.goto('/settings/profile');
  await context.setOffline(true);
  const profile = page.getByRole('region', { name: 'Profile', exact: true });
  await profile.getByRole('textbox', { name: 'Your name', exact: true }).fill('Made offline');
  await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(profile.getByText('Profile saved.', { exact: true })).toBeVisible();
  expect(accountName(account)).not.toBe('Made offline');

  await context.setOffline(false);
  await expect.poll(() => accountName(account), SENT_BY_ITSELF).toBe('Made offline');
});

test('while visible it syncs every minute, and after a failure it waits a minute before trying again', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  // The page's clock runs as usual until fastForward jumps it: the minute's timers fire without a minute's wait.
  await page.clock.install();
  await linkedPhone(page);

  // Every call to the account from here on: counted, then refused while `failing`.
  let calls = 0;
  let failing = false;
  await page.route(SUPABASE_REST, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    calls += 1;
    if (!failing) return route.fallback();
    return route.fulfill({
      status: 500,
      headers: { 'access-control-allow-origin': '*' },
      json: { code: 'XX000', message: 'mock failure' },
    });
  });

  // A minute on: one sync by itself.
  await page.clock.fastForward('01:05');
  await expect.poll(() => calls, SENT_BY_ITSELF).toBeGreaterThan(0);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

  // The next minute's sync fails.
  failing = true;
  calls = 0;
  await page.clock.fastForward('01:05');
  // An automatic failure says nothing on the page (the status keeps the last sync): the calls tell.
  await expect.poll(() => calls, SENT_BY_ITSELF).toBeGreaterThan(0);

  // Half a minute on: no new try while it backs off.
  const afterFailure = calls;
  await page.clock.fastForward('00:30');
  // The page's own timers have run by the time a round trip to it comes back.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(calls).toBe(afterFailure);

  // A minute after the failure it tries again, and the account answers once more.
  failing = false;
  await page.clock.fastForward('00:40');
  await expect.poll(() => calls, SENT_BY_ITSELF).toBeGreaterThan(afterFailure);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible(SENT_BY_ITSELF);
});
