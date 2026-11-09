import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  aiAnswerBody,
  aiProblemBody,
  aiRequest,
  askAnswer,
  MAX_ANSWER,
  MAX_BODY_BYTES,
  MAX_DATA,
  MAX_QUESTION,
  MAX_QUESTIONS,
  MAX_REPLY,
  MAX_SETUP_MESSAGE,
  MAX_SETUP_MESSAGES,
  quickAddAnswer,
} from '@/features/ai/contract';

// The AI function's contract (the AI phase, chunk 2): what the app may send, and what the model's answers look like.

const quickAdd = {
  feature: 'quick-add',
  lang: 'en',
  today: '2026-11-09',
  line: '  12 for pizza with Tom yesterday, paid cash ',
  categories: [
    { id: 'eating-out', name: 'Eating out' },
    { id: 'groceries', name: 'Groceries' },
  ],
  accounts: [
    { ref: 'a1', name: 'Cash', kind: 'cash', currency: 'EUR' },
    { ref: 'a2', name: 'Sparkasse', kind: 'bank', currency: 'EUR' },
  ],
};

/** A conversation of `questions` asks with an answer after each but the last. */
function turns(questions: number, question: string, answer: string) {
  return Array.from({ length: questions * 2 - 1 }, (_, at) =>
    at % 2 === 0 ? { role: 'user', text: question } : { role: 'assistant', text: answer },
  );
}

/** JSON of about `bytes` bytes in two-byte letters, as Ask's snapshot or the setup draft might be. */
function data(bytes: number) {
  const padding = JSON.stringify({ notes: [''] }).length;
  return { notes: ['ä'.repeat(Math.ceil((bytes - padding) / 2))] };
}

describe('the requests', () => {
  it('reads a quick-add line, trimmed', () => {
    const read = aiRequest.parse(quickAdd);
    expect(read.feature === 'quick-add' && read.line).toBe('12 for pizza with Tom yesterday, paid cash');
  });

  it('refuses what the contract doesn’t allow', () => {
    const refused = [
      { ...quickAdd, feature: 'translate' },
      { ...quickAdd, extra: true },
      { ...quickAdd, line: '   ' },
      { ...quickAdd, line: 'x'.repeat(201) },
      { ...quickAdd, today: '09.11.2026' },
      { ...quickAdd, lang: 'EN' },
      { ...quickAdd, categories: [] },
      { ...quickAdd, categories: [{ id: 'Eating Out', name: 'Eating out' }] },
      // An account goes to the model by its reference only, never its id.
      { ...quickAdd, accounts: [{ ref: 'acc-7f3a', name: 'Cash', kind: 'cash', currency: 'EUR' }] },
      { ...quickAdd, accounts: [{ ref: 'a1', name: 'Cash', kind: 'wallet', currency: 'EUR' }] },
    ];
    for (const body of refused) expect(aiRequest.safeParse(body).success, JSON.stringify(body)).toBe(false);
  });

  it('takes an Ask conversation that goes question, answer, … question, up to six questions', () => {
    const ask = { feature: 'ask', lang: 'de', today: '2026-11-09', snapshot: { month: '2026-11', left: 12_000 } };
    expect(aiRequest.safeParse({ ...ask, turns: turns(1, 'How much is left?', '') }).success).toBe(true);
    expect(aiRequest.safeParse({ ...ask, turns: turns(MAX_QUESTIONS, 'Why?', 'Because.') }).success).toBe(true);
    expect(aiRequest.safeParse({ ...ask, turns: turns(MAX_QUESTIONS + 1, 'Why?', 'Because.') }).success).toBe(false);
    expect(aiRequest.safeParse({ ...ask, turns: turns(2, 'Why?', 'Because.').slice(0, 2) }).success).toBe(false);
    expect(aiRequest.safeParse({ ...ask, turns: [{ role: 'assistant', text: 'Hello' }] }).success).toBe(false);
    expect(aiRequest.safeParse({ ...ask, turns: turns(1, 'x'.repeat(MAX_QUESTION + 1), '') }).success).toBe(false);
    expect(aiRequest.safeParse({ ...ask, snapshot: data(MAX_DATA + 1), turns: turns(1, 'Why?', '') }).success).toBe(false);
  });

  it('fits the longest conversations it allows, in two-byte letters, with the most data, in MAX_BODY_BYTES', () => {
    const ask = {
      feature: 'ask',
      lang: 'de',
      today: '2026-11-09',
      snapshot: data(MAX_DATA - 1),
      turns: turns(MAX_QUESTIONS, 'ä'.repeat(MAX_QUESTION), 'ä'.repeat(MAX_ANSWER)),
    };
    const setup = {
      feature: 'setup',
      lang: 'de',
      today: '2026-11-09',
      draft: data(MAX_DATA - 1),
      turns: turns(MAX_SETUP_MESSAGES, 'ä'.repeat(MAX_SETUP_MESSAGE), 'ä'.repeat(MAX_REPLY)),
    };
    for (const body of [ask, setup]) {
      expect(aiRequest.safeParse(body).success).toBe(true);
      expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThanOrEqual(MAX_BODY_BYTES);
    }
  });
});

describe('the answers', () => {
  it('keep to what structured outputs accept: strict objects with every field required', () => {
    for (const schema of [quickAddAnswer, askAnswer]) {
      const json = z.toJSONSchema(schema) as { required?: string[]; properties: object; additionalProperties?: boolean };
      expect(json.additionalProperties).toBe(false);
      expect(json.required).toEqual(Object.keys(json.properties));
    }
  });

  it('read a quick-add answer, with null for what the line doesn’t say', () => {
    const answer = { amount: 12, otherAmount: null, note: 'pizza with Tom', categoryId: 'eating-out', accountRef: 'a1', date: '2026-11-08' };
    expect(quickAddAnswer.parse(answer)).toEqual(answer);
    expect(quickAddAnswer.safeParse({ ...answer, date: undefined }).success).toBe(false);
    expect(quickAddAnswer.safeParse({ ...answer, date: 'yesterday' }).success).toBe(false);
  });

  it('bound an Ask answer and its sources', () => {
    expect(askAnswer.safeParse({ answer: 'x'.repeat(MAX_ANSWER + 1), sourceIds: [] }).success).toBe(false);
    expect(askAnswer.safeParse({ answer: 'Fine.', sourceIds: Array(7).fill('tip-1') }).success).toBe(false);
  });

  it('come back as the answer and the uses left, or the problem', () => {
    const body = aiAnswerBody(askAnswer);
    expect(body.parse({ ok: true, answer: { answer: 'Fine.', sourceIds: [] }, left: null }).left).toBeNull();
    expect(body.safeParse({ ok: true, answer: { answer: 'Fine.', sourceIds: [] }, left: -1 }).success).toBe(false);
    expect(aiProblemBody.parse({ ok: false, problem: 'daily-limit' }).problem).toBe('daily-limit');
    expect(aiProblemBody.safeParse({ ok: false, problem: 'teapot' }).success).toBe(false);
  });
});
