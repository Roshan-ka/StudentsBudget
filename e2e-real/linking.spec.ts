import type { Browser, Page } from '@playwright/test';
import { aiSwitchedOff } from '../e2e/helpers/ai';
import { openApp } from '../e2e/helpers/app';
import { seedSetup } from '../e2e/helpers/seed-setup';
import { mockFrankfurter, readStore } from '../e2e/helpers/setup';
import type { Plan } from '../src/db/types';
import { readAccount, type TestUser } from './adapter';
import { REAL_BASE_URL } from './env';
import { expect, guard, signedInAs, signIn, syncRegion, test } from './fixtures';

// Journey 3, linking (P2.2) against the real database: a phone with a plan fills an empty account, and a fresh browser
// that signs in later loads it. Each test also records what a sign-in on a fresh browser writes to the account: nothing
// (the rows read back before and after are the same), which the live smoke relies on (its account has no data).
test.use({ viewport: { width: 375, height: 812 } });

// About sync, not the AI or exchange rates: no AI call, and Frankfurter answers from the test.
test.beforeEach(async ({ page }) => {
  await aiSwitchedOff(page);
  await mockFrankfurter(page);
});

/** A fresh browser, as a second phone, behind the network guard: signed in on its account page, and nothing else. */
async function freshPhone(browser: Browser, user: TestUser): Promise<{ page: Page; guarded: Awaited<ReturnType<typeof guard>> }> {
  const context = await browser.newContext({ baseURL: REAL_BASE_URL, locale: 'en-GB', serviceWorkers: 'block', viewport: { width: 375, height: 812 } });
  const guarded = await guard(context);
  const page = await context.newPage();
  await aiSwitchedOff(page);
  await mockFrankfurter(page);
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(signedInAs(page, user.email)).toBeVisible();
  return { page, guarded };
}

test('a phone with a plan fills the account, and a fresh browser that signs in loads it and writes nothing', async ({ page, browser, request, makeUser }) => {
  test.setTimeout(90_000);
  const user = await makeUser({ secondFactor: 'none' });
  await seedSetup(page);
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(page.getByText("Your account now holds this phone's data.", { exact: true })).toBeVisible();
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();
  const planA = (await readStore<Plan>(page, 'plan'))[0];
  // Phone A goes first, so its own automatic sync can't write while phone B is measured.
  await page.close();
  const before = await readAccount(request, user);
  expect(before.plans.length, 'the plan reached the account').toBeGreaterThan(0);

  const { page: phoneB, guarded } = await freshPhone(browser, user);
  await expect(phoneB.getByText(/^Loaded from your account: \d+ accounts?, \d+ entr(y|ies) and your plan\.$/)).toBeVisible(); // proof: loaded-from-account
  await expect(syncRegion(phoneB).getByText('Synced just now.', { exact: true })).toBeVisible();
  expect((await readStore<Plan>(phoneB, 'plan'))[0]).toEqual(planA);
  // The fresh browser's sign-in, linking and first sync changed no row of the account.
  expect(await readAccount(request, user)).toEqual(before);
  guarded.assertClean();
  await phoneB.context().close();
});

test('a fresh browser on an empty account links at once and writes nothing to it', async ({ page, request, makeUser }) => {
  const user = await makeUser({ secondFactor: 'none' });
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible(); // proof: empty-linked
  const rows = await readAccount(request, user);
  expect(Object.values(rows).flat(), 'no app data written by signing in').toEqual([]);
});
