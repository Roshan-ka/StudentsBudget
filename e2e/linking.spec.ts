import { expect, test, type Browser, type Page } from '@playwright/test';
import type { Plan, Profile } from '../src/db/types';
import { completeSetup, mockFrankfurter, readStore } from './helpers/setup';
import { mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type ServerTables } from './helpers/supabase';

// Linking and Sync now (P2.2 chunks 6–7) at 375 px, against the mocked account. Linking replaced P2.1's Save and Load:
// signed in on the account page, a phone links to the account, and Sync now keeps both sides alike.
test.use({ viewport: { width: 375, height: 812 } });

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

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

/** Renames the profile in Settings: a change this phone records, to be sent with the next sync. */
async function renameProfile(page: Page, name: string) {
  await page.goto('/settings');
  const profile = page.getByRole('region', { name: 'Profile', exact: true });
  await profile.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
  await profile.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(profile.getByText('Profile saved.', { exact: true })).toBeVisible();
}

async function syncNow(page: Page) {
  await page.goto('/settings/account');
  await syncRegion(page).getByRole('button', { name: 'Sync now', exact: true }).click();
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
  if (setUp) await completeSetup(page);
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
  await expect(page.getByRole('region', { name: 'Your account', exact: true }).getByText('Synced just now.', { exact: true })).toBeVisible();
});

test('a phone with a plan links by uploading, a second by loading, and Sync now carries changes both ways', async ({ page, browser }) => {
  // Two phones, the first set up in full.
  test.setTimeout(90_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await completeSetup(page);
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
  expect(await profileName(pageB)).toBe('Named on phone A');

  await renameProfile(pageB, 'Named on phone B');
  await syncNow(pageB);
  await syncNow(page);
  expect(await profileName(page)).toBe('Named on phone B');
});

test('when both phones hold data, the person chooses which to keep', async ({ page, browser }) => {
  // Two phones, both set up in full.
  test.setTimeout(90_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await completeSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

  const pageB = await secondPhone(browser, account, true);
  const question = linkRegion(pageB).getByText('This phone and your account both hold data.', { exact: false });
  await expect(question).toBeVisible();
  const useAccount = linkRegion(pageB).getByRole('button', { name: "Use my account's data", exact: true });
  await expect(linkRegion(pageB).getByRole('button', { name: "Keep this phone's data", exact: true })).toBeFocused();
  await useAccount.click();
  await expect(pageB.getByText(/^Loaded from your account: /)).toBeVisible();
  await expect(syncRegion(pageB).getByText('Synced just now.', { exact: true })).toBeVisible();
  const accountsA = (await readStore<{ id: string }>(page, 'accounts')).map((a) => a.id).sort();
  expect((await readStore<{ id: string }>(pageB, 'accounts')).map((a) => a.id).sort()).toEqual(accountsA);
});

test('a phone linked to one account stays apart from another account', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD, [OTHER]: PASSWORD });
  await mockSupabaseData(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  await signOut(page);

  await signIn(page, OTHER);
  await expect(linkRegion(page).getByRole('alert')).toHaveText(/^This phone holds another account's data/);
  await expect(syncRegion(page)).toHaveCount(0);
});

test('signing out sends the last change first, and keeps the data and the link', async ({ page }) => {
  // A phone set up in full.
  test.setTimeout(60_000);
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  const account = await mockSupabaseData(page);
  await completeSetup(page);
  await page.goto('/settings/account');
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

  await renameProfile(page, 'Changed before signing out');
  await page.goto('/settings/account');
  await signOut(page);
  expect((account.get('profiles')?.get('current') as Profile | undefined)?.name).toBe('Changed before signing out');
  await expect(syncRegion(page)).toHaveCount(0);
  expect(await profileName(page)).toBe('Changed before signing out');

  // The same account picks up where it left off: still linked, nothing to choose.
  await signIn(page);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  await expect(linkRegion(page)).toHaveCount(0);
});
