import { expect, test, type Page } from '@playwright/test';
import { DISCOUNTS } from '../src/data/discounts';
import type { Account, DiscountVote } from '../src/db/types';
import { PRIVACY_NOTES } from '../src/features/privacy/notes';
import { MESSAGES } from '../src/i18n/messages';
import { FRANKFURTER, readStore } from './helpers/setup';
import {
  addVirtualAuthenticator,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthCall,
} from './helpers/supabase';

// The one-time data-protection notes (docs/superpowers/plans/2026-11-05-privacy-notes.md) before a feature first sends
// data to someone else: the first account, the first passkey, the first currency other than the euro and the first vote
// while signed in. Cancel sends nothing, Continue goes on, and the phone isn't asked again. Supabase Auth and Frankfurter
// are mocked. The mic's note is tested in dictation.spec.ts.

test.use({ viewport: { width: 375, height: 812 } });

// Signing in links the phone to the account (P2.2), which reads the account's tables: an empty account.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
});

const EMAIL = 'new@example.com';
const PASSWORD = 'correct horse';
const EN = MESSAGES.en;
const NOTE = EN.common.privacy;

function note(page: Page, label = NOTE.label) {
  return page.getByRole('group', { name: label, exact: true });
}

function noteFlag(page: Page, key: string) {
  return page.evaluate((name) => localStorage.getItem(name), key);
}

async function fillNewAccount(page: Page, email: string, words = EN.auth.signIn) {
  await page.getByRole('button', { name: words.toCreate, exact: true }).click();
  await page.getByRole('textbox', { name: words.email, exact: true }).fill(email);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(words.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: words.create, exact: true }).click();
}

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: EN.auth.signIn.email, exact: true }).fill(EMAIL);
  await page.getByLabel(EN.auth.signIn.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: EN.auth.signIn.signIn, exact: true }).click();
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
}

const signUps = (calls: AuthCall[]) => calls.filter((c) => c.path === '/signup');

/** Answers Frankfurter with INR at 95, as `mockFrankfurter` does, and keeps every request it gets. */
async function countFrankfurter(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route(FRANKFURTER, (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      json: [{ date: '2026-10-16', base: 'EUR', quote: 'INR', rate: 95 }],
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  return requests;
}

test('the first account on a phone waits for the note on where its data is kept', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page);
  await fillNewAccount(page, EMAIL);

  // Cancel: nothing is sent, and the form is back.
  await expect(note(page)).toContainText(NOTE.account);
  await note(page).getByRole('button', { name: NOTE.cancel, exact: true }).click();
  await expect(note(page)).toHaveCount(0);
  expect(signUps(calls)).toHaveLength(0);
  expect(await noteFlag(page, PRIVACY_NOTES.account)).toBeNull();

  // Continue: the account is made.
  await page.getByRole('button', { name: EN.auth.signIn.create, exact: true }).click();
  await note(page).getByRole('button', { name: NOTE.continue, exact: true }).click();
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
    const de = MESSAGES.de;
    await fillNewAccount(page, EMAIL, de.auth.signIn);

    const german = note(page, de.common.privacy.label);
    await expect(german).toContainText(de.common.privacy.account);
    await german.getByRole('button', { name: de.common.privacy.continue, exact: true }).click();
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
  await signIn(page);

  const passkeys = page.getByRole('region', { name: EN.auth.passkeys.heading, exact: true });
  const add = passkeys.getByRole('button', { name: EN.auth.passkeys.add, exact: true });
  const registrations = () => calls.filter((c) => c.path.startsWith('/passkeys/registration'));

  // Cancel: no passkey is made, and the focus is back on Add.
  await add.click();
  await expect(note(page)).toContainText(NOTE.passkey);
  await note(page).getByRole('button', { name: NOTE.cancel, exact: true }).click();
  await expect(add).toBeFocused();
  expect(registrations()).toHaveLength(0);

  // Continue: the passkey is added straight away.
  await add.click();
  await note(page).getByRole('button', { name: NOTE.continue, exact: true }).click();
  await expect(passkeys.getByRole('listitem')).toHaveCount(1);
  expect(await noteFlag(page, PRIVACY_NOTES.passkey)).toBe('seen');
});

