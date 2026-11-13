import { describe, expect, it } from 'vitest';
import { askAnswer, quickAddAnswer } from '@/features/ai/contract';
import {
  chatBody,
  chatMessage,
  groqClient,
  retryAfterMs,
  stopReasonOf,
  type ChatDeps,
} from '../../../../supabase/functions/_shared/ai/groq';
import {
  ModelApiError,
  ModelBusy,
  ModelUnavailable,
  readStructured,
  type ModelCall,
} from '../../../../supabase/functions/_shared/ai/model';
import { strictJsonSchema } from '../../../../supabase/functions/_shared/ai/strict-schema';

// The model through Groq's OpenAI-compatible API (the Groq switch, chunk 1), against a fake `fetch`.

const ANSWER = { amount: 6, otherAmount: null, note: 'döner', categoryId: 'eating-out', accountRef: 'a1', date: null };

const QUICK: ModelCall = {
  model: 'openai/gpt-oss-20b',
  maxTokens: 600,
  effort: 'low',
  thinking: false,
  fallbacks: false,
  system: 'The rules.',
  messages: [{ role: 'user', content: 'döner 6' }],
  answer: quickAddAnswer,
  timeoutMs: 8_000,
};

const ASK: ModelCall = {
  ...QUICK,
  model: 'openai/gpt-oss-120b',
  maxTokens: 2_000,
  messages: [{ role: 'user', content: 'How much is left this week?' }],
  answer: askAnswer,
  timeoutMs: 55_000,
};

const completion = (content: string | null, finish: string | null = 'stop', message: object = {}) => ({
  id: 'chatcmpl-1',
  object: 'chat.completion',
  model: 'openai/gpt-oss-20b',
  choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content, ...message } }],
  usage: {
    prompt_tokens: 900,
    completion_tokens: 120,
    prompt_tokens_details: { cached_tokens: 300 },
    completion_tokens_details: { reasoning_tokens: 80 },
  },
});

const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** A fake API: answers with `replies` in turn, records each request and each wait, and keeps its own clock. */
function fakeApi(replies: (Response | Error | (() => Response))[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const waits: number[] = [];
  const clock = { now: 0 };
  const deps: ChatDeps = {
    fetch: async (input, init) => {
      requests.push({ url: String(input), init: init ?? {} });
      if (init?.signal?.aborted) throw init.signal.reason;
      const next = replies.shift();
      if (next === undefined) throw new Error('no more replies');
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next() : next;
    },
    now: () => clock.now,
    sleep: async (ms) => {
      waits.push(ms);
      clock.now += ms;
    },
  };
  return { deps, requests, waits, clock };
}

const run = (call: ModelCall, api: ReturnType<typeof fakeApi>, signal = new AbortController().signal) => {
  const client = groqClient('gsk_test', api.deps);
  if (client === null) throw new Error('no client');
  return client.create(call, signal);
};

describe('the request', () => {
  it('sends the system prompt first, the turns, the output limit, the effort and a strict JSON-schema answer', () => {
    expect(chatBody(QUICK)).toEqual({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'The rules.' },
        { role: 'user', content: 'döner 6' },
      ],
      max_completion_tokens: 600,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', schema: strictJsonSchema(quickAddAnswer), strict: true },
      },
    });
  });

  it('posts it to Groq with the key, and passes the call’s signal on', async () => {
    const api = fakeApi([reply(completion(JSON.stringify(ANSWER)))]);
    const controller = new AbortController();
    await run(QUICK, api, controller.signal);
    const [{ url, init }] = api.requests;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer gsk_test');
    expect(JSON.parse(String(init.body))).toEqual(JSON.parse(JSON.stringify(chatBody(QUICK))));
    expect(init.signal).toBe(controller.signal);
  });

  it('has no client without a key, so every call answers unavailable as before', () => {
    expect(groqClient(undefined)).toBeNull();
    expect(groqClient('')).toBeNull();
  });
});

