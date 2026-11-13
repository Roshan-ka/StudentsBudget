// What a call may cost on Groq's free plan (the Groq switch, chunk 4, docs/superpowers/plans/2026-11-13-groq-free-plan.md).
// The plan counts tokens per minute for each model, the input and the output limit together, so every call must stay
// well under a minute's tokens on its own. The estimate counts bytes, on the safe side: tests hold quick add's and
// Ask's largest calls to MAX_CALL_TOKENS (budget.test.ts).

import type { ModelCall } from './model.ts';
import { strictJsonSchema } from './strict-schema.ts';

/** Groq's free plan, per model and organisation (console.groq.com/docs/rate-limits, read 13-11-2026). */
export const GROQ_FREE_PLAN = {
  checked: '2026-11-13',
  requestsPerMinute: 30,
  requestsPerDay: 1_000,
  tokensPerMinute: 8_000,
  tokensPerDay: 200_000,
} as const;

/** The most one call may take, its output limit included: 1,000 tokens under the minute's 8,000. */
export const MAX_CALL_TOKENS = 7_000;

/**
 * Bytes per token, on the safe side: gpt-oss's tokenizer (o200k) takes about 4 bytes of English or German prose a
 * token, and fewer for JSON full of numbers.
 */
export const BYTES_PER_TOKEN = 3;

/** The tokens a message's framing takes (its role and markers), counted as bytes. */
const MESSAGE_BYTES = 30;

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/**
 * The tokens a call may take at most: its system prompt, its messages and its answer's schema, counted in bytes, plus
 * its output limit (which counts its reasoning).
 */
export function callTokens(call: ModelCall): number {
  const schema = JSON.stringify(strictJsonSchema(call.answer));
  const parts = [call.system, schema, ...call.messages.map((message) => message.content)];
  const bytes = parts.reduce((sum, part) => sum + utf8Length(part), 0) + MESSAGE_BYTES * (call.messages.length + 1);
  return Math.ceil(bytes / BYTES_PER_TOKEN) + call.maxTokens;
}
