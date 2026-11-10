import { expect, test, type Browser, type Page, type Route } from '@playwright/test';
import { aiSwitchedOff } from './helpers/ai';
import { openApp } from './helpers/app';
import type { Entry, Plan, Profile } from '../src/db/types';
import { seedSetup } from './helpers/seed-setup';
import { mockFrankfurter, readStore } from './helpers/setup';
import { holdSyncLock } from './helpers/sync-lock';
import {
  endSession,
  mockSupabaseAuth,
  mockSupabaseData,
  signOut,
  skipUnlessAccountsShow,
  SUPABASE_REST,
  type ServerTables,
} from './helpers/supabase';

// Linking and Sync now (P2.2 chunks 6–7) at 375 px, against the mocked account. Linking replaced P2.1's Save and Load:
// signed in on the account page, a phone links to the account, and Sync now keeps both sides alike. Since automatic
// sync (docs/superpowers/plans/2026-11-10-automatic-sync.md) a linked phone also syncs by itself, so a test that needs
// a change to wait holds the sync lock (`holdSyncLock`), as another tab syncing would.
test.use({ viewport: { width: 375, height: 812 } });

// About sync, not the AI: quick add reads its lines on the phone (aiSwitchedOff), with no note and no call.
test.beforeEach(async ({ page }) => {
  await aiSwitchedOff(page);
});

const EMAIL = 'roshan@example.com';
const OTHER = 'other@example.com';
const PASSWORD = 'correct horse';

function syncRegion(page: Page) {
  return page.getByRole('region', { name: 'Sync', exact: true });
}

function linkRegion(page: Page) {
  return page.getByRole('region', { name: 'Link this phone', exact: true });
}

