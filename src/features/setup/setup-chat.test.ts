import { describe, expect, it } from 'vitest';
import { MAX_SETUP_MESSAGES, setupRequest } from '@/features/ai/contract';
import { categoryNameIn } from '@/i18n/category-name';
import { MESSAGES } from '@/i18n/messages';
import { formatMoney } from '@/lib/money';
import { draftForChat } from './chat-patch';
import { initialDraft } from './draft';
import { changeLines, chatFull, chatProblemText, setupRequestOf, type SetupTurn } from './setup-chat';

const en = MESSAGES.en;
const DRAFT = draftForChat(initialDraft(false, 'en'));

const answered = (message: string, text: string): SetupTurn => ({
  message,
  reply: { text, sourceIds: [], changes: [] },
  problem: null,
});

describe('setupRequestOf', () => {
  it('sends the draft as it is now, the answered messages with their replies, then the new one', () => {
    const turns: SetupTurn[] = [
      answered('I get 500 from my parents', 'I filled in €500 from your parents.'),
      // A message without a reply goes back to the model only when it is sent again.
      { message: 'and rent?', reply: null, problem: 'timeout' },
    ];
    const request = setupRequestOf(turns, 'Rent is 400', DRAFT, 'de', '2026-11-09');

    expect(request).toEqual({
      feature: 'setup',
      lang: 'de',
      today: '2026-11-09',
      draft: DRAFT,
      turns: [
        { role: 'user', text: 'I get 500 from my parents' },
        { role: 'assistant', text: 'I filled in €500 from your parents.' },
        { role: 'user', text: 'Rent is 400' },
      ],
    });
    expect(setupRequest.safeParse(request).success).toBe(true);
  });
});

describe('chatFull', () => {
  it('is full at fifteen answered messages, and only answered ones count', () => {
    const fourteen = Array.from({ length: MAX_SETUP_MESSAGES - 1 }, (_, i) => answered(`m${i}`, `r${i}`));
    expect(chatFull(fourteen)).toBe(false);
    expect(chatFull([...fourteen, { message: 'x', reply: null, problem: 'busy' }])).toBe(false);
    expect(chatFull([...fourteen, answered('m', 'r')])).toBe(true);
  });

  it('builds a request the contract takes at the fullest a chat gets', () => {
    const fourteen = Array.from({ length: MAX_SETUP_MESSAGES - 1 }, (_, i) => answered(`m${i}`, `r${i}`));
    expect(setupRequest.safeParse(setupRequestOf(fourteen, 'last', DRAFT, 'en', '2026-11-09')).success).toBe(true);
  });
});

describe('changeLines', () => {
  it('names each thing a turn filled in, with its amount in the phone’s language', () => {
    const changes = [
      { step: 'fixed' as const, what: 'rent', minor: 40000 },
      { step: 'envelopes' as const, what: 'food', minor: 31000 },
      { step: 'envelopes' as const, what: 'budget', minor: 60000 },
      { step: 'accounts' as const, what: 'accounts' },
    ];

    expect(changeLines(changes, en, 'en-IE')).toEqual([
      `${categoryNameIn(en, 'rent')}: €400.00`,
      `${categoryNameIn(en, 'food')}: €310.00`,
      'Everyday budget: €600.00',
      'Your accounts',
    ]);
    expect(changeLines(changes.slice(0, 1), MESSAGES.de, 'de-DE')).toEqual([
      `${categoryNameIn(MESSAGES.de, 'rent')}: ${formatMoney(40000, 'EUR', { locale: 'de-DE' })}`,
    ]);
    // French puts its narrow no-break space before the colon.
    expect(changeLines(changes.slice(2, 3), MESSAGES.fr, 'fr-FR')).toEqual([
      `Budget du quotidien : ${formatMoney(60000, 'EUR', { locale: 'fr-FR' })}`,
    ]);
  });
});

describe('chatProblemText', () => {
  it('says what to do for each problem, and that something went wrong for the rest', () => {
    const text = en.setup.chat;
    expect(chatProblemText('daily-limit', text)).toBe(text.problems.dailyLimit);
    expect(chatProblemText('busy', text)).toBe(text.problems.busy);
    expect(chatProblemText('refused', text)).toBe(text.problems.refused);
    expect(chatProblemText('unavailable', text)).toBe(text.problems.unavailable);
    expect(chatProblemText('offline', text)).toBe(text.problems.offline);
    expect(chatProblemText('timeout', text)).toBe(text.problems.timeout);
    expect(chatProblemText('signed-out', text)).toBe(text.problems.signedOut);
    expect(chatProblemText('second-step', text)).toBe(text.problems.needsCode);
    expect(chatProblemText('off', text)).toBe(text.switchedOff);
    for (const problem of ['failed', 'bad-request', 'too-large'] as const) {
      expect(chatProblemText(problem, text)).toBe(text.problems.failed);
    }
  });
});
