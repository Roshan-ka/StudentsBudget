import { describe, expect, it } from 'vitest';
import { quickAddAnswer } from '@/features/ai/contract';
import { readStructured, type ModelMessage } from '../../../../supabase/functions/_shared/ai/model';

// Reading the model's message (the AI phase, chunk 3; on Groq since the Groq switch, chunk 2).

const ANSWER = { amount: 12, otherAmount: null, note: 'pizza', categoryId: 'eating-out', accountRef: 'a1', date: null };

function message(content: ModelMessage['content'], stop: string | null = 'end_turn'): ModelMessage {
  return { model: 'openai/gpt-oss-20b', stop_reason: stop, content, usage: { input_tokens: 300, output_tokens: 40 } };
}

const text = (value: unknown) => ({ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) });

describe('readStructured', () => {
  it('reads the answer from the text', () => {
    expect(readStructured(message([text(ANSWER)]), quickAddAnswer)).toEqual({ ok: true, value: ANSWER });
  });

  it('is no answer on a refusal, a cut-off answer, text that isn’t JSON, or JSON the schema refuses', () => {
    expect(readStructured(message([text(ANSWER)], 'refusal'), quickAddAnswer)).toEqual({ ok: false, problem: 'refused' });
    expect(readStructured(message([text('{"amount": 12, "note"')], 'max_tokens'), quickAddAnswer)).toEqual({
      ok: false,
      problem: 'failed',
    });
    expect(readStructured(message([text('Twelve euros.')]), quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
    // Strict mode leaves the bounds to the reader (strict-schema.ts): a note over 200 characters is no answer.
    expect(readStructured(message([text({ ...ANSWER, note: 'x'.repeat(201) })]), quickAddAnswer)).toEqual({
      ok: false,
      problem: 'failed',
    });
    expect(readStructured(message([]), quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
  });

  it('is no answer when the model stopped to call a tool, which no feature asks for', () => {
    expect(readStructured(message([text(ANSWER)], 'tool_use'), quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
  });
});
