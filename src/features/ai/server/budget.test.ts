import { describe, expect, it } from 'vitest';
import {
  MAX_ANSWER,
  MAX_LINE,
  MAX_QUESTION,
  MAX_QUESTIONS,
  MAX_SNAPSHOT,
  type AskRequest,
  type QuickAddRequest,
} from '@/features/ai/contract';
import { askBuilder, askSystem } from '../../../../supabase/functions/_shared/ai/ask';
import { callTokens, GROQ_FREE_PLAN, MAX_CALL_TOKENS } from '../../../../supabase/functions/_shared/ai/budget';
import { CITY_PACK } from '../../../../supabase/functions/_shared/ai/city-pack';
import { renderPackBrief } from '../../../../supabase/functions/_shared/ai/pack';
import { PICK_LIMITS } from '../../../../supabase/functions/_shared/ai/pack-select';
import { quickAddBuilder } from '../../../../supabase/functions/_shared/ai/quick-add';

// What a call may cost on Groq's free plan (the Groq switch, chunk 4): the largest request the contract allows, in
// letters that take two bytes, stays under MAX_CALL_TOKENS with its output limit.

const bytes = (text: string) => new TextEncoder().encode(text).length;

/** JSON of `size` bytes, in two-byte letters. */
function data(size: number) {
  const padding = JSON.stringify({ notes: [''] }).length;
  return { notes: ['ä'.repeat(Math.floor((size - padding) / 2))] };
}

describe('the free plan’s budget', () => {
  it('leaves a call 1,000 tokens under the minute’s limit', () => {
    expect(MAX_CALL_TOKENS).toBe(GROQ_FREE_PLAN.tokensPerMinute - 1_000);
  });

  it('fits quick add’s largest call: 60 categories, 20 accounts and the longest line', () => {
    const request: QuickAddRequest = {
      feature: 'quick-add',
      lang: 'de',
      today: '2026-11-13',
      line: 'ä'.repeat(MAX_LINE),
      categories: Array.from({ length: 60 }, (_, i) => ({ id: `c${'x'.repeat(37)}${String(i).padStart(2, '0')}`, name: 'ä'.repeat(60) })),
      accounts: Array.from({ length: 20 }, (_, i) => ({ ref: `a${i + 1}`, name: 'ä'.repeat(60), kind: 'bank' as const, currency: 'EUR' })),
    };
    expect(callTokens(quickAddBuilder.call(request))).toBeLessThanOrEqual(MAX_CALL_TOKENS);
  });

  it('fits Ask’s largest call: the fullest snapshot, six questions, and the most city data a pick can hold', () => {
    const turns: AskRequest['turns'] = [];
    for (let at = 0; at < MAX_QUESTIONS; at += 1) {
      turns.push({ role: 'user', text: 'ä'.repeat(MAX_QUESTION) });
      if (at < MAX_QUESTIONS - 1) turns.push({ role: 'assistant', text: 'ä'.repeat(MAX_ANSWER) });
    }
    const request: AskRequest = { feature: 'ask', lang: 'de', today: '2026-11-13', snapshot: data(MAX_SNAPSHOT), turns };
    expect(bytes(JSON.stringify(request.snapshot))).toBeLessThanOrEqual(MAX_SNAPSHOT);
    const call = askBuilder.call(request);

    // The picks hold at most PICK_LIMITS.maxChars characters; at the pack's most bytes a character, that many bytes.
    const perCharacter = Math.max(...CITY_PACK.map((item) => bytes(renderPackBrief([item])) / renderPackBrief([item]).length));
    const mostCityData = 'x'.repeat(Math.ceil(PICK_LIMITS.maxChars * perCharacter));
    const worst = { ...call, system: `${askSystem([])}${mostCityData}` };

    expect(callTokens(call)).toBeLessThanOrEqual(callTokens(worst));
    expect(callTokens(worst)).toBeLessThanOrEqual(MAX_CALL_TOKENS);
  });

  it('counts the output limit and every part of the call', () => {
    const request: QuickAddRequest = {
      feature: 'quick-add',
      lang: 'en',
      today: '2026-11-13',
      line: 'döner 6',
      categories: [{ id: 'eating-out', name: 'Eating out' }],
      accounts: [],
    };
    const call = quickAddBuilder.call(request);
    const tokens = callTokens(call);
    expect(tokens).toBeGreaterThan(call.maxTokens + bytes(call.system) / 3);
    expect(callTokens({ ...call, maxTokens: call.maxTokens + 100 })).toBe(tokens + 100);
    expect(callTokens({ ...call, system: `${call.system}${'x'.repeat(300)}` })).toBe(tokens + 100);
  });
});
