import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { authErrorMessage, OFFLINE_MESSAGE } from './auth-errors';
import { authStateOf } from './auth-state';
import { checkCredentials, MIN_PASSWORD_LENGTH } from './credentials';

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

describe('authErrorMessage', () => {
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
