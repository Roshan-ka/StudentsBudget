import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, quickAddAnswer, type QuickAddAnswer, type QuickAddRequest } from '@/features/ai/contract';
import type { Allowance } from '../../../../supabase/functions/_shared/ai/allowance';
import { allowedOrigins } from '../../../../supabase/functions/_shared/ai/cors';
import { handleAi, type AiDeps, type AiLog, type FeatureBuilder } from '../../../../supabase/functions/_shared/ai/handle';
import { ModelUnavailable, type ModelCall, type ModelClient, type ModelMessage } from '../../../../supabase/functions/_shared/ai/model';

// What the `ai` function does with one request (the AI phase, chunk 3), with the allowance, the model and the log
// played here.

const APP = 'https://students-budget.vercel.app';
const URL = 'https://project.supabase.co/functions/v1/ai';

const REQUEST: QuickAddRequest = {
  feature: 'quick-add',
  lang: 'en',
  today: '2026-11-09',
  line: '12 pizza with Tom, IBAN DE00 1203 0000 0000 0000 00',
  categories: [{ id: 'eating-out', name: 'Eating out' }],
  accounts: [{ ref: 'a1', name: 'Cash', kind: 'cash', currency: 'EUR' }],
};

const ANSWER: QuickAddAnswer = { amount: 12, otherAmount: null, note: 'pizza with Tom', categoryId: 'eating-out', accountRef: 'a1', date: null };

function message(answer: unknown = ANSWER, stop = 'end_turn'): ModelMessage {
  return {
    model: 'claude-haiku-5-5',
    stop_reason: stop,
    content: [{ type: 'text', text: JSON.stringify(answer) }],
    usage: { input_tokens: 420, output_tokens: 38, cache_read_input_tokens: 300, cache_creation_input_tokens: 0 },
  };
}

/** Quick add as chunk 4 will write it, in short: the line goes to the model, and an unknown category is no answer. */
const quickAdd: FeatureBuilder<QuickAddRequest> = {
  call: (request): ModelCall => ({
    model: 'claude-haiku-5-5',
    maxTokens: 400,
    effort: 'low',
    thinking: false,
    fallbacks: false,
    system: 'Read the line.',
    messages: [{ role: 'user', content: request.line }],
    answer: quickAddAnswer,
    timeoutMs: 1000,
  }),
  finish: (answer, request) => {
    const read = answer as QuickAddAnswer;
    return read.categoryId === null || request.categories.some((c) => c.id === read.categoryId) ? read : null;
  },
};

type Played = {
  deps: AiDeps;
  logs: AiLog[];
  calls: { call: ModelCall; signal: AbortSignal }[];
  taken: { token: string; feature: string }[];
};

function play(options: { model?: ModelClient | null; reply?: () => Promise<ModelMessage>; allowance?: Allowance } = {}): Played {
  const logs: AiLog[] = [];
  const calls: Played['calls'] = [];
  const taken: Played['taken'] = [];
  const reply = options.reply ?? (async () => message());
  const model: ModelClient = {
    create(call, signal) {
      calls.push({ call, signal });
      return reply();
    },
  };
  let clock = 1000;
  const deps: AiDeps = {
    allowedOrigins: allowedOrigins(APP),
    model: options.model === undefined ? model : options.model,
    builders: { 'quick-add': quickAdd },
    async takeAllowance(token, feature) {
      taken.push({ token, feature });
      return options.allowance ?? { ok: true, left: 4 };
    },
    log: (entry) => logs.push(entry),
    now: () => (clock += 250),
  };
  return { deps, logs, calls, taken };
}

