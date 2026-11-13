import { openApp } from '../e2e/helpers/app';
import { signOut } from '../e2e/helpers/supabase';
import { SESSION_KEY } from './adapter';
import { codeField, codeStep, expect, giveCode, signedInAs, signIn, syncRegion, test, UI_SIGN_IN_TIMEOUT, wrongCode } from './fixtures';

// Journey 1, two-step sign-in (P2.3a) against the real Auth server, each test on a throwaway account of its own whose
// authenticator was turned on through the API. Expired codes aren't tested here: the server's window isn't set
// anywhere in the repo.

test('the right authenticator code signs in', async ({ page, makeUser }) => {
  test.setTimeout(UI_SIGN_IN_TIMEOUT);
  const user = await makeUser({ secondFactor: 'totp' });
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(codeStep(page, user.email)).toBeVisible();
  // Nothing of the account before the code: no linking, no sync.
  await expect(syncRegion(page)).toHaveCount(0);

  await giveCode(page, user);
  await expect(signedInAs(page, user.email)).toBeVisible(); // proof: right-code
});

test('a wrong code is refused and the code step stays', async ({ page, makeUser }) => {
  const user = await makeUser({ secondFactor: 'totp' });
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await expect(codeStep(page, user.email)).toBeVisible();

  await codeField(page).fill(wrongCode(user.secret as string));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // In main: Next's route announcer is an alert of its own, outside it.
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('That code didn’t work. Codes change every 30 seconds: enter the newest one.'); // proof: wrong-code
  await expect(codeField(page)).toBeVisible();
  await expect(signedInAs(page, user.email)).toHaveCount(0);
});

test('signing out ends the session: the old sign-in no longer opens the account', async ({ page, makeUser }) => {
  test.setTimeout(UI_SIGN_IN_TIMEOUT);
  const user = await makeUser({ secondFactor: 'totp' });
  await openApp(page, '/settings/account');
  await signIn(page, user);
  await giveCode(page, user);
  await expect(signedInAs(page, user.email)).toBeVisible();
  const before = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
  expect(before, 'a session in the browser before signing out').not.toBeNull();

  await signOut(page);
  // The phone keeps the session it had before signing out, as a copied browser profile would: the server must refuse it.
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, before as string]);
  await openApp(page, '/settings/account');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible(); // proof: signed-out
  await expect(signedInAs(page, user.email)).toHaveCount(0);
});
