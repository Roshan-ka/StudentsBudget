// What the app sends the `ai` Edge Function and what comes back (the AI phase, chunk 2,
// docs/superpowers/plans/2026-11-09-ai-phase-1.md). Plain TypeScript and zod, shared by the function (Deno, where
// deno.json maps `zod` to the pinned npm version) and the app (`@/features/ai/contract`), so neither side can drift.
//
// Two kinds of schema live here. The requests are checked whole before anything else runs. The model's answers are
// handed to structured outputs as they are, so they keep to what that accepts: every field present (null for "none"),
// no recursion, and strict objects. Their bounds (`max`) are checked after the answer arrives, not by the API.
// A category id or an account goes to the model as plain text, not as an enum per request: a schema that changes with
// each student's categories would be compiled anew, and the answer is checked against the request either way.

import { z } from 'zod';

export const AI_FEATURES = ['quick-add', 'ask', 'setup'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/**
 * Why the function said no:
 * - `bad-request`: not a POST, not JSON, or not what the contract allows;
 * - `too-large`: a body over MAX_BODY_BYTES;
 * - `signed-out`, `second-step`: no user, or an account with two-step sign-in before its code;
 * - `daily-limit`: the account's own allowance is used up for today;
 * - `busy`: everyone's is, or the model provider's rate limit holds the request back for a moment;
 * - `refused`: the model declined to answer;
 * - `failed`: the model answered with something the contract doesn't allow, or cut off;
 * - `unavailable`: the model or the function's settings can't be reached right now.
 */
export const AI_PROBLEMS = [
  'bad-request',
  'too-large',
  'signed-out',
  'second-step',
  'daily-limit',
  'busy',
  'refused',
  'failed',
  'unavailable',
] as const;
export type AiProblem = (typeof AI_PROBLEMS)[number];

/** The HTTP status each problem is answered with. */
export const PROBLEM_STATUS: Record<AiProblem, number> = {
  'bad-request': 400,
  'too-large': 413,
  'signed-out': 401,
  'second-step': 403,
  'daily-limit': 429,
  busy: 503,
  refused: 422,
  failed: 502,
  unavailable: 503,
};

/**
 * The largest request body the function reads: the longest conversation the contract allows, in letters that take two
 * bytes, with the largest snapshot or draft (contract.test.ts holds it).
 */
export const MAX_BODY_BYTES = 64 * 1024;

/** The most bytes the setup draft may take as JSON (UTF-8). */
export const MAX_DATA = 12_000;

/**
 * The most bytes Ask's snapshot may take as JSON (UTF-8): half the setup draft's, so a question with its city items
 * and the exchange before it stays under Groq's free plan's 8,000 tokens a minute (the Groq switch, chunk 4; budget.ts).
 */
export const MAX_SNAPSHOT = 6_000;

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/** The longest quick-add line, Ask question and setup chat message. */
export const MAX_LINE = 200;
export const MAX_QUESTION = 300;
export const MAX_SETUP_MESSAGE = 500;

/** Ask's questions in one conversation, and the setup chat's messages. */
export const MAX_QUESTIONS = 6;
export const MAX_SETUP_MESSAGES = 15;

/** The longest Ask answer and setup reply, and how many sources either names. */
export const MAX_ANSWER = 2000;
export const MAX_REPLY = 1200;
export const MAX_SOURCES = 6;

const LANG = z.string().regex(/^[a-z]{2}$/);
const ISO_DATE = z.iso.date();
const NAME = z.string().trim().min(1).max(60);
/** A category id as the app writes them ('eating-out'); the app checks which. */
export const CATEGORY_ID = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
/** An account as quick add names it to the model: a1, a2 … (never its id). */
export const ACCOUNT_REF = z.string().regex(/^a[1-9]\d?$/);
const CURRENCY = z.string().regex(/^[A-Z]{3}$/);

/**
 * One message of a conversation. An assistant message goes back as the text the function returned for it (Ask: the
 * answer; setup: the reply), so nothing the app didn't show is sent again.
 */
const message = (userMax: number, assistantMax: number) =>
  z.discriminatedUnion('role', [
    z.strictObject({ role: z.literal('user'), text: z.string().trim().min(1).max(userMax) }),
    z.strictObject({ role: z.literal('assistant'), text: z.string().min(1).max(assistantMax) }),
  ]);

/** A conversation that starts and ends with the student and takes turns in between, with at most `questions` asks. */
const conversation = (userMax: number, assistantMax: number, questions: number) =>
  z
    .array(message(userMax, assistantMax))
    .min(1)
    .max(questions * 2 - 1)
    .refine(
      (turns) => turns.every((turn, at) => turn.role === (at % 2 === 0 ? 'user' : 'assistant')) && turns.length % 2 === 1,
      { message: 'turns go user, assistant, … user' },
    );

export const quickAddRequest = z.strictObject({
  feature: z.literal('quick-add'),
  lang: LANG,
  today: ISO_DATE,
  line: z.string().trim().min(1).max(MAX_LINE),
  /** The expense categories the line may be filed under, in the phone's language. */
  categories: z.array(z.strictObject({ id: CATEGORY_ID, name: NAME })).min(1).max(60),
  /** The accounts, by their quick-add reference. */
  accounts: z
    .array(z.strictObject({ ref: ACCOUNT_REF, name: NAME, kind: z.enum(['bank', 'cash']), currency: CURRENCY }))
    .max(20),
});

/** JSON the app builds from its own data (Ask's snapshot, the setup draft), up to `max` bytes; the function scrubs it. */
const json = (max: number) =>
  z.json().refine((value) => utf8Length(JSON.stringify(value)) <= max, { message: 'too much data' });

export const askRequest = z.strictObject({
  feature: z.literal('ask'),
  lang: LANG,
  today: ISO_DATE,
  snapshot: json(MAX_SNAPSHOT),
  turns: conversation(MAX_QUESTION, MAX_ANSWER, MAX_QUESTIONS),
});

export const setupRequest = z.strictObject({
  feature: z.literal('setup'),
  lang: LANG,
  today: ISO_DATE,
  draft: json(MAX_DATA),
  turns: conversation(MAX_SETUP_MESSAGE, MAX_REPLY, MAX_SETUP_MESSAGES),
});

export const aiRequest = z.discriminatedUnion('feature', [quickAddRequest, askRequest, setupRequest]);
export type QuickAddRequest = z.infer<typeof quickAddRequest>;
export type AskRequest = z.infer<typeof askRequest>;
export type SetupRequest = z.infer<typeof setupRequest>;
export type AiRequest = z.infer<typeof aiRequest>;

/**
 * The model's reading of a quick-add line. Amounts are in the account's currency, in whole units with decimals (12.5).
 * `otherAmount` is the second reading of a line like "coffee 7 40" (7.40 or 40), else null. `categoryId` and
 * `accountRef` are one the request named, or null when the line doesn't say; `date` is the day the line names.
 */
export const quickAddAnswer = z.strictObject({
  amount: z.number().nullable(),
  otherAmount: z.number().nullable(),
  note: z.string().max(MAX_LINE),
  categoryId: z.string().nullable(),
  accountRef: z.string().nullable(),
  date: ISO_DATE.nullable(),
});
export type QuickAddAnswer = z.infer<typeof quickAddAnswer>;

/** The model's answer to an Ask question: the text, and the city data it used, by id. */
export const askAnswer = z.strictObject({
  answer: z.string().min(1).max(MAX_ANSWER),
  sourceIds: z.array(z.string()).max(MAX_SOURCES),
});
export type AskAnswer = z.infer<typeof askAnswer>;

/**
 * Ask's answer as the app gets it (`aiAnswerBody(askReply)`): the model's answer with only the sources the city pack
 * has, and `unbacked`, the € amounts in it as written that nothing the model was given backs (the page then says the
 * answer holds an estimate).
 */
export const askReply = askAnswer.extend({ unbacked: z.array(z.string()).max(20) });
export type AskReply = z.infer<typeof askReply>;

/** The largest amount the setup chat may fill in, in euros: anything above is a misreading. */
export const MAX_SETUP_AMOUNT = 20_000;

/** One plan line the setup chat fills in: a category and its amount in euros a month. */
const setupLine = z.strictObject({ categoryId: z.string(), amount: z.number() });

/**
 * What one setup chat turn changes in the wizard's draft, in euros. Only what this turn changes: a line the patch
 * doesn't name, rent or the budget as null, and accounts as null stay as they are. The amounts' bounds are checked
 * after the answer arrives (the function's `finishSetup`, the app's `applyPatch`), so one bad amount drops that line,
 * not the answer.
 */
export const setupPatch = z.strictObject({
  rent: z.number().nullable(),
  incomes: z.array(setupLine).max(20),
  fixed: z.array(setupLine).max(20),
  envelopes: z.array(setupLine).max(30),
  spendingBudget: z.number().nullable(),
  accounts: z
    .array(z.strictObject({ name: z.string().max(60), kind: z.enum(['bank', 'cash']), currency: z.string(), balance: z.number() }))
    .max(10)
    .nullable(),
});
export type SetupPatch = z.infer<typeof setupPatch>;

/** The model's setup chat turn, and the app's: the reply, the city data it used by id, and the patch. */
export const setupAnswer = z.strictObject({
  reply: z.string().min(1).max(MAX_REPLY),
  sourceIds: z.array(z.string()).max(MAX_SOURCES),
  patch: setupPatch,
});
export type SetupAnswer = z.infer<typeof setupAnswer>;

/** What the function answers: the feature's answer and the uses left today (null: no limit), or the problem. */
export const aiProblemBody = z.strictObject({ ok: z.literal(false), problem: z.enum(AI_PROBLEMS) });
export const aiAnswerBody = <Answer extends z.ZodType>(answer: Answer) =>
  z.strictObject({ ok: z.literal(true), answer, left: z.number().int().min(0).nullable() });
export type AiBody<Answer> = { ok: true; answer: Answer; left: number | null } | { ok: false; problem: AiProblem };