function post(body: unknown, headers: Record<string, string> = {}, init: RequestInit = {}): Request {
  return new Request(URL, {
    method: 'POST',
    headers: { Origin: APP, Authorization: 'Bearer user-token', 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

async function answerOf(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe('handleAi: before the request is read', () => {
  it('answers the browser’s preflight for the app, and nothing for another site', async () => {
    const { deps, calls } = play();
    const preflight = await handleAi(new Request(URL, { method: 'OPTIONS', headers: { Origin: APP } }), deps);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(APP);

    const other = await handleAi(post(REQUEST, { Origin: 'https://example.com' }), deps);
    expect(other.status).toBe(403);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('takes POST only', async () => {
    const { deps } = play();
    expect(await answerOf(await handleAi(new Request(URL, { headers: { Origin: APP } }), deps))).toEqual({
      status: 405,
      body: { ok: false, problem: 'bad-request' },
    });
  });

  it('refuses a body over the limit, whether or not it says its length', async () => {
    const { deps, taken } = play();
    const declared = await handleAi(post(REQUEST, { 'Content-Length': String(MAX_BODY_BYTES + 1) }), deps);
    expect(await answerOf(declared)).toEqual({ status: 413, body: { ok: false, problem: 'too-large' } });
    const big = await handleAi(post({ ...REQUEST, padding: 'x'.repeat(MAX_BODY_BYTES) }), deps);
    expect(await answerOf(big)).toEqual({ status: 413, body: { ok: false, problem: 'too-large' } });
    expect(taken).toHaveLength(0);
  });

  it('refuses text that isn’t JSON, and JSON the contract doesn’t allow', async () => {
    const { deps, taken } = play();
    expect((await handleAi(post('{"feature": "quick-add",'), deps)).status).toBe(400);
    expect((await handleAi(post({ ...REQUEST, line: '' }), deps)).status).toBe(400);
    expect(taken).toHaveLength(0);
  });
});

describe('handleAi: who is asking', () => {
  it('wants a token, and takes no use without one', async () => {
    const { deps, taken } = play();
    const response = await handleAi(post(REQUEST, { Authorization: '' }), deps);
    expect(await answerOf(response)).toEqual({ status: 401, body: { ok: false, problem: 'signed-out' } });
    expect(taken).toHaveLength(0);
  });

  it('takes no use for a feature it can’t answer yet, or while it has no API key', async () => {
    const ask = { feature: 'ask', lang: 'en', today: '2026-11-09', snapshot: {}, turns: [{ role: 'user', text: 'How much is left?' }] };
    const played = play();
    expect(await answerOf(await handleAi(post(ask), played.deps))).toEqual({ status: 503, body: { ok: false, problem: 'unavailable' } });
    const keyless = play({ model: null });
    expect((await handleAi(post(REQUEST), keyless.deps)).status).toBe(503);
    expect([...played.taken, ...keyless.taken]).toHaveLength(0);
  });

  it('answers with the allowance’s problem, and asks no model', async () => {
    const statuses = { 'signed-out': 401, 'second-step': 403, 'daily-limit': 429, busy: 503, unavailable: 503 } as const;
    for (const [problem, status] of Object.entries(statuses)) {
      const { deps, calls, taken } = play({ allowance: { ok: false, problem: problem as keyof typeof statuses } });
      const response = await handleAi(post(REQUEST), deps);
      expect(await answerOf(response)).toEqual({ status, body: { ok: false, problem } });
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(APP);
      expect(taken).toEqual([{ token: 'user-token', feature: 'quick-add' }]);
      expect(calls).toHaveLength(0);
    }
  });
});

describe('handleAi: the model', () => {
  it('asks with the scrubbed text and answers with the feature’s answer and the uses left', async () => {
    const { deps, calls, logs } = play();
    const response = await handleAi(post(REQUEST), deps);
    expect(await answerOf(response)).toEqual({ status: 200, body: { ok: true, answer: ANSWER, left: 4 } });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    expect(calls[0].call.messages).toEqual([{ role: 'user', content: '12 pizza with Tom,' }]);
    expect(logs).toEqual([
      {
        feature: 'quick-add',
        model: 'claude-haiku-5-5',
        ms: 250,
        problem: null,
        stop: 'end_turn',
        fallback: false,
        inputTokens: 420,
        outputTokens: 38,
        cacheReadTokens: 300,
        cacheWriteTokens: 0,
      },
    ]);
  });

  it('logs nothing the student wrote or the model answered', async () => {
    const { deps, logs } = play();
    await handleAi(post(REQUEST), deps);
    await handleAi(post({ ...REQUEST, line: 'pizza 12' }, { Authorization: '' }), deps);
    expect(JSON.stringify(logs)).not.toMatch(/pizza|Tom|user-token|DE00/);
  });

  it('answers refused, failed or unavailable as the model went, with the use taken', async () => {
    const cases: [() => Promise<ModelMessage>, number, string][] = [
      [async () => message(ANSWER, 'refusal'), 422, 'refused'],
      [async () => message(ANSWER, 'max_tokens'), 502, 'failed'],
      [async () => message({ ...ANSWER, categoryId: 'casino' }), 502, 'failed'],
      [async () => Promise.reject(new ModelUnavailable('overloaded')), 503, 'unavailable'],
      [async () => Promise.reject(new Error('400 bad schema')), 502, 'failed'],
    ];
    for (const [reply, status, problem] of cases) {
      const { deps, taken, logs } = play({ reply });
      expect(await answerOf(await handleAi(post(REQUEST), deps))).toEqual({ status, body: { ok: false, problem } });
      expect(taken).toHaveLength(1);
      expect(logs[0].problem).toBe(problem);
    }
  });

  it('gives up on a model that takes too long', async () => {
    const quick = { ...quickAdd, call: (request: QuickAddRequest) => ({ ...quickAdd.call(request), timeoutMs: 20 }) };
    const { deps } = play();
    deps.builders = { 'quick-add': quick };
    deps.model = {
      create: (_call, signal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    };
    expect(await answerOf(await handleAi(post(REQUEST), deps))).toEqual({ status: 503, body: { ok: false, problem: 'unavailable' } });
  });

  it('stops the model when the phone goes away', async () => {
    const leaving = new AbortController();
    const { deps, calls, logs } = play();
    deps.model = {
      create: (call, signal) => {
        calls.push({ call, signal });
        setTimeout(() => leaving.abort(), 0);
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      },
    };
    await handleAi(post(REQUEST, {}, { signal: leaving.signal }), deps);
    expect(calls[0].signal.aborted).toBe(true);
    expect(logs[0]).toMatchObject({ problem: 'failed', aborted: true });
  });
});