test('a first account in another currency, in Settings, waits for the note on the exchange rates', async ({ page }) => {
  const requests = await countFrankfurter(page);
  await page.goto('/settings');
  await expect(page.getByText('No accounts yet')).toBeVisible();

  await page.getByRole('button', { name: 'Add account', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Home bank');
  await page.getByLabel('Currency', { exact: true }).selectOption('INR');
  await page.getByLabel('Opening balance', { exact: true }).fill('50000');
  await page.getByRole('button', { name: 'Save account', exact: true }).click();

  // Cancel: nothing is saved or fetched, and the form is still there.
  await expect(note(page)).toContainText(NOTE.rates);
  await note(page).getByRole('button', { name: NOTE.cancel, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save account', exact: true })).toBeVisible();
  expect(await readStore<Account>(page, 'accounts')).toHaveLength(0);
  expect(requests).toHaveLength(0);

  // Continue: the account is saved, and its rate fetched.
  await page.getByRole('button', { name: 'Save account', exact: true }).click();
  await note(page).getByRole('button', { name: NOTE.continue, exact: true }).click();
  await expect(page.getByText('1 € = 95 INR')).toBeVisible();
  expect(await readStore<Account>(page, 'accounts')).toMatchObject([{ name: 'Home bank', currency: 'INR' }]);
  expect(requests.length).toBeGreaterThan(0);
  expect(await noteFlag(page, PRIVACY_NOTES.rates)).toBe('seen');
});

test('setup with an account in another currency asks once, when the accounts step is done', async ({ page }) => {
  await countFrankfurter(page);
  await page.goto('/setup');
  await expect(page.getByRole('heading', { level: 3, name: EN.setup.titles['city-rent'], exact: true })).toBeVisible();
  await page.getByRole('button', { name: EN.setup.next, exact: true }).click();
  // The draft starts with Home bank in INR.
  await expect(page.getByRole('heading', { level: 3, name: EN.setup.titles.accounts, exact: true })).toBeVisible();

  // Cancel: the step stays, with Next back.
  await page.getByRole('button', { name: EN.setup.next, exact: true }).click();
  await expect(note(page)).toContainText(NOTE.rates);
  await note(page).getByRole('button', { name: NOTE.cancel, exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: EN.setup.titles.accounts, exact: true })).toBeVisible();

  // Continue: on to the next step.
  await page.getByRole('button', { name: EN.setup.next, exact: true }).click();
  await note(page).getByRole('button', { name: NOTE.continue, exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: EN.setup.titles.income, exact: true })).toBeVisible();
  expect(await noteFlag(page, PRIVACY_NOTES.rates)).toBe('seen');

  // Back and on again: the phone isn't asked twice.
  await page.getByRole('button', { name: EN.setup.back, exact: true }).click();
  await page.getByRole('button', { name: EN.setup.next, exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: EN.setup.titles.income, exact: true })).toBeVisible();
  await expect(note(page)).toHaveCount(0);
});

test('signed in, the first discount vote waits for the note on the shared totals', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  await mockSupabaseAuth(page, { [EMAIL]: PASSWORD });
  await signIn(page);

  await page.goto('/tips');
  const tab = page.getByRole('tablist', { name: EN.tips.tabsLabel, exact: true }).getByRole('tab', { name: EN.tips.discounts, exact: true });
  await tab.click();
  const place = DISCOUNTS[0];
  const item = page
    .getByRole('list', { name: EN.tips.discounts, exact: true })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: place.place, exact: true }) });
  const works = item.getByRole('button', { name: EN.tips.votes.works, exact: true });

  // Cancel: no vote is saved, and the focus is back on the button.
  await works.click();
  await expect(item.getByRole('group', { name: NOTE.label, exact: true })).toContainText(NOTE.votes);
  await item.getByRole('button', { name: NOTE.cancel, exact: true }).click();
  await expect(works).toBeFocused();
  expect(await readStore<DiscountVote>(page, 'discountVotes')).toHaveLength(0);

  // Continue: the vote is saved.
  await works.click();
  await item.getByRole('button', { name: NOTE.continue, exact: true }).click();
  await expect(works).toHaveAttribute('aria-pressed', 'true');
  expect(await readStore<DiscountVote>(page, 'discountVotes')).toMatchObject([{ discountId: place.id, vote: 'works' }]);
  expect(await noteFlag(page, PRIVACY_NOTES.votes)).toBe('seen');
});
