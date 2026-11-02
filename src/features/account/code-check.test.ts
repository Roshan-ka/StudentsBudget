import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { accountWantsCode, wantsCodeBeforeLinking } from './code-check';

/** An access token as supabase-js holds it, its claims stating the assurance level. */
function token(aal: string): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${part({ alg: 'HS256' })}.${part({ sub: 'u', aal })}.signature`;
}

const verified = { id: 'factor-1', factor_type: 'totp', status: 'verified', created_at: 'x', updated_at: 'x' };

/** A stand-in for supabase.auth whose refresh hands back `session`, or fails with `error`. */
function authRefreshingTo(session: object | null, error: AuthError | null = null) {
  const refreshSession = async () => ({ data: { session: session as Session | null, user: null }, error });
  return { refreshSession } as unknown as Pick<SupabaseClient['auth'], 'refreshSession'>;
}

describe('accountWantsCode', () => {
  it('is true when the fresh session lists a confirmed authenticator and only the password was given', async () => {
    const session = { access_token: token('aal1'), user: { email: 'a@example.com', factors: [verified] } };
    expect(await accountWantsCode(authRefreshingTo(session))).toBe(true);
  });

  it('is false when nothing changed: no authenticator, or the code was given', async () => {
    const none = { access_token: token('aal1'), user: { email: 'a@example.com', factors: [] } };
    const given = { access_token: token('aal2'), user: { email: 'a@example.com', factors: [verified] } };
    expect(await accountWantsCode(authRefreshingTo(none))).toBe(false);
    expect(await accountWantsCode(authRefreshingTo(given))).toBe(false);
  });

  it('is false when the refresh fails, so the first message stands', async () => {
    const failed = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } as AuthError;
    expect(await accountWantsCode(authRefreshingTo(null, failed))).toBe(false);
  });
});

// Linking must not take an account that looks empty at its word while the session couldn't be checked: it may only
// hide its rows until this session gives its code (triage row 10, P2.2 chunk 10).
describe('wantsCodeBeforeLinking', () => {
  it('answers as accountWantsCode does when the refresh works', async () => {
    const session = { access_token: token('aal1'), user: { email: 'a@example.com', factors: [verified] } };
    expect(await wantsCodeBeforeLinking(authRefreshingTo(session))).toBe(true);
  });

  it('throws when the refresh fails, so the phone doesn’t link', async () => {
    const failed = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } as AuthError;
    await expect(wantsCodeBeforeLinking(authRefreshingTo(null, failed))).rejects.toMatchObject({ message: 'Failed to fetch' });
  });
});
