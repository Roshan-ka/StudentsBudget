// The model, as the `ai` Edge Function sees it (the AI phase, chunk 3, docs/superpowers/plans/2026-11-09-ai-phase-1.md;
// on Groq since docs/superpowers/plans/2026-11-13-groq-free-plan.md): the call a feature asks for, the message that
// comes back, and how its answer is read. The provider's API is in groq.ts, which turns a `ModelCall` into a request;
// everything here is plain TypeScript the app's tests run.

import type { z } from 'zod';

/** The models on Groq's free plan that are for production (console.groq.com/docs/models, read 13-11-2026). */
export type ModelId = 'openai/gpt-oss-20b' | 'openai/gpt-oss-120b';

/** What a feature asks of the model. The client adds the structured-output format from `answer`. */
export type ModelCall = {
  model: ModelId;
  /** The most the answer may take, reasoning included (`max_completion_tokens`). */
  maxTokens: number;
  /** How hard a reasoning model thinks before it answers (`reasoning_effort`); always sent. */
  effort: 'low' | 'medium' | 'high';
  /** The feature's rules and data: the same for every student, but for Ask's city items, picked per question. */
  system: string;
  /** The conversation, the student's data in its first message; the last is the student's. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** The answer's schema: the format the model answers in, and how it is read. */
  answer: z.ZodType;
  /** How long the function waits for the model, in milliseconds. */
  timeoutMs: number;
};

/** The parts of the API's message the function reads. */
export type ModelMessage = {
  model: string;
  stop_reason: string | null;
  /** The answer's text, as one `text` block (none when the reply had no text). */
  content: { type: string; text?: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    /** The tokens a reasoning model spent thinking, where the API says (Groq's gpt-oss). */
    reasoning_tokens?: number | null;
  };
};

export interface ModelClient {
  create(call: ModelCall, signal: AbortSignal): Promise<ModelMessage>;
}

/** The model can't be reached right now: rate limited, overloaded, down, or the connection failed. */
export class ModelUnavailable extends Error {}

/**
 * The provider's rate limit refused the call (HTTP 429): busy, worth trying again shortly. `retryAfterMs` is its
 * `retry-after`, when it sent one.
 */
export class ModelBusy extends ModelUnavailable {
  readonly retryAfterMs: number | null;
  constructor(message: string, retryAfterMs: number | null = null) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * The provider refused the request itself (a 4xx other than 429: a bad key, a schema it won't take, a model gone).
 * `code` is its error code, kept only when it is a plain token, so a log never carries text from a request.
 */
export class ModelApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`the model's API answered ${status}${code === null ? '' : ` (${code})`}`);
    this.status = status;
    this.code = code;
  }
}

export type Reading<T> = { ok: true; value: T } | { ok: false; problem: 'refused' | 'failed' };

/**
 * The answer in a message: its text read as JSON and checked with the schema, bounds included (strict structured
 * outputs leave those to the reader, strict-schema.ts). A refusal, or any stop but the end of the turn (cut off at
 * the output limit, say), is no answer.
 */
export function readStructured<T>(message: ModelMessage, schema: z.ZodType<T>): Reading<T> {
  if (message.stop_reason === 'refusal') return { ok: false, problem: 'refused' };
  if (message.stop_reason !== 'end_turn') return { ok: false, problem: 'failed' };
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'failed' };
  }
  const checked = schema.safeParse(parsed);
  return checked.success ? { ok: true, value: checked.data } : { ok: false, problem: 'failed' };
}
