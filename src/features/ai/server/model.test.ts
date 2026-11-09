import { describe, expect, it } from 'vitest';
import { quickAddAnswer } from '@/features/ai/contract';
import { fellBack, readStructured, type ModelMessage } from '../../../../supabase/functions/_shared/ai/model';

// Reading the model's message (the AI phase, chunk 3).

const ANSWER = { amount: 12, otherAmount: null, note: 'pizza', categoryId: 'eating-out', accountRef: 'a1', date: null };

function message(content: ModelMessage['content'], stop: string | null = 'end_turn'): ModelMessage {
  return { model: 'claude-haiku-5-5', stop_reason: stop, content, usage: { input_tokens: 300, output_tokens: 40 } };
}

const text = (value: unknown) => ({ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) });

describe('readStructured', () => {
  it('reads the answer, after any thinking', () => {
    expect(readStructured(message([{ type: 'thinking' }, text(ANSWER)]), quickAddAnswer)).toEqual({ ok: true, value: ANSWER });
  });

  it('reads only what came after the last fallback: the declined model’s text is not the answer', () => {
    const declined = text('{"amount": 99');
    const read = readStructured(message([declined, { type: 'fallback' }, text(ANSWER)]), quickAddAnswer);
    expect(read).toEqual({ ok: true, value: ANSWER });
  });

  it('is no answer on a refusal, a cut-off answer, text that isn’t JSON, or JSON the schema refuses', () => {
    expect(readStructured(message([text(ANSWER)], 'refusal'), quickAddAnswer)).toEqual({ ok: false, problem: 'refused' });
    expect(readStructured(message([text('{"amount": 12, "note"')], 'max_tokens'), quickAddAnswer)).toEqual({
      ok: false,
      problem: 'failed',
    });
    expect(readStructured(message([text('Twelve euros.')]), quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
    expect(readStructured(message([text({ ...ANSWER, note: 'x'.repeat(201) })]), quickAddAnswer)).toEqual({
      ok: false,
      problem: 'failed',
    });
    expect(readStructured(message([]), quickAddAnswer)).toEqual({ ok: false, problem: 'failed' });
  });
});

describe('fellBack', () => {
  it('sees a fallback block, or a fallback model in the usage', () => {
    expect(fellBack(message([text(ANSWER)]))).toBe(false);
    expect(fellBack(message([{ type: 'fallback' }, text(ANSWER)]))).toBe(true);
    const sticky = message([text(ANSWER)]);
    sticky.usage.iterations = [{ type: 'fallback_message' }];
    expect(fellBack(sticky)).toBe(true);
  });
});
