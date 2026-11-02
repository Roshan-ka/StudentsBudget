import type { SupabaseClient } from '@supabase/supabase-js';
import { authStateOf } from './auth-state';

/**
 * Whether the account wants this session's authenticator code after all. Another phone may have turned two-step sign-in
 * on since this one signed in: the session stored here doesn't list the authenticator yet, while the database already
 * shows it nothing (an empty account, refused writes). A refreshed session lists the account's authenticators, and
 * supabase-js hands it to useAuth, which then asks for the code. False when nothing changed or the refresh failed.
 */
export async function accountWantsCode(auth: Pick<SupabaseClient['auth'], 'refreshSession'>): Promise<boolean> {
  try {
    return await wantsCodeBeforeLinking(auth);
  } catch {
    return false;
  }
}

/**
 * As `accountWantsCode`, but a refresh that fails throws: before linking to an account that looks empty, which may only
 * hide its rows until this session gives its code, an unchecked session must stop the link, not let it go ahead.
 */
export async function wantsCodeBeforeLinking(auth: Pick<SupabaseClient['auth'], 'refreshSession'>): Promise<boolean> {
  const { data, error } = await auth.refreshSession();
  if (error !== null) throw error;
  return authStateOf(data.session).status === 'second-step';
}
