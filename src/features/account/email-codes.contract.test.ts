import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { newId } from '@/lib/new-id';
import { codeIn, mailIds, nextMail, type Mail } from '@/sync/mailpit';
import { freshCode, totpCode } from '@/sync/totp';
import { RECOVERY_CODE, SIGN_UP_CODE } from './email-codes';

// The two emailed codes (P2.4, docs/superpowers/plans/2026-11-04-email-codes.md) against the local Supabase stack,
// reading each email from its Mailpit: the sign-up confirmation and "Forgot password". Runs with `npm run
// test:contract` when SUPABASE_TEST_URL, SUPABASE_TEST_KEY and SUPABASE_TEST_MAIL_URL are set (`node
// scripts/supabase-test-env.mjs` prints them), and is skipped in `npm test` otherwise.

const STACK_URL = process.env.SUPABASE_TEST_URL;
const STACK_KEY = process.env.SUPABASE_TEST_KEY;
const MAIL_URL = process.env.SUPABASE_TEST_MAIL_URL;

const PASSWORD = 'contract-test-password';
const NEW_PASSWORD = 'contract-test-password-2';

/** A client of its own, as another phone or browser would be: nothing signed in. */
function client(): SupabaseClient {
  return createClient(STACK_URL ?? '', STACK_KEY ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
}

const newEmail = () => `contract-${newId()}@example.com`;

/** A code that isn't `code`: the same digits with the first one moved on. */
function otherCode(code: string): string {
  return String((Number(code[0]) + 1) % 10) + code.slice(1);
}

/** Signs `email` up, with `data` as user metadata, and confirms it with the mailed code. The client is then signed in. */
async function confirmedUser(email: string, data?: Record<string, string>): Promise<SupabaseClient> {
  const user = client();
  const signedUp = await user.auth.signUp({ email, password: PASSWORD, options: { data } });
  if (signedUp.error) throw signedUp.error;
  const { error } = await user.auth.verifyOtp({ email, token: codeIn(await nextMail(email)), type: SIGN_UP_CODE });
  if (error) throw error;
  return user;
}

/**
 * Asks for the "Forgot password" email as soon as the stack sends one again (at most one email per address a second,
 * `max_frequency`, and the sign-up email has just gone), and returns it.
 */
async function recoveryMail(asker: SupabaseClient, email: string): Promise<Mail> {
  const seen = await mailIds(email);
  const deadline = Date.now() + 5_000;
  for (;;) {
    const { error } = await asker.auth.resetPasswordForEmail(email);
    if (!error) break;
    if (error.code !== 'over_email_send_rate_limit' || Date.now() > deadline) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return nextMail(email, seen);
}

describe.runIf(Boolean(STACK_URL && STACK_KEY && MAIL_URL))('emailed codes against a real Supabase stack (P2.4)', () => {
  it('gives a sign-up no session until the mailed code confirms it, and takes that code once', async () => {
    const email = newEmail();
    const user = client();
    const signedUp = await user.auth.signUp({ email, password: PASSWORD });
    expect(signedUp.error).toBeNull();
    expect(signedUp.data.session).toBeNull();

    // Before the code, the password alone doesn't sign in.
    expect((await client().auth.signInWithPassword({ email, password: PASSWORD })).error?.code).toBe('email_not_confirmed');

    const token = codeIn(await nextMail(email));
    // A wrong code is refused, with the code the app maps to "wrong or expired" ...
    const wrong = await user.auth.verifyOtp({ email, token: otherCode(token), type: SIGN_UP_CODE });
    expect(wrong.data.session).toBeNull();
    expect(wrong.error?.code).toBe('otp_expired');
    // ... the right one confirms the email and signs in ...
    const confirmed = await user.auth.verifyOtp({ email, token, type: SIGN_UP_CODE });
    expect(confirmed.error).toBeNull();
    expect(confirmed.data.session).not.toBeNull();
    expect(confirmed.data.user?.email_confirmed_at).toBeTruthy();
    // ... and doesn't work a second time.
    const again = await client().auth.verifyOtp({ email, token, type: SIGN_UP_CODE });
    expect(again.data.session).toBeNull();
    expect(again.error?.code).toBe('otp_expired');

    expect((await client().auth.signInWithPassword({ email, password: PASSWORD })).error).toBeNull();
  });

  it('writes the sign-up email in the language sent at sign-up, and in English without one', async () => {
    const german = newEmail();
    expect((await client().auth.signUp({ email: german, password: PASSWORD, options: { data: { lang: 'de' } } })).error).toBeNull();
    const inGerman = await nextMail(german);
    expect(inGerman.html).toContain('<html lang="de">');
    expect(inGerman.html).toContain('Dein StudentsBudget-Code');
    // The subject carries the code too, so a phone's notification shows it.
    expect(inGerman.subject).toBe(`StudentsBudget: ${codeIn(inGerman)}`);

    const plain = newEmail();
    expect((await client().auth.signUp({ email: plain, password: PASSWORD })).error).toBeNull();
    const inEnglish = await nextMail(plain);
    expect(inEnglish.html).toContain('<html lang="en">');
    expect(inEnglish.html).toContain('Your StudentsBudget code');
  });

  it('signs in with a "Forgot password" code, and the new password replaces the old one', async () => {
    const email = newEmail();
    await confirmedUser(email, { lang: 'fr' });

    const phone = client();
    const mail = await recoveryMail(phone, email);
    expect(mail.html).toContain('<html lang="fr">');
    expect(mail.html).toContain('Nouveau mot de passe StudentsBudget');
    const recovered = await phone.auth.verifyOtp({ email, token: codeIn(mail), type: RECOVERY_CODE });
    expect(recovered.error).toBeNull();
    expect(recovered.data.session).not.toBeNull();
    expect((await phone.auth.updateUser({ password: NEW_PASSWORD })).error).toBeNull();

    expect((await client().auth.signInWithPassword({ email, password: PASSWORD })).error?.code).toBe('invalid_credentials');
    expect((await client().auth.signInWithPassword({ email, password: NEW_PASSWORD })).error).toBeNull();
  });

  it('gives an account with two-step sign-in only aal1 for the code, and a new password only with the authenticator', async () => {
    const email = newEmail();
    const owner = await confirmedUser(email);
    const enrolled = await owner.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Owner phone' });
    if (enrolled.error) throw enrolled.error;
    const { id: factorId, totp } = enrolled.data;
    const firstCode = totpCode(totp.secret);
    expect((await owner.auth.mfa.challengeAndVerify({ factorId, code: firstCode })).error).toBeNull();

    // Someone with the email inbox only: the code signs in, but the authenticator's step is still owed ...
    const phone = client();
    const mail = await recoveryMail(phone, email);
    expect((await phone.auth.verifyOtp({ email, token: codeIn(mail), type: RECOVERY_CODE })).error).toBeNull();
    expect((await phone.auth.mfa.getAuthenticatorAssuranceLevel()).data).toMatchObject({ currentLevel: 'aal1', nextLevel: 'aal2' });
    // ... and the password stays: the server wants aal2 for a new one on such an account.
    expect((await phone.auth.updateUser({ password: NEW_PASSWORD })).error?.code).toBe('insufficient_aal');

    // With the authenticator's code, the new password goes through.
    const code = await freshCode(totp.secret, firstCode);
    expect((await phone.auth.mfa.challengeAndVerify({ factorId, code })).error).toBeNull();
    expect((await phone.auth.updateUser({ password: NEW_PASSWORD })).error).toBeNull();
    expect((await client().auth.signInWithPassword({ email, password: NEW_PASSWORD })).error).toBeNull();
  }, 90_000);
});
