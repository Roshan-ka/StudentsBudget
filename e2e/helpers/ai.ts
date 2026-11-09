import type { Page, Route } from '@playwright/test';
import {
  aiRequest,
  PROBLEM_STATUS,
  type AiProblem,
  type AskReply,
  type AskRequest,
  type QuickAddAnswer,
  type QuickAddRequest,
  type SetupAnswer,
  type SetupRequest,
} from '../../src/features/ai/contract';
import { AI_PREF } from '../../src/features/ai/switch';
import { signedInRequest } from './supabase';

/** The `ai` Edge Function, wherever the build's Supabase project is. */
export const AI_FUNCTION = '**/functions/v1/ai';

// The page is on localhost and the function on the project's host, so every answer is cross-origin.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

/** A feature's answer, or how to make it from the request. */
type Answer<Request, Value> = Value | ((request: Request) => Value);

/** One request the mock received: its feature and body as the app sent them, and whether it carried a session. */
export type AiCall = { feature: string | null; body: unknown; signedIn: boolean };

/**
 * Turns this phone's "Use AI features" off before its pages load. For a spec about something else that signs in and
 * uses quick add: the e2e build has the AI, so a signed-in line would wait for the `ai` note and then ask the function.
 * With the switch off it is read on the phone, as before the AI phase (ai-quick-add.spec.ts tests the AI).
 */
export async function aiSwitchedOff(page: Page) {
  await page.addInitScript((key) => localStorage.setItem(key, 'off'), AI_PREF);
}

/** Answers on a route the page may have dropped meanwhile (an aborted read): nothing is left to answer then. */
async function reply(route: Route, status: number, json: unknown) {
  await route.fulfill({ status, headers: CORS, json }).catch(() => {});
}

/**
 * Answers the `ai` Edge Function as the AI phase's contract says (`src/features/ai/contract.ts`): OPTIONS with CORS; a
 * request without the mocked session's token is `signed-out` (401), as the allowance would refuse it; a body the
 * contract refuses is `bad-request`. Then `fail` answers that problem, `dailyLimit` the account's limit (429), and
 * `answers` the feature's answer with `left` uses left today (49 by default, null for no limit, as for a moderator); a
 * feature without an answer is `unavailable`, as the function is without its builder. `slowMs` waits that long first,
 * for a phone that gives up; `hold` waits until the spec settles it, for a read the phone stops on its own. Returns
 * every request, in order, so a spec can check that a guest, or a phone with the switch off, sends nothing.
 */
export async function mockAiFunction(
  page: Page,
  options: {
    answers?: {
      'quick-add'?: Answer<QuickAddRequest, QuickAddAnswer>;
      /** Ask's answer as the function sends it: the model's, with the amounts nothing backs (`askReply`). */
      ask?: Answer<AskRequest, AskReply>;
      setup?: Answer<SetupRequest, SetupAnswer>;
    };
    left?: number | null;
    dailyLimit?: boolean;
    slowMs?: number;
    hold?: Promise<void>;
    fail?: AiProblem;
  } = {},
): Promise<AiCall[]> {
  const calls: AiCall[] = [];
  await page.route(AI_FUNCTION, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      // Not JSON: refused below.
    }
    const feature = typeof body === 'object' && body !== null && 'feature' in body ? String(body.feature) : null;
    calls.push({ feature, body, signedIn: signedInRequest(request) });
    if (options.slowMs !== undefined) await new Promise((resolve) => setTimeout(resolve, options.slowMs));
    if (options.hold !== undefined) await options.hold;

    const problem = (name: AiProblem) => reply(route, PROBLEM_STATUS[name], { ok: false, problem: name });
    if (request.method() !== 'POST') return problem('bad-request');
    if (!signedInRequest(request)) return problem('signed-out');
    const parsed = aiRequest.safeParse(body);
    if (!parsed.success) return problem('bad-request');
    if (options.fail !== undefined) return problem(options.fail);
    if (options.dailyLimit === true) return problem('daily-limit');

    const made = parsed.data;
    let answer: unknown;
    if (made.feature === 'quick-add') {
      const given = options.answers?.['quick-add'];
      answer = typeof given === 'function' ? given(made) : given;
    } else if (made.feature === 'ask') {
      const given = options.answers?.ask;
      answer = typeof given === 'function' ? given(made) : given;
    } else {
      const given = options.answers?.setup;
      answer = typeof given === 'function' ? given(made) : given;
    }
    if (answer === undefined) return problem('unavailable');
    return reply(route, 200, { ok: true, answer, left: options.left === undefined ? 49 : options.left });
  });
  return calls;
}