async function signIn(page: Page, email = EMAIL) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}.`, { exact: true })).toBeVisible();
}

/** Renames the profile in Settings: a change this phone records, to be sent with the next sync. */
async function renameProfile(page: Page, name: string) {
  await page.goto('/settings/profile');
  const profile = page.getByRole('region', { name: 'Profile', exact: true });
  await profile.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
  await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(profile.getByText('Profile saved.', { exact: true })).toBeVisible();
}

async function syncNow(page: Page) {
  await page.goto('/settings/account');
  const button = syncRegion(page).getByRole('button', { name: 'Sync now', exact: true });
  await button.click();
  // The status may read "Synced just now." before the tap already: the button, disabled while it syncs, says when
  // this sync is over.
  await expect(button).toBeEnabled();
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
}

async function profileName(page: Page): Promise<string | undefined> {
  return (await readStore<Profile>(page, 'profile'))[0]?.name;
}

/** Phone B: a new browser on the same account, signed in on its account page. */
async function secondPhone(browser: Browser, account: ServerTables, setUp = false): Promise<Page> {
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await phone.newPage();
  await mockFrankfurter(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockSupabaseData(page, { tables: account });
  if (setUp) await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  return page;
}

test('an empty phone links to an empty account at once, and says how sync stands', async ({ page, context }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockSupabaseData(page);
  await page.goto('/settings/account');
  await signIn(page);

  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await context.setOffline(true);
  await expect(syncRegion(page).getByText('Offline. Changes made now wait on this phone.', { exact: true })).toBeVisible();
  await context.setOffline(false);

  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /^Your account/ })).toContainText('Synced just now.');
});

test('a phone with a plan links by uploading, a second by loading, and Sync now carries changes both ways', async ({ page, browser }) => {
  // Two phones, the first set up in full.
  test.setTimeout(90_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(page.getByText("Your account now holds this phone's data.", { exact: true })).toBeVisible();
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  expect(account.get('plans')?.has('current')).toBe(true);

  const pageB = await secondPhone(browser, account);
  await expect(pageB.getByText(/^Loaded from your account: \d+ accounts?, 0 entries and your plan\.$/)).toBeVisible();
  expect((await readStore<Plan>(pageB, 'plan'))[0]).toEqual((await readStore<Plan>(page, 'plan'))[0]);

  await renameProfile(page, 'Named on phone A');
  await syncNow(page);
  await syncNow(pageB);
  await expect.poll(() => profileName(pageB)).toBe('Named on phone A');

  await renameProfile(pageB, 'Named on phone B');
  await syncNow(pageB);
  await syncNow(page);
  await expect.poll(() => profileName(page)).toBe('Named on phone B');
  await pageB.context().close();
});

test('when both phones hold data, the person chooses which to keep', async ({ page, browser }) => {
  // Two phones, both set up in full.
  test.setTimeout(90_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

  const pageB = await secondPhone(browser, account, true);
  const question = linkRegion(pageB).getByText('This phone and your account both hold data.', { exact: false });
  await expect(question).toBeVisible();
  // The question takes the focus, not a button: neither side is the default.
  await expect(question).toBeFocused();
  // Keeping this phone's data would delete the account's own rows, there and on the other phone.
  await expect(
    linkRegion(pageB).getByText('from your account, and from your other phones when they next sync.', { exact: false }),
  ).toBeVisible();
  const useAccount = linkRegion(pageB).getByRole('button', { name: "Use my account's data", exact: true });
  await useAccount.click();
  // The button went with the choice: the focus moves to the line on what moved, not to the top of the page.
  await expect(pageB.getByText(/^Loaded from your account: /)).toBeFocused();
  await expect(syncRegion(pageB).getByText('Synced just now.', { exact: true })).toBeVisible();
  const accountsA = (await readStore<{ id: string }>(page, 'accounts')).map((a) => a.id).sort();
  expect((await readStore<{ id: string }>(pageB, 'accounts')).map((a) => a.id).sort()).toEqual(accountsA);
  await pageB.context().close();
});

test('a phone linked to one account stays apart from another account', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD, [OTHER]: PASSWORD });
  await mockSupabaseData(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  // The session runs out with the link kept (signing out would clear the phone and the link).
  await endSession(page);

  await signIn(page, OTHER);
  await expect(linkRegion(page).getByRole('alert')).toHaveText(/^This phone holds another account's data/);
  await expect(syncRegion(page)).toHaveCount(0);

  // Settings' Your account row doesn't show the first account's sync status to this one.
  await page.goto('/settings');
  const row = page.getByRole('link', { name: /^Your account/ });
  await expect(row).toContainText('This phone is linked to another account.');
  await expect(row).not.toContainText('Synced ');
});

test('signing out sends the last change first, then clears this phone; signing in again brings it back', async ({
  page,
}) => {
  // A phone set up in full.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

  await renameProfile(page, 'Changed before signing out');
  await page.goto('/settings/account');
  await signOut(page);
  expect((account.get('profiles')?.get('current') as Profile | undefined)?.name).toBe('Changed before signing out');
  // The phone is cleared, the link with it (06-11-2026).
  expect(await readStore(page, 'plan')).toEqual([]);
  expect(await readStore(page, 'syncState')).toEqual([]);

  // Signing in again loads the account's data onto the empty phone.
  await openApp(page, '/settings/account');
  await signIn(page);
  await expect(page.getByText(/^Loaded from your account: /)).toBeVisible();
  expect(await profileName(page)).toBe('Changed before signing out');
});

// Coverage the P2.2 review found missing (triage row 13, P2.2 chunk 11).

/** The phone's entries with this amount, by id. */
async function entryIdsOf(page: Page, amountMinor: number): Promise<string[]> {
  return (await readStore<Entry>(page, 'entries')).filter((e) => e.amountMinor === amountMinor).map((e) => e.id);
}

test('Sync now carries an entry, and then its delete, to the other phone', async ({ page, browser }) => {
  // Two phones, the first set up in full.
  test.setTimeout(90_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  const pageB = await secondPhone(browser, account);
  await expect(pageB.getByText(/^Loaded from your account: /)).toBeVisible();

  // Phone A logs a döner through quick add.
  await page.goto('/entries');
  await expect(page.getByText('Oct 2026')).toBeVisible();
  await page.getByLabel('Quick add').fill('döner 6');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Eating out' }).click();
  await expect.poll(() => entryIdsOf(page, 600)).toHaveLength(1);
  const [id] = await entryIdsOf(page, 600);

  await syncNow(page);
  await syncNow(pageB);
  await expect.poll(() => entryIdsOf(pageB, 600)).toEqual([id]);

  // Phone A deletes it: the delete reaches phone B too.
  await page.goto('/entries');
  await page.getByRole('button', { name: /döner/ }).click();
  const panel = page.getByRole('region', { name: 'Edit entry' });
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  await panel.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect.poll(() => entryIdsOf(page, 600)).toEqual([]);
  await syncNow(page);
  await syncNow(pageB);
  await expect.poll(() => entryIdsOf(pageB, 600)).toEqual([]);
  await pageB.context().close();
});

test('keeping this phone’s data takes the account’s own rows from the other phone at its next sync', async ({ page, browser }) => {
  // Two phones, both set up in full, each with its own accounts.
  test.setTimeout(90_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

  const pageB = await secondPhone(browser, account, true);
  await expect(
    linkRegion(pageB).getByText('from your account, and from your other phones when they next sync.', { exact: false }),
  ).toBeVisible();
  await linkRegion(pageB).getByRole('button', { name: "Keep this phone's data", exact: true }).click();
  await expect(pageB.getByText("Your account now holds this phone's data.", { exact: true })).toBeFocused();

  // Phone A's next sync brings phone B's data, and its own accounts go, as the choice said.
  const accountsB = (await readStore<{ id: string }>(pageB, 'accounts')).map((a) => a.id).sort();
  await syncNow(page);
  await expect.poll(async () => (await readStore<{ id: string }>(page, 'accounts')).map((a) => a.id).sort()).toEqual(accountsB);
  await pageB.context().close();
});

test('when linking fails it says so, and Try again links', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockSupabaseData(page);
  // The account's tables fail for a while. A 500, not a 503: supabase-js retries a GET that gets a 503 (or 520) by
  // itself, with growing waits, so the app would only give up after this test's wait.
  const down = (route: Route) =>
    route.request().method() === 'OPTIONS'
      ? route.fallback()
      : route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, json: { code: 'XX000', message: 'down' } });
  await page.route(SUPABASE_REST, down);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(linkRegion(page).getByRole('alert')).toHaveText(
    "Couldn't link this phone to your account. Check your connection and try again.",
  );
  await expect(syncRegion(page)).toHaveCount(0);

  await page.unroute(SUPABASE_REST, down);
  await linkRegion(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
});

test('offline, Sync now says the change waits on this phone, on a page reached through the bottom navigation', async ({ page, context }) => {
  // A phone set up in full, so the bottom navigation is there.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await mockSupabaseData(page);
  await seedSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  // Another tab holds the sync lock: the phone's own automatic sync skips, and the change waits.
  const release = await holdSyncLock(context);
  await renameProfile(page, 'Changed offline');

  // Back to the account page the way a person goes, so the page kept mounted but hidden shows again.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /^Your account/ }).click();
  await expect(page).toHaveURL('/settings/account');
  await expect(syncRegion(page).getByText('Synced just now. 1 change waiting.', { exact: true })).toBeVisible();

  await context.setOffline(true);
  await expect(syncRegion(page).getByText('Offline: 1 change waits on this phone.', { exact: true })).toBeVisible();
  // Let go, or Sync now would wait for the lock: offline, the automatic sync waits too.
  await release();
  await syncRegion(page).getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(syncRegion(page).getByRole('status')).toHaveText('Not synced: you’re offline. Changes wait on this phone.');
  await context.setOffline(false);
});
