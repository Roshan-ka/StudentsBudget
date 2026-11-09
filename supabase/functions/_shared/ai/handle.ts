// What the `ai` Edge Function does with one request (the AI phase, chunk 3,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md). Plain TypeScript with the allowance, the model and the log passed
// in, so the app's tests run it as it is (src/features/ai/server/handle.test.ts).
//
// In order: the preflight and the page's origin, POST only, the body's size, the contract, the student's token, a
// builder and a model for the feature, the allowance (a try counts even when the model then fails), the scrub, the
// model, the answer read and checked, and the feature's own last check. Each step that says no answers with a problem
// the app knows (contract.ts). The log names the feature, the model, the time, the tokens and how it ended: never what
// the student wrote or what the model answered.

import { aiRequest, MAX_BODY_BYTES, PROBLEM_STATUS, type AiFeature, type AiProblem, type AiRequest } from './contract.ts';
import type { Allowance } from './allowance.ts';
import { corsHeaders } from './cors.ts';
import { fellBack, ModelUnavailable, readStructured, type ModelCall, type ModelClient, type ModelMessage } from './model.ts';
import { scrub, scrubJson, type Json } from './scrub.ts';

/** How a feature asks the model and what it does with the answer. Chunks 4, 8 and 11 write the three. */
export type FeatureBuilder<R extends AiRequest = AiRequest> = {
  /** The model call for a request whose text is already scrubbed. */
  call(request: R): ModelCall;
  /** What the app gets from the model's checked answer, or null when the answer can't be used. */
  finish(answer: unknown, request: R): unknown;
};

export type FeatureBuilders = {
  [F in AiFeature]?: FeatureBuilder<Extract<AiRequest, { feature: F }>>;
};

/** One line of the function's log. Never any text the student wrote or the model answered. */
export type AiLog = {
  feature: AiFeature | null;
  /** The model that answered, or the one asked when none did. */
  model: string | null;
  ms: number;
  problem: AiProblem | null;
  /** The client went away before the answer. */
  aborted?: true;
  stop?: string | null;
  fallback?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type AiDeps = {
  /** From the `AI_ALLOWED_ORIGINS` secret (`allowedOrigins`). */
  allowedOrigins: ReadonlySet<string>;
  /** Null while the function has no API key. */
  model: ModelClient | null;
  builders: FeatureBuilders;
  /** `take_ai_allowance` with the student's token (`allowanceOf`). */
  takeAllowance(token: string, feature: AiFeature): Promise<Allowance>;
  log(entry: AiLog): void;
  /** Milliseconds, for the log's time. */
  now(): number;
};

const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' };

function reply(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, ...JSON_TYPE } });
}

/** The body as text, or 'too-large' once it passes MAX_BODY_BYTES, whatever its Content-Length said. */
async function readBody(request: Request): Promise<string | 'too-large'> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return 'too-large';
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return 'too-large';
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

/** The token after "Bearer ", or null. */
function tokenOf(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  return match ? match[1] : null;
}

/** The request with every text the student or the app wrote scrubbed (scrub.ts), the rest as it was. */
export function scrubRequest(request: AiRequest): AiRequest {
  const turns = (list: { role: 'user' | 'assistant'; text: string }[]) =>
    list.map((turn) => ({ ...turn, text: scrub(turn.text) }));
  switch (request.feature) {
    case 'quick-add':
      return {
        ...request,
        line: scrub(request.line),
        categories: request.categories.map((category) => ({ ...category, name: scrub(category.name) })),
        accounts: request.accounts.map((account) => ({ ...account, name: scrub(account.name) })),
      };
    case 'ask':
      return { ...request, snapshot: scrubJson(request.snapshot as Json), turns: turns(request.turns) };
    case 'setup':
      return { ...request, draft: scrubJson(request.draft as Json), turns: turns(request.turns) };
  }
}

/** What the model was asked and how it went, for the log. */
function usageOf(message: ModelMessage): Partial<AiLog> {
  return {
    model: message.model,
    stop: message.stop_reason,
    fallback: fellBack(message),
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

export async function handleAi(request: Request, deps: AiDeps): Promise<Response> {
  const started = deps.now();
  const cors = corsHeaders(request.headers.get('Origin'), deps.allowedOrigins);
  let feature: AiFeature | null = null;
  let model: string | null = null;

  const done = (problem: AiProblem | null, extra: Partial<AiLog> = {}) =>
    deps.log({ feature, model, ms: deps.now() - started, problem, ...extra });
  const refuse = (problem: AiProblem, extra: Partial<AiLog> = {}, status = PROBLEM_STATUS[problem]) => {
    done(problem, extra);
    return reply(status, { ok: false, problem }, cors ?? {});
  };

  // Another site's page: no CORS headers, so its browser reads nothing, and nothing runs.
  if (cors === null) return refuse('bad-request', {}, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return refuse('bad-request', {}, 405);

  const body = await readBody(request);
  if (body === 'too-large') return refuse('too-large');
  let parsed: AiRequest;
  try {
    const checked = aiRequest.safeParse(JSON.parse(body));
    if (!checked.success) return refuse('bad-request');
    parsed = checked.data;
  } catch {
    return refuse('bad-request');
  }
  feature = parsed.feature;

  const token = tokenOf(request);
  if (token === null) return refuse('signed-out');
  const builder = deps.builders[parsed.feature] as FeatureBuilder | undefined;
  const client = deps.model;
  // Before the allowance: a feature the function can't answer yet costs the student nothing.
  if (client === null || builder === undefined) return refuse('unavailable');

  const allowance = await deps.takeAllowance(token, parsed.feature);
  if (!allowance.ok) return refuse(allowance.problem);

  const scrubbed = scrubRequest(parsed);
  const call = builder.call(scrubbed);
  model = call.model;
  const timeout = AbortSignal.timeout(call.timeoutMs);
  const signal = AbortSignal.any([request.signal, timeout]);

  let message: ModelMessage;
  try {
    message = await client.create(call, signal);
  } catch (error) {
    if (request.signal.aborted) return refuse('failed', { aborted: true });
    if (timeout.aborted || error instanceof ModelUnavailable) return refuse('unavailable');
    return refuse('failed');
  }

  const usage = usageOf(message);
  const read = readStructured(message, call.answer);
  if (!read.ok) return refuse(read.problem, usage);
  const answer = builder.finish(read.value, scrubbed);
  if (answer === null) return refuse('failed', usage);

  done(null, usage);
  return reply(200, { ok: true, answer, left: allowance.left }, cors);
}
