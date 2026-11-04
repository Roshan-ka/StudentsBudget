'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { forgetAccountDeleted } from './account-deleted';
import { authStateOf, type AuthState } from './auth-state';
import { endRecovery, startRecovery } from './recovery';

/**
 * The account state of this tab, kept current by supabase-js: sign-in, sign-out, token refreshes and changes made in
 * another tab. The first state only depends on the build's settings, so the server render and hydration agree.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured() ? { status: 'loading' } : { status: 'off' },
  );

  // The router keeps a page it has left mounted but hidden and runs its effect cleanups, so the subscription ends
  // while the page is hidden. Subscribing again replays the stored session (INITIAL_SESSION) on return.
  useEffect(() => {
    const supabase = getSupabase();
    if (supabase === null) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // A "Forgot password" code signed in (P2.4): the new-password step stays until a new password is saved. Set in
      // the same callback as the state, so the account never shows for a moment without the step.
      if (event === 'PASSWORD_RECOVERY') startRecovery();
      else if (event === 'SIGNED_OUT') endRecovery();
      // A new sign-in after deleting an account (P2.5): the "deleted" line has said what it had to.
      if (event === 'SIGNED_IN') forgetAccountDeleted();
      setState(authStateOf(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
