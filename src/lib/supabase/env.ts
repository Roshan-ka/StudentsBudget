import { z } from 'zod';

/** Where the app's Supabase project is, and the key the browser may use for it. */
export type SupabaseEnv = { url: string; publishableKey: string };

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

/** HTTPS, or plain HTTP only for the local Supabase stack on this machine. */
const projectUrl = z
  .string()
  .trim()
  .refine((text) => {
    try {
      const url = new URL(text);
      return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
    } catch {
      return false;
    }
  });

/** A secret key bypasses row-level security, so it must never be the browser's key. */
const publishableKey = z
  .string()
  .trim()
  .min(1)
  .refine((key) => !key.startsWith('sb_secret_'));

const supabaseEnv = z.object({ url: projectUrl, publishableKey });

/** Checks the two values. Anything missing or wrong gives null: the app then runs local-only, as in P1. */
export function parseSupabaseEnv(raw: { url?: string; publishableKey?: string }): SupabaseEnv | null {
  const result = supabaseEnv.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * The Supabase settings from `.env.local` or the host's environment. Each name is written out in full because Next only
 * inlines `process.env.NEXT_PUBLIC_…` into the browser bundle when it sees the literal name. The values are fixed at
 * build time, so the result is the same on the server and in the browser.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  return parseSupabaseEnv({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** True when this build has a Supabase project. Safe during render: it only reads the inlined settings. */
export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}
