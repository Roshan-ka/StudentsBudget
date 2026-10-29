import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { authErrorMessage, OFFLINE_MESSAGE, passkeyCancelled, passkeyErrorMessage } from './auth-errors';
import { assuranceLevelOf, authStateOf } from './auth-state';
import { checkAuthenticatorCode, checkCredentials, MIN_PASSWORD_LENGTH } from './credentials';

describe('authStateOf', () => {
  it('is signed out without a session', () => {
    expect(authStateOf(null)).toEqual({ status: 'signed-out' });
  });

  it('is signed in with the session user’s email', () => {
    const session = { user: { email: 'roshan@example.com' } } as Session;
    expect(authStateOf(session)).toEqual({ status: 'signed-in', email: 'roshan@example.com' });
  });

  it('keeps an empty email when the user has none', () => {
    const session = { user: {} } as Session;
    expect(authStateOf(session)).toEqual({ status: 'signed-in', email: '' });
  });
});

describe('two-step sign-in in authStateOf', () => {
  /** An access token as supabase-js holds it: header.claims.signature, each base64url, the claims carrying `aal`. */
  function token(claims: object): string {
    const part = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${part({ alg: 'HS256' })}.${part(claims)}.signature`;
  }
  const factor = (status: 'verified' | 'unverified') => ({
    id: 'factor-1',
    factor_type: 'totp' as const,
    status,
    created_at: 'x',
    updated_at: 'x',
  });
  const session = (aal: string, factors: ReturnType<typeof factor>[]) =>
    ({ access_token: token({ sub: 'u', aal }), user: { email: 'a@example.com', factors } }) as unknown as Session;

  it('asks for the code when the account has a confirmed authenticator and only the password was given', () => {
    expect(authStateOf(session('aal1', [factor('verified')]))).toEqual({
      status: 'second-step',
      email: 'a@example.com',
      factorId: 'factor-1',
    });
  });

  it('is signed in once the code was given, without an authenticator, or with one never confirmed', () => {
    for (const s of [session('aal2', [factor('verified')]), session('aal1', []), session('aal1', [factor('unverified')])]) {
      expect(authStateOf(s)).toEqual({ status: 'signed-in', email: 'a@example.com' });
    }
  });

  it('asks for the code when the token can’t be read, rather than open the account', () => {
    const unreadable = { access_token: 'not-a-token', user: { email: 'a@example.com', factors: [factor('verified')] } };
    expect(authStateOf(unreadable as unknown as Session).status).toBe('second-step');
    expect(assuranceLevelOf('not-a-token')).toBeNull();
    expect(assuranceLevelOf(token({ aal: 'aal2' }))).toBe('aal2');
  });

  it('reads a token whose claims encode to - and _, as Supabase’s tokens often do', () => {
    // Claims picked so that their base64url holds both characters, which plain base64 (atob) can't read.
    const withBoth = token({ sub: 'u', aal: 'aal2', n: '~~~?>?>?>3' });
    expect(withBoth.split('.')[1]).toContain('-');
    expect(withBoth.split('.')[1]).toContain('_');
    expect(assuranceLevelOf(withBoth)).toBe('aal2');
  });
});

describe('checkCredentials', () => {
  it('accepts an email and a password, trimming only the email', () => {
    expect(checkCredentials('  roshan@example.com ', ' secret pass ', 'sign-in')).toEqual({
      ok: true,
      email: 'roshan@example.com',
    });
  });

  it('asks for the email first, then a valid one', () => {
    expect(checkCredentials('  ', 'whatever1', 'sign-in')).toEqual({ ok: false, error: 'Enter your email.' });
    for (const bad of ['roshan', 'roshan@', '@example.com', 'roshan@example', 'ro shan@example.com']) {
      expect(checkCredentials(bad, 'whatever1', 'sign-in'), bad).toEqual({ ok: false, error: 'Check the email address.' });
    }
  });

  it('asks for the password', () => {
    expect(checkCredentials('roshan@example.com', '', 'sign-in')).toEqual({ ok: false, error: 'Enter your password.' });
    expect(checkCredentials('roshan@example.com', '', 'create')).toEqual({ ok: false, error: 'Enter your password.' });
  });

  it('needs 8 characters for a new account, but lets any password try to sign in', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(checkCredentials('roshan@example.com', short, 'create')).toEqual({
      ok: false,
      error: 'Use at least 8 characters for the password.',
    });
    expect(checkCredentials('roshan@example.com', short, 'sign-in')).toEqual({ ok: true, email: 'roshan@example.com' });
    expect(checkCredentials('roshan@example.com', 'x'.repeat(MIN_PASSWORD_LENGTH), 'create')).toEqual({
      ok: true,
      email: 'roshan@example.com',
    });
  });
});

describe('checkAuthenticatorCode', () => {
  it('takes six digits, with the gap an app shows or a paste keeps', () => {
    for (const typed of ['123456', '123 456', ' 123-456 ']) expect(checkAuthenticatorCode(typed)).toEqual({ ok: true, code: '123456' });
  });

  it('asks for six digits otherwise, before anything is sent', () => {
    for (const typed of ['', '12345', '1234567', '12a456']) {
      expect(checkAuthenticatorCode(typed)).toEqual({ ok: false, error: 'Enter the 6-digit code from your authenticator app.' });
    }
  });
});

describe('authErrorMessage', () => {
  it('says calmly what went wrong with an authenticator code', () => {
    expect(authErrorMessage({ code: 'mfa_verification_failed', status: 422 })).toBe(
      'That code didn’t work. Codes change every 30 seconds: enter the newest one.',
    );
    expect(authErrorMessage({ code: 'mfa_challenge_expired', status: 422 })).toBe(
      'That took a little long. Enter the newest code from your authenticator app.',
    );
    expect(authErrorMessage({ code: 'mfa_factor_not_found', status: 404 })).toBe(
      'Two-step sign-in was turned off for this account. Sign out, then sign in again.',
    );
    expect(authErrorMessage({ code: 'mfa_ip_address_mismatch', status: 422 })).toBe(
      'Your connection changed while checking the code. Enter the newest code again.',
    );
    expect(authErrorMessage({ code: 'mfa_totp_verify_not_enabled', status: 422 })).toBe(
      'Codes can’t be checked right now. Try again later.',
    );
  });

  it('reads a closed passkey prompt as nothing to say', () => {
    // auth-js wraps the browser's answer: a cancel or a timeout keeps its NotAllowedError name; an abort gets a code.
    expect(passkeyCancelled({ name: 'NotAllowedError', code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY' })).toBe(true);
    expect(passkeyCancelled({ name: 'AbortError', code: 'ERROR_CEREMONY_ABORTED' })).toBe(true);
    expect(passkeyCancelled({ code: 'webauthn_verification_failed', status: 400 })).toBe(false);
  });

  it('says calmly what went wrong with a passkey, and points back to the password otherwise', () => {
    expect(passkeyErrorMessage({ code: 'passkey_disabled', status: 422 })).toBe(
      'Passkeys are switched off right now. Sign in with your email and password.',
    );
    expect(passkeyErrorMessage({ name: 'InvalidStateError', code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' })).toBe(
      'This device already has a passkey for your account.',
    );
    expect(passkeyErrorMessage(new Error('boom'))).toBe(
      'That passkey didn’t work. Try again, or sign in with your email and password.',
    );
    expect(passkeyErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toBe(
      "The account server can't be reached. Check your connection and try again.",
    );
  });

  it('says a sign-in the account server no longer knows has ended', () => {
    // supabase-js raises it, with no error code, when the server answers session_not_found.
    expect(authErrorMessage({ name: 'AuthSessionMissingError', status: 400 })).toBe(
      'This sign-in has ended. Sign out, then sign in again.',
    );
  });

  it('says calmly what went wrong for the known error codes', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe('Email or password is wrong.');
    expect(authErrorMessage({ code: 'user_already_exists', status: 422 })).toBe(
      'This email already has an account. Sign in instead.',
    );
    expect(authErrorMessage({ code: 'email_exists', status: 422 })).toBe(
      'This email already has an account. Sign in instead.',
    );
    expect(authErrorMessage({ code: 'weak_password', status: 422 })).toBe(
      'This password is too easy to guess. Choose a longer one.',
    );
    expect(authErrorMessage({ code: 'signup_disabled', status: 422 })).toBe('New accounts are switched off right now.');
  });

  it('reads any 429 as too many tries', () => {
    expect(authErrorMessage({ code: 'over_request_rate_limit', status: 429 })).toBe(
      'Too many tries. Wait a minute, then try again.',
    );
    expect(authErrorMessage({ status: 429 })).toBe('Too many tries. Wait a minute, then try again.');
  });

  it('says the server cannot be reached when the request never got an answer', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', status: 0 })).toBe(
      "The account server can't be reached. Check your connection and try again.",
    );
  });

  it('falls back to a general line for anything else', () => {
    for (const unknown of [{ code: 'something_new', status: 400 }, new Error('boom'), null, 'text', 42]) {
      expect(authErrorMessage(unknown)).toBe('Something went wrong. Try again.');
    }
  });

  it('has a line for being offline', () => {
    expect(OFFLINE_MESSAGE).toBe("You're offline. Signing in needs a connection.");
  });
});
