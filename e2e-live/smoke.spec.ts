import path from 'node:path';
import { expect, test } from '@playwright/test';
import { aiSwitchedOff } from '../e2e/helpers/ai';
import { openApp } from '../e2e/helpers/app';
import { signOut } from '../e2e/helpers/supabase';
import { liveAccount, liveCode } from './account';

// The live smoke (e2e-live/playwright.config.ts): on the live site, sign in with the authenticator code, see the account
// signed in and synced, sign out. Read-only: a sign-in on a fresh browser writes no app data to an empty account
// (e2e-real/linking.spec.ts records it), and the account is kept empty. Nothing here names the account, so a failure
// can't print it: its texts are matched by pattern. Never run from an agent session (CLAUDE.md, "Live smoke").

test('the live site signs in with the authenticator code, shows the account synced, and signs out', { tag: '@smoke' }, async ({ page }, testInfo) => {
  const account = liveAccount();
  // No AI call from the smoke: the live AI costs money and has a daily limit.
  await aiSwitchedOff(page);
  await openApp(page, '/settings/account');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/^Enter the code from your authenticator app for /)).toBeVisible();

  const code = await liveCode(account, path.join(testInfo.project.outputDir, '.totp-step'));
  await page.getByRole('textbox', { name: '6-digit code', exact: true }).fill(code);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText(/^Signed in as \S+@\S+\.$/)).toBeVisible();
  // Linking is done once Sync shows (an empty account on a fresh browser links at once); only then sign out.
  await expect(page.getByRole('region', { name: 'Sync', exact: true }).getByRole('button', { name: 'Sync now', exact: true })).toBeVisible();

  // Confirms "Sign out of this phone?" and waits for the start page.
  await signOut(page);

  // The leak check (leak-check.mjs) needs a run that fails, at the very end, after every secret was typed.
  if (process.env.E2E_LEAK_CHECK) expect(false, 'leak check: failing on purpose, after signing out').toBe(true);
});
