import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';

/** Where supabase-js keeps the session in localStorage. */
export const AUTH_STORAGE_KEY = 'studentsbudget-auth';

// undefined: not made yet. null: this build has no Supabase project.
let client: SupabaseClient | null | undefined;

/**
 * The one Supabase client of this tab, or null when the build has no Supabase project or the code runs on the server.
 * Call it only in effects and event handlers: the session lives in the browser's localStorage, and no page reads it
 * while rendering, so every page stays static and opens offline.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (client === undefined) {
    const env = readSupabaseEnv();
    client =
      env === null
        ? null
        : createClient(env.url, env.publishableKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              // Sign-in is by email and password; no page receives a session in its URL.
              detectSessionInUrl: false,
              storageKey: AUTH_STORAGE_KEY,
            },
          });
  }
  return client;
}

/**
 * A client of its own for one check that must leave this tab's session alone: the password, and the authenticator's
 * code, given again before the account is deleted (P2.5). Signing in on the tab's client would swap its session, and
 * an account with two-step sign-in would drop back to the code step. This one keeps its session in memory, under its
 * own storage key, and is dropped after the check. Null on the server or without a Supabase project; only in event
 * handlers.
 */
export function checkingSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  const env = readSupabaseEnv();
  if (env === null) return null;
  return createClient(env.url, env.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `${AUTH_STORAGE_KEY}-check`,
    },
  });
}
