import { describe, expect, it } from 'vitest';
import { askRequest, type AskReply } from '@/features/ai/contract';
import { MESSAGES } from '@/i18n/messages';
import { askRequestOf, conversationFull, paragraphsOf, problemText, type AskTurn } from './conversation';
import type { AskSnapshot } from './snapshot';

// An Ask conversation on the phone (the AI phase, chunk 10).

const SNAPSHOT = { month: '2026-11', categories: {} } as unknown as AskSnapshot;
const reply = (answer: string): AskReply => ({ answer, sourceIds: [], unbacked: [] });

describe('askRequestOf', () => {
  it('sends the answered questions with their answers, then the new one; a question without an answer stays out', () => {
    const turns: AskTurn[] = [
      { question: 'How much is left?', reply: reply('€312.40.'), problem: null },
      { question: 'Why?', reply: null, problem: 'timeout' },
    ];
    const request = askRequestOf(turns, 'And this week?', SNAPSHOT, 'de', '2026-11-09');
    expect(request).toEqual({
      feature: 'ask',
      lang: 'de',
      today: '2026-11-09',
      snapshot: SNAPSHOT,
      turns: [
        { role: 'user', text: 'How much is left?' },
        { role: 'assistant', text: '€312.40.' },
        { role: 'user', text: 'And this week?' },
      ],
    });
    expect(askRequest.safeParse(request).success).toBe(true);
  });

  it('is full after six answered questions, and the sixth still fits the contract', () => {
    const answered = (n: number): AskTurn[] =>
      Array.from({ length: n }, (_, i) => ({ question: `Q${i}`, reply: reply(`A${i}`), problem: null }));
    expect(conversationFull(answered(5))).toBe(false);
    expect(askRequest.safeParse(askRequestOf(answered(5), 'Q5', SNAPSHOT, 'en', '2026-11-09')).success).toBe(true);
    expect(conversationFull(answered(6))).toBe(true);
    expect(conversationFull([...answered(5), { question: 'Q', reply: null, problem: 'failed' }])).toBe(false);
  });
});

describe('paragraphsOf', () => {
  it('splits where the model left a blank line, and keeps single breaks inside a paragraph', () => {
    expect(paragraphsOf('First line\nstill first.\n\n  Second.  \n\n\n')).toEqual(['First line\nstill first.', 'Second.']);
  });
});

describe('problemText', () => {
  it('says why for every problem, the account ones as the page says them', () => {
    const text = MESSAGES.en.ask;
    expect(problemText('daily-limit', text)).toBe(text.problems.dailyLimit);
    expect(problemText('second-step', text)).toBe(text.needsCode);
    expect(problemText('off', text)).toBe(text.switchedOff);
    expect(problemText('too-large', text)).toBe(text.problems.failed);
  });
});
