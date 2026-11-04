import { expect, test, type Page } from '@playwright/test';
import { E2E_EMAIL_CODE, mockSupabaseAuth, mockSupabaseData, skipUnlessAccountsShow, type AuthCall } from './helpers/supabase';

// The emailed codes (P2.4, docs/superpowers/plans/2026-11-04-email-codes.md): a new account is confirmed with the
// 6-digit code from its sign-up email. Supabase Auth is mocked as a project with "Confirm email" on, whose emails all
// hold E2E_EMAIL_CODE; the real emails are checked by src/features/account/email-codes.contract.test.ts.

test.use({ viewport: { width: 375, height: 812 } });

const EMAIL = 'new@example.com';
const PASSWORD = 'correct horse';

// A confirmed account links the phone (P2.2), which reads the account's tables: an empty account.
test.beforeEach(async ({ page }) => {
  await mockSupabaseData(page);
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
