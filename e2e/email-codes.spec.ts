import { expect, test, type Page } from '@playwright/test';
import { acceptPrivacyNotes } from './helpers/privacy';
import {
  E2E_EMAIL_CODE,
  E2E_TOTP_CODE,
  mockSupabaseAuth,
  mockSupabaseData,
  skipUnlessAccountsShow,
  type AuthCall,
  type AuthFactors,
} from './helpers/supabase';

// The emailed codes (P2.4, docs/superpowers/plans/2026-11-04-email-codes.md): a new account is confirmed with the
// 6-digit code from its sign-up email, and "Forgot password" signs in with one for a new password. Supabase Auth is
// mocked: its emails all hold E2E_EMAIL_CODE (the sign-up tests turn "Confirm email" on); the real emails are checked
// by src/features/account/email-codes.contract.test.ts.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'new@example.com';
const PASSWORD = 'correct horse';

// A confirmed account links the phone (P2.2), which reads the account's tables: an empty account.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
  // The notes before the first account and passkey have their own spec (privacy-notes.spec.ts).
  await acceptPrivacyNotes(page);
});

/** The form's message. Inside main: Next's route announcer is an alert of its own, outside it. */
function alert(page: Page) {
  return page.getByRole('main').getByRole('alert');
}

function codeStep(page: Page, heading = 'Confirm your email') {
  return page.getByRole('region', { name: heading, exact: true });
}

async function createAccount(page: Page, words = { toCreate: 'New here? Create an account', email: 'Email', password: 'Password', create: 'Create account' }) {
  await page.getByRole('button', { name: words.toCreate, exact: true }).click();
  await page.getByRole('textbox', { name: words.email, exact: true }).fill(EMAIL);
  // A password input has no textbox role, so it is found by its label.
  await page.getByLabel(words.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: words.create, exact: true }).click();
}

async function enterCode(page: Page, code: string, words = { code: '6-digit code', confirm: 'Confirm' }) {
  await page.getByRole('textbox', { name: words.code, exact: true }).fill(code);
  await page.getByRole('button', { name: words.confirm, exact: true }).click();
}

const verifies = (calls: AuthCall[]) => calls.filter((c) => c.path === '/verify').map((c) => c.body);

test('a new account is signed in with the code from its email; a wrong one says so first', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, {}, { confirmations: true });
  await createAccount(page);

  const step = codeStep(page);
  await expect(step).toContainText(`Enter the 6-digit code we sent to ${EMAIL}. It works for 60 minutes.`);
  // The language goes with the sign-up, so the account's emails are written in it.
  expect(calls.find((c) => c.path === '/signup')?.body).toMatchObject({ email: EMAIL, data: { lang: 'en' } });

  // Not six digits: nothing is sent.
  await enterCode(page, '1234');
  await expect(alert(page)).toHaveText('Enter the 6-digit code from the email.');
  await enterCode(page, '000000');
  await expect(alert(page)).toHaveText('That code is wrong or has expired. Check the newest email, or send a new code.');

  // The gap a mail app may show is fine.
  await enterCode(page, ` ${E2E_EMAIL_CODE.slice(0, 3)} ${E2E_EMAIL_CODE.slice(3)} `);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
  await expect(step).toHaveCount(0);
  expect(verifies(calls)).toEqual([
    expect.objectContaining({ email: EMAIL, token: '000000', type: 'email' }),
    expect.objectContaining({ email: EMAIL, token: E2E_EMAIL_CODE, type: 'email' }),
  ]);
});

test('Send a new code asks for another email and says one is on its way', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, {}, { confirmations: true });
  await createAccount(page);

  await codeStep(page).getByRole('button', { name: 'Send a new code', exact: true }).click();
  await expect(codeStep(page).getByText('A new code is on its way. Use the newest one.', { exact: true })).toBeVisible();
  expect(calls.filter((c) => c.path === '/resend').map((c) => c.body)).toEqual([
    expect.objectContaining({ email: EMAIL, type: 'signup' }),
  ]);
});