describe('the reply', () => {
  it('reads a finished answer, with the tokens spent', async () => {
    const message = await run(QUICK, fakeApi([reply(completion(JSON.stringify(ANSWER)))]));
    expect(message.stop_reason).toBe('end_turn');
    expect(message.usage).toEqual({
      input_tokens: 900,
      output_tokens: 120,
      cache_read_input_tokens: 300,
      reasoning_tokens: 80,
    });
    expect(readStructured(message, quickAddAnswer)).toEqual({ ok: true, value: ANSWER });
  });

  it('says how it stopped in the words readStructured reads', () => {
    expect(stopReasonOf('stop', null)).toBe('end_turn');
    expect(stopReasonOf('length', null)).toBe('max_tokens');
    expect(stopReasonOf('content_filter', null)).toBe('refusal');
    expect(stopReasonOf('tool_calls', null)).toBe('tool_use');
    expect(stopReasonOf(null, null)).toBeNull();
    expect(stopReasonOf('stop', 'I can’t help with that.')).toBe('refusal');
  });

  it('turns a cut-off answer into failed, a refusal into refused, and no text into failed', () => {
    const cut = chatMessage(completion('{"amount": 6', 'length'));
    expect(readStructured(cut, quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
    const refused = chatMessage(completion(null, 'stop', { refusal: 'No.' }));
    expect(readStructured(refused, quickAddAnswer)).toEqual({ ok: false, problem: 'refused' });
    const empty = chatMessage(completion(null));
    expect(empty.content).toEqual([]);
    expect(readStructured(empty, quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
  });

  it('throws on a reply that isn’t one, which the function counts as failed, not unavailable', async () => {
    const error = await run(QUICK, fakeApi([reply({ nothing: 'here' })])).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ModelUnavailable);
    expect(error).not.toBeInstanceOf(ModelApiError);
  });
});

describe('when Groq can’t answer', () => {
  it('reads retry-after in seconds, and nothing else', () => {
    expect(retryAfterMs('7')).toBe(7_000);
    expect(retryAfterMs('1.5')).toBe(1_500);
    expect(retryAfterMs('')).toBeNull();
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
  });

  it('gives quick add a busy answer on a rate limit, without trying again', async () => {
    const api = fakeApi([reply({ error: { code: 'rate_limit_exceeded' } }, 429, { 'retry-after': '7' })]);
    const error = await run(QUICK, api).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ModelBusy);
    expect((error as ModelBusy).retryAfterMs).toBe(7_000);
    expect(api.requests).toHaveLength(1);
    expect(api.waits).toEqual([]);
  });

  it('lets Ask try once more after the wait Groq asks for', async () => {
    const api = fakeApi([
      reply({ error: { code: 'rate_limit_exceeded' } }, 429, { 'retry-after': '1' }),
      reply(completion(JSON.stringify({ answer: 'About €40.', sourceIds: [] }))),
    ]);
    const message = await run(ASK, api);
    expect(api.waits).toEqual([1_000]);
    expect(api.requests).toHaveLength(2);
    expect(readStructured(message, askAnswer)).toEqual({ ok: true, value: { answer: 'About €40.', sourceIds: [] } });
  });

  it('doesn’t wait when Groq asks for longer than 20 s, or the wait would leave too little time', async () => {
    const long = fakeApi([reply({}, 429, { 'retry-after': '30' })]);
    await expect(run(ASK, long)).rejects.toBeInstanceOf(ModelBusy);
    expect(long.requests).toHaveLength(1);
    expect(long.waits).toEqual([]);

    // The first answer took 45 s: a 1 s wait would leave 9 s of the 55 s, less than the 15 s an answer needs.
    const late = fakeApi([]);
    late.deps.fetch = async (input, init) => {
      late.requests.push({ url: String(input), init: init ?? {} });
      late.clock.now += 45_000;
      return reply({}, 429, { 'retry-after': '1' });
    };
    await expect(run(ASK, late)).rejects.toBeInstanceOf(ModelBusy);
    expect(late.requests).toHaveLength(1);
  });

  it('calls a server error or a lost connection unavailable, and tries a long call again only once', async () => {
    const down = fakeApi([reply({}, 503), reply({}, 503)]);
    const error = await run(ASK, down).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ModelUnavailable);
    expect(error).not.toBeInstanceOf(ModelBusy);
    expect(down.requests).toHaveLength(2);
    expect(down.waits).toEqual([2_000]);

    const lost = fakeApi([new TypeError('fetch failed')]);
    await expect(run(QUICK, lost)).rejects.toBeInstanceOf(ModelUnavailable);
    expect(lost.requests).toHaveLength(1);
  });

  it('passes on a refusal of the request with its status, and its code only when it is a plain token', async () => {
    const schema = fakeApi([reply({ error: { code: 'json_validate_failed', message: 'the answer…' } }, 400)]);
    const error = await run(ASK, schema).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ModelApiError);
    expect(error).toMatchObject({ status: 400, code: 'json_validate_failed' });
    expect(schema.requests).toHaveLength(1);

    const key = fakeApi([reply({ error: { code: 'Invalid API Key: gsk_…' } }, 401)]);
    await expect(run(QUICK, key)).rejects.toMatchObject({ status: 401, code: null });
  });

  it('passes on an abort as it came, before the call or during the wait, and asks no more', async () => {
    const controller = new AbortController();
    controller.abort(new Error('the phone gave up'));
    const before = fakeApi([reply(completion(JSON.stringify(ANSWER)))]);
    await expect(run(QUICK, before, controller.signal)).rejects.toThrow('the phone gave up');

    const during = new AbortController();
    const api = fakeApi([reply({}, 429, { 'retry-after': '1' }), reply(completion('{}'))]);
    api.deps.sleep = async (_ms, signal) => {
      during.abort(new Error('the student left'));
      throw signal.reason;
    };
    await expect(run(ASK, api, during.signal)).rejects.toThrow('the student left');
    expect(api.requests).toHaveLength(1);
  });
});
