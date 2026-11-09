// Reading `take_ai_allowance`'s answer (the AI phase, chunks 1 and 3, docs/superpowers/plans/2026-11-09-ai-phase-1.md;
// migration 20261109125656_ai_allowance.sql). The function calls it with the student's own token, so it is also the
// function's check of who is calling: PostgREST verifies the token, whichever key signed it.

import type { AiProblem } from './contract.ts';

export type Allowance =
  | { ok: true; left: number | null }
  | { ok: false; problem: Extract<AiProblem, 'signed-out' | 'second-step' | 'daily-limit' | 'busy' | 'unavailable'> };

/** An error as supabase-js hands back PostgREST's. */
export type RpcError = { code?: string | null; hint?: string | null; message?: string | null };

const HINTS = ['signed-out', 'second-step', 'daily-limit', 'busy'] as const;

/**
 * PostgREST's answers to a token it doesn't take: PGRST301 (it can't be read or its signature is wrong), PGRST302 (no
 * token where one is needed), PGRST303 (its claims don't hold: run out). A publishable key alone plays `anon`, which
 * may not run the function (42501).
 */
const NOT_SIGNED_IN = new Set(['PGRST301', 'PGRST302', 'PGRST303', '42501']);

/** What is left today (null: no limit), or why not: the function's hint, a token it didn't take, or anything else. */
export function allowanceOf(result: { data: unknown; error: RpcError | null }): Allowance {
  const { data, error } = result;
  if (error === null) {
    if (data === null) return { ok: true, left: null };
    return typeof data === 'number' && Number.isInteger(data) && data >= 0
      ? { ok: true, left: data }
      : { ok: false, problem: 'unavailable' };
  }
  const hint = HINTS.find((known) => known === error.hint);
  if (hint !== undefined) return { ok: false, problem: hint };
  if (error.code && NOT_SIGNED_IN.has(error.code)) return { ok: false, problem: 'signed-out' };
  return { ok: false, problem: 'unavailable' };
}