test('signing in before the code offers a new one, then asks for it', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, {}, { confirmations: true });
  await createAccount(page);

  // Back: signing in, with the email kept.
  await codeStep(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(alert(page)).toHaveText('This account still has to be confirmed with the code from its email.');

  await page.getByRole('button', { name: 'Send a new code', exact: true }).click();
  await expect(codeStep(page).getByText('A new code is on its way. Use the newest one.', { exact: true })).toBeVisible();
  expect(calls.filter((c) => c.path === '/resend')).toHaveLength(1);
  await enterCode(page, E2E_EMAIL_CODE);
  await expect(page.getByText(`Signed in as ${EMAIL}.`, { exact: true })).toBeVisible();
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the code step speaks German, and the sign-up asks for German emails', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    const calls = await mockSupabaseAuth(page, {}, { confirmations: true });
    await createAccount(page, { toCreate: 'Neu hier? Konto erstellen', email: 'E-Mail', password: 'Passwort', create: 'Konto erstellen' });

    await expect(codeStep(page, 'E-Mail-Adresse bestätigen')).toContainText(
      `Gib den 6-stelligen Code ein, den wir an ${EMAIL} geschickt haben. Er gilt 60 Minuten.`,
    );
    expect(calls.find((c) => c.path === '/signup')?.body).toMatchObject({ data: { lang: 'de' } });
    await enterCode(page, '000000', { code: '6-stelliger Code', confirm: 'Bestätigen' });
    await expect(alert(page)).toHaveText(
      'Dieser Code ist falsch oder abgelaufen. Schau in die neueste E-Mail oder lass dir einen neuen Code schicken.',
    );
    await enterCode(page, E2E_EMAIL_CODE, { code: '6-stelliger Code', confirm: 'Bestätigen' });
    await expect(page.getByText(`Angemeldet als ${EMAIL}.`, { exact: true })).toBeVisible();
  });
});

// "Forgot password" (chunk 3): the email, its code, the authenticator's code for an account with two-step sign-in, and
// a new password.

const ACCOUNT = 'roshan@example.com';
const OLD_PASSWORD = 'old horse battery';
const NEW_PASSWORD = 'new staple horse';

const ENGLISH_RESET = { forgot: 'Forgot your password?', email: 'Email', send: 'Send code' };

async function askForCode(page: Page, words = ENGLISH_RESET) {
  await page.getByRole('button', { name: words.forgot, exact: true }).click();
  await page.getByRole('textbox', { name: words.email, exact: true }).fill(ACCOUNT);
  await page.getByRole('button', { name: words.send, exact: true }).click();
}

async function saveNewPassword(page: Page, password: string, words = { password: 'New password', save: 'Save password' }) {
  await page.getByLabel(words.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: words.save, exact: true }).click();
}

const newPasswords = (calls: AuthCall[]) => calls.filter((c) => c.method === 'PUT' && c.path === '/user').map((c) => c.body);

