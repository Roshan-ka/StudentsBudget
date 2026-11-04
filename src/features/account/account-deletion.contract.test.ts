import { describe, expect, it } from 'vitest';
import {
  CONTRACT_PASSWORD,
  confirmedUser,
  MAIL_URL,
  newEmail,
  STACK_KEY,
  STACK_URL,
  stackClient,
} from '@/sync/contract-users';
import { supabaseStore } from '@/sync/store';
import { freshCode, totpCode } from '@/sync/totp';

// Deleting the account (P2.5, docs/superpowers/plans/2026-11-04-account-deletion.md) against the local Supabase stack:
// `delete_my_account()` as a signed-in user, and what Supabase answers a phone that still holds the deleted account's
// session, which the app's handling of other phones (chunk 3) relies on. pgTAP (account_deletion.test.sql) checks
// that every row goes. Runs with `npm run test:contract`, like email-codes.contract.test.ts.

describe.runIf(Boolean(STACK_URL && STACK_KEY && MAIL_URL))('deleting the account against a real Supabase stack (P2.5)', () => {
  it('deletes the account, keeps another user’s rows, and the password no longer signs in', async () => {
    const email = newEmail();
    const owner = await confirmedUser(email);
    const bystander = await confirmedUser();
    await supabaseStore(owner).upsert('entries', [{ id: 'e1', data: { n: 1 } }]);
    await supabaseStore(bystander).upsert('entries', [{ id: 'e1', data: { n: 2 } }]);

    expect((await owner.rpc('delete_my_account')).error).toBeNull();

    expect((await stackClient().auth.signInWithPassword({ email, password: CONTRACT_PASSWORD })).error?.code).toBe(
      'invalid_credentials',
    );
    expect(await supabaseStore(bystander).listIds('entries')).toEqual(['e1']);
  });

  it('tells a phone that still holds the deleted account’s session that the user is gone', async () => {
    const email = newEmail();
    const owner = await confirmedUser(email);
    // A second phone, signed in to the same account.
    const otherPhone = stackClient();
    expect((await otherPhone.auth.signInWithPassword({ email, password: CONTRACT_PASSWORD })).error).toBeNull();

    expect((await owner.rpc('delete_my_account')).error).toBeNull();

    // Its access token is still signed, but the user behind it is gone, and so is its refresh token.
    expect((await otherPhone.auth.getUser()).error?.code).toBe('user_not_found');
    expect((await otherPhone.auth.refreshSession()).error?.code).toBe('refresh_token_not_found');
  });

  it('refuses a password-only session of an account with two-step sign-in, and deletes it with the code', async () => {
    const email = newEmail();
    const owner = await confirmedUser(email);
    const enrolled = await owner.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Owner phone' });
    if (enrolled.error) throw enrolled.error;
    const { id: factorId, totp } = enrolled.data;
    const firstCode = totpCode(totp.secret);
    expect((await owner.auth.mfa.challengeAndVerify({ factorId, code: firstCode })).error).toBeNull();

    // Someone with the password only: aal1, and the database refuses (insufficient privilege).
    const thief = stackClient();
    expect((await thief.auth.signInWithPassword({ email, password: CONTRACT_PASSWORD })).error).toBeNull();
    const refused = await thief.rpc('delete_my_account');
    expect(refused.error?.code).toBe('42501');
    expect((await owner.auth.getUser()).error).toBeNull();

    // With the authenticator's code (aal2), the account goes.
    const code = await freshCode(totp.secret, firstCode);
    expect((await thief.auth.mfa.challengeAndVerify({ factorId, code })).error).toBeNull();
    expect((await thief.rpc('delete_my_account')).error).toBeNull();
    expect((await stackClient().auth.signInWithPassword({ email, password: CONTRACT_PASSWORD })).error?.code).toBe(
      'invalid_credentials',
    );
  }, 90_000);
});
