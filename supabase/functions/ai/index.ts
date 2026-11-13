// The `ai` Edge Function (the AI phase, docs/superpowers/plans/2026-11-09-ai-phase-1.md, chunk 3): quick add, Ask and
// the setup chat ask the model through it. Only the wiring is here: the allowance through supabase-js with the
// student's own token, and the model on Groq's OpenAI-compatible API (since the Groq switch, chunk 2,
// docs/superpowers/plans/2026-11-13-groq-free-plan.md). What it does is in ../_shared/ai/, which the app's tests run
// (src/features/ai/server/).
//
// Settings: GROQ_API_KEY and AI_ALLOWED_ORIGINS (`supabase secrets set`), and SUPABASE_URL with
// SUPABASE_PUBLISHABLE_KEYS or the older SUPABASE_ANON_KEY, which Supabase puts there. `verify_jwt` is off
// (supabase/config.toml): `take_ai_allowance`, called with the student's token, is the check, and PostgREST verifies
// that token whichever key signed it.

import { createClient } from '@supabase/supabase-js';
import { allowanceOf } from '../_shared/ai/allowance.ts';
import { askBuilder } from '../_shared/ai/ask.ts';
import { allowedOrigins } from '../_shared/ai/cors.ts';
import { groqClient } from '../_shared/ai/groq.ts';
import { handleAi, type FeatureBuilders } from '../_shared/ai/handle.ts';
import { quickAddBuilder } from '../_shared/ai/quick-add.ts';
import { setupBuilder } from '../_shared/ai/setup.ts';

// The two things this file takes from Deno, declared here so the app's typecheck reads it too.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

/** The three features: quick add (chunk 4), Ask (chunk 8) and the setup chat (chunk 11). */
const BUILDERS: FeatureBuilders = { 'quick-add': quickAddBuilder, ask: askBuilder, setup: setupBuilder };

/** The key that plays the caller's own token: the `default` publishable key, or the older anon key. */
function publicKeyOf(publishableKeys: string | undefined, anonKey: string | undefined): string | undefined {
  if (publishableKeys) {
    try {
      const keys: unknown = JSON.parse(publishableKeys);
      if (keys && typeof keys === 'object' && 'default' in keys && typeof keys.default === 'string') return keys.default;
    } catch {
      // Not JSON: the older key, if there is one.
    }
  }
  return anonKey || undefined;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const publicKey = publicKeyOf(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), Deno.env.get('SUPABASE_ANON_KEY')) ?? '';
const origins = allowedOrigins(Deno.env.get('AI_ALLOWED_ORIGINS'));
// Without the key, every call answers `unavailable` before it takes any allowance.
const model = groqClient(Deno.env.get('GROQ_API_KEY'));

Deno.serve((request) =>
  handleAi(request, {
    allowedOrigins: origins,
    model,
    builders: BUILDERS,
    async takeAllowance(token, feature) {
      const db = createClient(supabaseUrl, publicKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await db.rpc('take_ai_allowance', { p_feature: feature });
      return allowanceOf({ data, error });
    },
    log: (entry) => console.log(JSON.stringify({ fn: 'ai', ...entry })),
    now: () => Date.now(),
  }),
);