test('Forgot password: the emailed code signs in, and a new password replaces the old one, through a reload', async ({
  page,
}) => {
  await skipUnlessAccountsShow(page);
  const calls = await mockSupabaseAuth(page, { [ACCOUNT]: OLD_PASSWORD });

  // The email typed for signing in carries over.
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(ACCOUNT);
  await page.getByRole('button', { name: 'Forgot your password?', exact: true }).click();
  const emailStep = page.getByRole('region', { name: 'Reset your password', exact: true });
  await expect(emailStep.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(ACCOUNT);
  await emailStep.getByRole('button', { name: 'Send code', exact: true }).click();
  // Said the same way whether or not the email has an account.
  await expect(codeStep(page, 'Reset your password')).toContainText(
    `If ${ACCOUNT} has an account, we sent it a 6-digit code. It works for 60 minutes.`,
  );
  expect(calls.filter((c) => c.path === '/recover').map((c) => c.body)).toEqual([expect.objectContaining({ email: ACCOUNT })]);

  await enterCode(page, '000000', { code: '6-digit code', confirm: 'Continue' });
  await expect(alert(page)).toHaveText('That code is wrong or has expired. Check the newest email, or send a new code.');
  await enterCode(page, E2E_EMAIL_CODE, { code: '6-digit code', confirm: 'Continue' });
  expect(verifies(calls)).toEqual([
    expect.objectContaining({ email: ACCOUNT, token: '000000', type: 'recovery' }),
    expect.objectContaining({ email: ACCOUNT, token: E2E_EMAIL_CODE, type: 'recovery' }),
  ]);

  // Signed in, but the account waits for the new password; a reload of the tab keeps the step.
  const newPassword = page.getByRole('region', { name: 'Choose a new password', exact: true });
  await expect(newPassword).toContainText(`Signed in as ${ACCOUNT} with the code from your email.`);
  await expect(page.getByText(`Signed in as ${ACCOUNT}.`, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(newPassword).toBeVisible();

  await saveNewPassword(page, 'short');
  await expect(alert(page)).toHaveText('Use at least 8 characters for the password.');
  await saveNewPassword(page, OLD_PASSWORD);
  await expect(alert(page)).toHaveText("That's your current password. Choose a different one.");
  await saveNewPassword(page, NEW_PASSWORD);
  await expect(page.getByText('Password changed.', { exact: true })).toBeVisible();
  await expect(page.getByText(`Signed in as ${ACCOUNT}.`, { exact: true })).toBeVisible();
  expect(newPasswords(calls)).toEqual([
    expect.objectContaining({ password: OLD_PASSWORD }),
    expect.objectContaining({ password: NEW_PASSWORD }),
  ]);
});

test('an account with two-step sign-in gives its authenticator code before the new password', async ({ page }) => {
  await skipUnlessAccountsShow(page);
  const factors: AuthFactors = new Map([
    [ACCOUNT, [{ id: 'factor-owner', friendly_name: 'Owner phone', factor_type: 'totp', status: 'verified' } as const]],
  ]);
  const calls = await mockSupabaseAuth(page, { [ACCOUNT]: OLD_PASSWORD }, { factors });

  await askForCode(page);
  await enterCode(page, E2E_EMAIL_CODE, { code: '6-digit code', confirm: 'Continue' });
  // The email code alone is aal1: an inbox is not enough for such an account.
  await expect(page.getByRole('heading', { name: 'Two-step sign-in', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Choose a new password', exact: true })).toHaveCount(0);
  await enterCode(page, E2E_TOTP_CODE, { code: '6-digit code', confirm: 'Continue' });

  await saveNewPassword(page, NEW_PASSWORD);
  await expect(page.getByText('Password changed.', { exact: true })).toBeVisible();
  expect(newPasswords(calls)).toEqual([expect.objectContaining({ password: NEW_PASSWORD })]);
});

test.describe('in French', () => {
  test.use({ locale: 'fr-FR' });

  test('Forgot password speaks French from the link to the new password', async ({ page }) => {
    await skipUnlessAccountsShow(page);
    await mockSupabaseAuth(page, { [ACCOUNT]: OLD_PASSWORD });

    // French puts a narrow no-break space before the question mark.
    await askForCode(page, { forgot: 'Mot de passe oublié ?', email: 'E-mail', send: 'Envoyer le code' });
    await expect(codeStep(page, 'Réinitialiser ton mot de passe')).toContainText(
      `Si ${ACCOUNT} a un compte, nous lui avons envoyé un code à 6 chiffres. Il est valable 60 minutes.`,
    );
    await enterCode(page, E2E_EMAIL_CODE, { code: 'Code à 6 chiffres', confirm: 'Continuer' });
    await expect(page.getByRole('region', { name: 'Choisis un nouveau mot de passe', exact: true })).toBeVisible();
    await saveNewPassword(page, NEW_PASSWORD, { password: 'Nouveau mot de passe', save: 'Enregistrer le mot de passe' });
    await expect(page.getByText('Mot de passe modifié.', { exact: true })).toBeVisible();
    await expect(page.getByText(`Session ouverte avec ${ACCOUNT}.`, { exact: true })).toBeVisible();
  });
});
