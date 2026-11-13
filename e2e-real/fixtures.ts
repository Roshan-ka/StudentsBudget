import path from 'node:path';
import { test as base, expect, request as playwrightRequest, type BrowserContext, type Page } from '@playwright/test';
import { openApp } from '../e2e/helpers/app';
import { guardContext } from '../testkit/network-guard.mjs';
import { allowedHosts, createUser, deleteUser, freshTotp, totp, type SecondFactor, type TestUser } from './adapter';
import { REAL_BASE_URL } from './env';
import { AUTH_DIR, assertNeverCommitted } from './saved-state';

// The real-server e2e's fixtures and the account page's UI steps (CLAUDE.md, "Real-server e2e").
// - `networkGuard` (automatic): the test's browser reaches only the app and the stack (adapter.ts allowedHosts); a
//   request to any other host is stopped and fails the test (testkit/network-guard.mjs). A host a test mocks with
//   page.route never reaches the guard.
// - `makeUser`: a throwaway account per test, deleted after it, pass or fail.
// - `signedIn` (a test object): starts each test from a saved sign-in, second step done, made once per worker with an
//   account of the worker's own, and made again when it is older than SAVED_FOR (the session lasts an hour:
//   supabase/config.toml jwt_expiry, and refresh tokens rotate).

/** A test that signs in through the UI may wait up to 30 s for a fresh code window (freshTotp), plus the server. */
export const UI_SIGN_IN_TIMEOUT = 90_000;
const SAVED_FOR = 50 * 60_000;

/** Your account's sign-in form: email, password, Sign in (the names e2e/two-step.spec.ts uses on the same form). */
export async function signIn(page: Page, user: TestUser) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

export function codeStep(page: Page, email: string) {
  return page.getByText(`Enter the code from your authenticator app for ${email}.`, { exact: true });
}

export function codeField(page: Page) {
  return page.getByRole('textbox', { name: '6-digit code', exact: true });
}

export function signedInAs(page: Page, email: string) {
  return page.getByText(`Signed in as ${email}.`, { exact: true });
}

export function syncRegion(page: Page) {
  return page.getByRole('region', { name: 'Sync', exact: true });
}

/** Types the authenticator's code at the code step: a fresh one, never the code that turned it on. */
export async function giveCode(page: Page, user: TestUser) {
  await codeField(page).fill(await freshTotp(user));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

/** A 6-digit code that is none of the codes of the previous, current or next 30-second window. */
export function wrongCode(secret: string): string {
  const now = Date.now();
  const valid = new Set([now - 30_000, now, now + 30_000].map((time) => totp(secret, time)));
  let candidate = (Number(totp(secret, now)) + 500_000) % 1_000_000;
  while (valid.has(String(candidate).padStart(6, '0'))) candidate = (candidate + 1) % 1_000_000;
  return String(candidate).padStart(6, '0');
}

/** Puts a second browser context (another phone) behind the network guard; call `assertClean()` before closing it. */
export const guard = (context: BrowserContext) => guardContext(context, allowedHosts());

export const test = base.extend<{ networkGuard: string[]; makeUser: (options: { secondFactor: SecondFactor }) => Promise<TestUser> }>({
  // `provide`, not Playwright's usual `use`: the React hooks lint rule takes any call named use() for a hook.
  networkGuard: [
    async ({ context }, provide) => {
      const guarded = await guard(context);
      await provide(guarded.stopped);
      guarded.assertClean();
    },
    { auto: true },
  ],
  makeUser: async ({ request }, provide) => {
    const users: TestUser[] = [];
    await provide(async (options) => {
      const user = await createUser(request, options);
      users.push(user);
      return user;
    });
    for (const user of users) await deleteUser(request, user);
  },
});

type SavedSignIn = { user: TestUser; file: () => Promise<string> };

/** Tests that start signed in as a student with two-step sign-in on, from a saved sign-in of their worker's own. */
export const signedIn = test.extend<object, { savedSignIn: SavedSignIn }>({
  savedSignIn: [
    async ({ browser }, provide, workerInfo) => {
      const file = path.join(AUTH_DIR, `student-${workerInfo.project.name}-${workerInfo.parallelIndex}.json`);
      // Before any credential is typed: the saved sign-in must not be able to reach a commit.
      assertNeverCommitted(file);
      const request = await playwrightRequest.newContext();
      const user = await createUser(request, { secondFactor: 'totp' });
      let savedAt = 0;
      const save = async () => {
        const context = await browser.newContext({ baseURL: REAL_BASE_URL, locale: 'en-GB', serviceWorkers: 'block' });
        const page = await context.newPage();
        await openApp(page, '/settings/account');
        await signIn(page, user);
        await expect(codeStep(page, user.email)).toBeVisible();
        await giveCode(page, user);
        await expect(signedInAs(page, user.email)).toBeVisible();
        // Linked (P2.2): Sync takes the place of "Linking this phone…", so the saved phone needs no linking.
        await expect(syncRegion(page).getByRole('button', { name: 'Sync now', exact: true })).toBeVisible();
        await context.storageState({ path: file, indexedDB: true });
        await context.close();
        savedAt = Date.now();
      };
      await save();
      await provide({
        user,
        file: async () => {
          if (Date.now() - savedAt > SAVED_FOR) await save();
          return file;
        },
      });
      await deleteUser(request, user);
      await request.dispose();
    },
    { scope: 'worker', timeout: UI_SIGN_IN_TIMEOUT },
  ],
  storageState: async ({ savedSignIn }, provide) => {
    await provide(await savedSignIn.file());
  },
});

export { expect };
