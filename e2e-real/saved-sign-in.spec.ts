import { openApp } from '../e2e/helpers/app';
import { expect, signedIn as test, signedInAs } from './fixtures';

// Journey 1, the saved sign-in: a test that starts from its worker's saved sign-in is in the account with the second
// step done, with no password and no code typed. Other journeys that need a signed-in student start the same way.
test('the saved sign-in opens the account with two-step sign-in on', async ({ page, savedSignIn }) => {
  await openApp(page, '/settings/account');
  await expect(signedInAs(page, savedSignIn.user.email)).toBeVisible();
  const twoStepOn = page.getByRole('region', { name: 'Two-step sign-in', exact: true }).getByText('Signing in asks for the code from your authenticator app.');
  await expect(twoStepOn).toBeVisible(); // proof: two-step-on
});
