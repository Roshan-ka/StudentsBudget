import type { Session } from '@supabase/supabase-js';

/**
 * Where this tab stands with its account. 'off': the build has no Supabase project, so the app is local-only and shows
 * no account UI. 'loading': supabase-js has not yet read the stored session. 'second-step': the password was right,
 * and the account's authenticator code is still to come; until then the account shows this session nothing.
 */
export type AuthState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'second-step'; email: string; factorId: string }
  | { status: 'signed-in'; email: string };

/**
 * The assurance level an access token states: 'aal2' once the authenticator code was given, 'aal1' after the password
 * alone; null for a token it can't read. supabase-js's getAuthenticatorAssuranceLevel reads the same claim, but it is
 * async, and the auth callback that hands over the session must not call into supabase-js.
 */
export function assuranceLevelOf(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1] ?? '';
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
    const aal = typeof claims === 'object' && claims !== null && 'aal' in claims ? claims.aal : null;
    return typeof aal === 'string' ? aal : null;
  } catch {
    return null;
  }
}

/** The state a session from supabase-js stands for. */
export function authStateOf(session: Session | null): AuthState {
  if (session === null) return { status: 'signed-out' };
  const email = session.user.email ?? '';
  // A confirmed authenticator, and a session that hasn't given its code: the database shows it nothing until it does
  // (migration 20261028150013_two_step_sign_in). An authenticator that was never confirmed doesn't count.
  const factor = session.user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (factor !== undefined && assuranceLevelOf(session.access_token) !== 'aal2') {
    return { status: 'second-step', email, factorId: factor.id };
  }
  return { status: 'signed-in', email };
}
