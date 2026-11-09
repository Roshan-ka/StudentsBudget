// The `ai` Edge Function (the AI phase, docs/superpowers/plans/2026-11-09-ai-phase-1.md, chunk 3): quick add, Ask and
// the setup chat ask the model through it. Only the wiring is here: the allowance through supabase-js with the
// student's own token, and the model through the Anthropic SDK. What it does is in ../_shared/ai/, which the app's
// tests run (src/features/ai/server/).
//
// Settings: ANTHROPIC_API_KEY and AI_ALLOWED_ORIGINS (`supabase secrets set`), and SUPABASE_URL with
// SUPABASE_PUBLISHABLE_KEYS or the older SUPABASE_ANON_KEY, which Supabase puts there. `verify_jwt` is off
// (supabase/config.toml): `take_ai_allowance`, called with the student's token, is the check, and PostgREST verifies
// that token whichever key signed it.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createClient } from '@supabase/supabase-js';
import { allowanceOf } from '../_shared/ai/allowance.ts';
import { allowedOrigins } from '../_shared/ai/cors.ts';
import { handleAi, type FeatureBuilders } from '../_shared/ai/handle.ts';
import { ModelUnavailable, type ModelClient } from '../_shared/ai/model.ts';

// The two things this file takes from Deno, declared here so the app's typecheck reads it too.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

/** The beta that lets a declined Opus request run again on Anthropic's recommended model (`fallbacks: "default"`). */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The features the function answers so far: chunks 4, 8 and 11 add quick add, Ask and the setup chat. */
const BUILDERS: FeatureBuilders = {};

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

function anthropicClient(apiKey: string | undefined): ModelClient | null {
  if (!apiKey) return null;
  // One retry at most: quick add gives up after 8 seconds on the phone and reads the line itself.
  const anthropic = new Anthropic({ apiKey, maxRetries: 1 });
  return {
    async create(call, signal) {
      try {
        const message = await anthropic.beta.messages.create(
          {
            model: call.model,
            max_tokens: call.maxTokens,
            system: [{ type: 'text', text: call.system, cache_control: { type: 'ephemeral' } }],
            messages: call.messages,
            output_config: { effort: call.effort, format: zodOutputFormat(call.answer) },
            ...(call.thinking ? {} : { thinking: { type: 'disabled' as const } }),
            ...(call.fallbacks ? { fallbacks: 'default' as const, betas: [FALLBACK_BETA] } : {}),
          },
          { signal },
        );
        // Only what handle.ts reads: the text, where a fallback came, how it stopped and the tokens.
        return {
          model: message.model,
          stop_reason: message.stop_reason,
          content: message.content.map((block) =>
            block.type === 'text' ? { type: block.type, text: block.text } : { type: block.type },
          ),
          usage: {
            input_tokens: message.usage.input_tokens,
            output_tokens: message.usage.output_tokens,
            cache_read_input_tokens: message.usage.cache_read_input_tokens,
            cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
            iterations: message.usage.iterations?.map((entry) => ({ type: entry.type })) ?? null,
          },
        };
      } catch (error) {
        // Rate limits, overload (529), the API's own errors and a lost connection: the model can't answer now.
        if (
          error instanceof Anthropic.APIConnectionError ||
          error instanceof Anthropic.RateLimitError ||
          error instanceof Anthropic.InternalServerError
        ) {
          throw new ModelUnavailable(error.message);
        }
        throw error;
      }
    },
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const publicKey = publicKeyOf(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), Deno.env.get('SUPABASE_ANON_KEY')) ?? '';
const origins = allowedOrigins(Deno.env.get('AI_ALLOWED_ORIGINS'));
const model = anthropicClient(Deno.env.get('ANTHROPIC_API_KEY'));

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
