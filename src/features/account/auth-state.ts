import type { Session } from '@supabase/supabase-js';

/**
 * Where this tab stands with its account. 'off': the build has no Supabase project, so the app is local-only and shows
 * no account UI. 'loading': supabase-js has not yet read the stored session.
 */
export type AuthState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; email: string };

/** The state a session from supabase-js stands for. */
export function authStateOf(session: Session | null): AuthState {
  return session === null ? { status: 'signed-out' } : { status: 'signed-in', email: session.user.email ?? '' };
}
