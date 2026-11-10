import { z } from 'zod';
import { getSupabase } from '@/lib/supabase/client';
import { readSupabaseEnv } from '@/lib/supabase/env';
import {
  aiAnswerBody,
  aiProblemBody,
  aiRequest,
  MAX_BODY_BYTES,
  type AiFeature,
  type AiProblem,
  type AiRequest,
} from './contract';
import { aiInBuild, aiOnHere } from './switch';

// The phone's side of the `ai` Edge Function (the AI phase, chunk 5, docs/superpowers/plans/2026-11-09-ai-phase-1.md):
// one POST to /functions/v1/ai with the student's session token, checked against the shared contract on both ends.
// Every AI feature goes through `callAi`, so the build check, the phone's switch and the contract hold for all of them:
// when any says no, nothing is sent. The service worker never handles this cross-origin POST.

/**
 * Why a call has no answer: the function's problems (`AiProblem`), or what the phone knew before or instead of an
 * answer: `off` (not in this build, or the switch is off), `offline`, `timeout` (no answer in time), `aborted` (the
 * caller's signal, so the answer would be stale).
 */
export type AiCallProblem = AiProblem | 'off' | 'offline' | 'timeout' | 'aborted';

export type AiCallResult<Answer> =
  | { ok: true; answer: Answer; left: number | null }
  | { ok: false; problem: AiCallProblem };

/**
 * How long each feature waits for its answer by default. Quick add then reads the line on the phone; Ask and the setup
 * chat think before they answer, which takes several seconds.
 */
export const AI_TIMEOUT_MS: Record<AiFeature, number> = { 'quick-add': 8_000, ask: 60_000, setup: 60_000 };

/** What `callAi` reaches outside itself, passed in so the tests can play it. */
export type AiCallDeps = {
  fetch: typeof fetch;
  /** The function's address and the project's publishable key, or null without a Supabase project. */
  endpoint: () => { url: string; publishableKey: string } | null;
  /** The signed-in session's access token, or null. */
  token: () => Promise<string | null>;
  online: () => boolean;
  /** In this build and switched on here. */
  allowed: () => boolean;
};

export const browserAiDeps: AiCallDeps = {
  fetch: (...args) => fetch(...args),
  endpoint: () => {
    const env = readSupabaseEnv();
    return env === null ? null : { url: `${env.url.replace(/\/$/, '')}/functions/v1/ai`, publishableKey: env.publishableKey };
  },
  token: async () => (await getSupabase()?.auth.getSession())?.data.session?.access_token ?? null,
  online: () => navigator.onLine,
  allowed: () => aiInBuild() && aiOnHere(),
};

/** The function's answer, with the feature's own part left to the feature's schema. */
const answerBody = aiAnswerBody(z.unknown());

/** The problem a refusal without the contract's body stands for (a gateway's or a proxy's), by its status. */
function problemOfStatus(status: number): AiProblem {
  if (status === 400) return 'bad-request';
  if (status === 401) return 'signed-out';
  if (status === 403) return 'second-step';
  if (status === 413) return 'too-large';
  if (status === 429) return 'daily-limit';
  return status >= 500 ? 'unavailable' : 'failed';
}

/**
 * Asks the `ai` function: the request, then its answer checked with `answer` (the feature's schema from the contract).
 * Sends nothing when the build or the switch says no (`off`), when the request breaks the contract (`bad-request`, or
 * `too-large`), offline, or with nobody signed in (`signed-out`). Gives up after `timeoutMs` (the feature's
 * `AI_TIMEOUT_MS`), and when `signal` aborts. Never throws.
 */
export async function callAi<Answer>(
  request: AiRequest,
  answer: z.ZodType<Answer>,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
  deps: AiCallDeps = browserAiDeps,
): Promise<AiCallResult<Answer>> {
  const { signal } = options;
  if (!deps.allowed()) return { ok: false, problem: 'off' };
  const checked = aiRequest.safeParse(request);
  if (!checked.success) {
    // The app's own mistake: logged without the request, which holds the student's words.
    console.error('StudentsBudget: an AI request broke the contract', checked.error.issues.map((issue) => issue.path));
    return { ok: false, problem: 'bad-request' };
  }
  const body = JSON.stringify(checked.data);
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return { ok: false, problem: 'too-large' };
  if (signal?.aborted) return { ok: false, problem: 'aborted' };
  if (!deps.online()) return { ok: false, problem: 'offline' };
  const endpoint = deps.endpoint();
  if (endpoint === null) return { ok: false, problem: 'off' };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? AI_TIMEOUT_MS[request.feature]);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const token = await deps.token();
    if (token === null) return { ok: false, problem: 'signed-out' };
    if (signal?.aborted) return { ok: false, problem: 'aborted' };
    const response = await deps.fetch(endpoint.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, apikey: endpoint.publishableKey, 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    });
    let json: unknown;
    try {
      json = await response.json();
    } catch (thrown) {
      // Cut off by the caller or the clock while it was read: handled below as an abort or a timeout.
      if (controller.signal.aborted) throw thrown;
      json = undefined;
    }
    if (signal?.aborted) return { ok: false, problem: 'aborted' };
    const answered = answerBody.safeParse(json);
    if (response.ok && answered.success) {
      const read = answer.safeParse(answered.data.answer);
      return read.success ? { ok: true, answer: read.data, left: answered.data.left } : { ok: false, problem: 'failed' };
    }
    const refused = aiProblemBody.safeParse(json);
    if (refused.success) return { ok: false, problem: refused.data.problem };
    return { ok: false, problem: response.ok ? 'failed' : problemOfStatus(response.status) };
  } catch {
    if (signal?.aborted) return { ok: false, problem: 'aborted' };
    if (timedOut) return { ok: false, problem: 'timeout' };
    return { ok: false, problem: deps.online() ? 'unavailable' : 'offline' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}
