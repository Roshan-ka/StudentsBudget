'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { authStateOf, type AuthState } from './auth-state';

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
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(authStateOf(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
