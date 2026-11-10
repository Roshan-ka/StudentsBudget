// The model, as the `ai` Edge Function sees it (the AI phase, chunk 3, docs/superpowers/plans/2026-11-09-ai-phase-1.md):
// the call a feature asks for, the message that comes back, and how its answer is read. The Anthropic SDK stays in the
// function's entry (../../ai/index.ts), which turns a `ModelCall` into a request; everything here is plain TypeScript
// the app's tests run.

import type { z } from 'zod';

/** What a feature asks of the model. The entry adds the structured-output format from `answer`. */
export type ModelCall = {
  model: 'claude-haiku-5-5' | 'claude-opus-5-5';
  maxTokens: number;
  /** Always sent: each model has its own default, and the call says what it wants. */
  effort: 'low' | 'medium' | 'high';
  /** False turns thinking off (quick add, at low effort); true leaves the model's adaptive thinking on. */
  thinking: boolean;
  /** Server-side fallbacks on a refusal (`fallbacks: "default"`), for Opus only: Haiku 5.5 has none. No call uses them now. */
  fallbacks: boolean;
  /** The feature's frozen rules and data, the same for every student, cached. */
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
  /** Text, thinking and, after a server-side fallback, `fallback` blocks. */
  content: { type: string; text?: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    /** One entry per model that ran; a `fallback_message` entry when a fallback model answered. */
    iterations?: { type: string }[] | null;
  };
};

export interface ModelClient {
  create(call: ModelCall, signal: AbortSignal): Promise<ModelMessage>;
}

/** The model can't be reached right now: rate limited, overloaded, down, or the connection failed. */
export class ModelUnavailable extends Error {}

export type Reading<T> = { ok: true; value: T } | { ok: false; problem: 'refused' | 'failed' };

/**
 * The answer in a message: the text after the last `fallback` block (what came before it is the declined model's),
 * read as JSON and checked with the schema, bounds included (structured outputs leave those to the reader).
 * A refusal, or any stop but the end of the turn (cut off at max_tokens, paused), is no answer.
 */
export function readStructured<T>(message: ModelMessage, schema: z.ZodType<T>): Reading<T> {
  if (message.stop_reason === 'refusal') return { ok: false, problem: 'refused' };
  if (message.stop_reason !== 'end_turn') return { ok: false, problem: 'failed' };
  const blocks = message.content;
  const lastFallback = blocks.map((block) => block.type).lastIndexOf('fallback');
  const text = blocks
    .slice(lastFallback + 1)
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

/** Whether a fallback model answered (or declined in turn), for the logs. */
export function fellBack(message: ModelMessage): boolean {
  return (
    message.content.some((block) => block.type === 'fallback') ||
    (message.usage.iterations ?? []).some((entry) => entry.type === 'fallback_message')
  );
}
