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
