// The model through an OpenAI-compatible chat-completions API, set up for Groq (the Groq switch, chunk 1,
// docs/superpowers/plans/2026-11-13-groq-free-plan.md). Plain `fetch`, no SDK: the base URL, the key and the model ids
// are settings, so another provider that speaks this format is a matter of configuration (and the privacy texts).
// It turns a `ModelCall` into a request with a strict JSON-schema answer, and the reply into the `ModelMessage` that
// `readStructured` already reads. The `ai` function's entry uses it since chunk 2.

import { z } from 'zod';
import {
  ModelApiError,
  ModelBusy,
  ModelUnavailable,
  type ModelCall,
  type ModelClient,
  type ModelMessage,
} from './model.ts';
import { strictJsonSchema } from './strict-schema.ts';

/** Groq's OpenAI-compatible API (console.groq.com/docs/openai, read 13-11-2026). */
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/** A call this long may wait for one retry (Ask and the setup chat, 55 s); quick add (8 s) never retries. */
const RETRY_FROM_MS = 30_000;
/** The longest `retry-after` worth waiting for, and the time a retry must still leave before the call's timeout. */
const MAX_WAIT_MS = 20_000;
const LEAVE_MS = 15_000;
/** The wait before a retry when the provider gives none (a 5xx, a lost connection). */
const DEFAULT_WAIT_MS = 2_000;

/** What the client needs from its surroundings, so the tests can play them. */
export type ChatDeps = {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
};

/** Waits `ms`, or rejects at once when the call is aborted. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

const DEFAULT_DEPS: ChatDeps = { fetch: (input, init) => fetch(input, init), now: () => Date.now(), sleep };

/**
 * The request for a call: the system prompt first, then the turns, a strict JSON-schema answer and the reasoning
 * effort. No temperature and no streaming: a reasoning model answers at its own settings, and strict structured
 * outputs don't stream.
 */
export function chatBody(call: ModelCall) {
  return {
    model: call.model,
    messages: [{ role: 'system', content: call.system }, ...call.messages],
    max_completion_tokens: call.maxTokens,
    reasoning_effort: call.effort,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'answer', schema: strictJsonSchema(call.answer), strict: true },
    },
  };
}

/** The parts of a chat-completions reply the function reads, loosely: a provider may add fields. */
const chatReply = z.object({
  model: z.string(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({
          content: z.string().nullable().optional(),
          refusal: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      prompt_tokens_details: z.object({ cached_tokens: z.number().nullable().optional() }).nullable().optional(),
      completion_tokens_details: z.object({ reasoning_tokens: z.number().nullable().optional() }).nullable().optional(),
    })
    .optional(),
});

/**
 * How the reply stopped, in the words `readStructured` reads: a finished answer is `end_turn`, one cut off at the
 * output limit `max_tokens`, and a refusal or a filtered answer `refusal`. Anything else is no answer.
 */
export function stopReasonOf(finish: string | null | undefined, refusal: string | null | undefined): string | null {
  if (refusal) return 'refusal';
  switch (finish) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'content_filter':
      return 'refusal';
    case 'tool_calls':
      return 'tool_use';
    default:
      return finish ?? null;
  }
}

/** A reply as the `ModelMessage` the function reads; a reply that isn't one throws (the answer then `failed`). */
export function chatMessage(json: unknown): ModelMessage {
  const reply = chatReply.parse(json);
  const [choice] = reply.choices;
  const content = choice.message.content;
  return {
    model: reply.model,
    stop_reason: stopReasonOf(choice.finish_reason, choice.message.refusal),
    content: content ? [{ type: 'text', text: content }] : [],
    usage: {
      input_tokens: reply.usage?.prompt_tokens ?? 0,
      output_tokens: reply.usage?.completion_tokens ?? 0,
      cache_read_input_tokens: reply.usage?.prompt_tokens_details?.cached_tokens ?? null,
      reasoning_tokens: reply.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    },
  };
}

/** `retry-after` in milliseconds: seconds as the header gives them, or null when it is missing or not a number. */
export function retryAfterMs(header: string | null): number | null {
  if (header === null || header.trim() === '') return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null;
}

/** The provider's error code, only when it is a plain token, so no text from a request reaches the logs. */
async function errorCodeOf(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === 'string' && /^[a-z0-9_]{1,40}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * A `ModelClient` for an OpenAI-compatible API, or null without a key (every call then answers `unavailable`, as
 * before). A rate limit (429) is `ModelBusy`; a server error or a lost connection `ModelUnavailable`; any other
 * refusal `ModelApiError`; an abort is passed on as it came. A long call (Ask, the setup chat) tries once more after
 * a busy or unavailable answer, waiting the provider's `retry-after` when it is short enough to leave time for the
 * answer; quick add never does, since the phone reads the line itself after 8 seconds.
 */
export function chatClient(
  settings: { baseUrl: string; apiKey: string | undefined },
  deps: ChatDeps = DEFAULT_DEPS,
): ModelClient | null {
  const { baseUrl, apiKey } = settings;
  if (!apiKey) return null;

  async function once(call: ModelCall, signal: AbortSignal): Promise<ModelMessage> {
    let response: Response;
    try {
      response = await deps.fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody(call)),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ModelUnavailable(error instanceof Error ? error.message : 'the connection failed');
    }
    if (response.status === 429) {
      throw new ModelBusy('rate limited', retryAfterMs(response.headers.get('retry-after')));
    }
    if (response.status >= 500) throw new ModelUnavailable(`the model's API answered ${response.status}`);
    if (!response.ok) throw new ModelApiError(response.status, await errorCodeOf(response));
    return chatMessage(await response.json());
  }

  return {
    async create(call, signal) {
      const started = deps.now();
      try {
        return await once(call, signal);
      } catch (error) {
        if (!(error instanceof ModelUnavailable) || call.timeoutMs < RETRY_FROM_MS || signal.aborted) throw error;
        const wait = (error instanceof ModelBusy ? error.retryAfterMs : null) ?? DEFAULT_WAIT_MS;
        const left = call.timeoutMs - (deps.now() - started);
        if (wait > MAX_WAIT_MS || left - wait < LEAVE_MS) throw error;
        await deps.sleep(wait, signal);
        return await once(call, signal);
      }
    },
  };
}

/** The client on Groq, with its key (`GROQ_API_KEY`, a function secret). */
export function groqClient(apiKey: string | undefined, deps?: ChatDeps): ModelClient | null {
  return chatClient({ baseUrl: GROQ_BASE_URL, apiKey }, deps);
}
