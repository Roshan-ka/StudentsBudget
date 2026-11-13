import { openApp } from '../e2e/helpers/app';
import { createUser, deleteUser } from './adapter';
import { expect, signedInAs, signIn, syncRegion, test } from './fixtures';

// Journey 6, deleting the account (P2.5) against the real Auth server and database: after Delete my account, the
// same email and password no longer sign in. The account is made here, not with makeUser, because the test deletes it;
// if the test stops first, the finally block deletes it instead.

test('deleting the account: the same email and password no longer sign in', async ({ page, request }) => {
  const user = await createUser(request, { secondFactor: 'none' });
  try {
    await openApp(page, '/settings/account');
    await signIn(page, user);
    await expect(signedInAs(page, user.email)).toBeVisible();
    // Signing in links the phone first; deleting waits for that, as a person would.
    await expect(syncRegion(page).getByText('Synced just now.', { exact: true })).toBeVisible();

    const card = page.getByRole('region', { name: 'Delete my account', exact: true });
    await card.getByLabel('Password', { exact: true }).fill(user.password);
    await card.getByRole('textbox', { name: 'Type DELETE to confirm', exact: true }).fill('DELETE');
    await card.getByRole('button', { name: 'Delete my account', exact: true }).click();
    await expect(page.getByText('Your account is deleted. Everything on this phone stays.', { exact: true })).toBeVisible();

    await openApp(page, '/settings/account');
    await signIn(page, user);
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('Email or password is wrong.'); // proof: deleted
  } finally {
    // Gone already when the test passed: then this is refused, and that is fine.
    await deleteUser(request, user).catch(() => undefined);
  }
});
