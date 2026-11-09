import { describe, expect, it, vi } from 'vitest';
import type { Account, Entry } from '@/db/types';
import { quickAddRequest, type QuickAddAnswer } from '@/features/ai/contract';
import type { AiCallProblem, AiCallResult } from '@/features/ai/call';
import { categoryNameIn } from '@/i18n/category-name';
import { MESSAGES } from '@/i18n/messages';
import { aiQuickAddProvider, quickAddRequestFor, type AskQuickAdd } from './ai-quick-add';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories';
import { checkReading, localQuickAddProvider, type QuickAddContext } from './quick-add-provider';

function account(id: string, name: string, kind: Account['kind'], currency: Account['currency'], createdAt: string): Account {
  return { id, name, kind, currency, openingMinor: 0, createdAt };
}

// Settings lists the bank first (created first), then cash: a1 and a2.
const bank = account('acc-bank', 'Sparkasse', 'bank', 'EUR', '2026-10-01T09:00:00.000Z');
const cash = account('acc-cash', 'Cash', 'cash', 'EUR', '2026-10-01T10:00:00.000Z');

function expense(note: string, categoryId: string): Entry {
  return {
    id: `e-${note}`,
    type: 'expense',
    date: '2026-11-02',
    accountId: 'acc-bank',
    amountMinor: 600,
    eurMinor: 600,
    categoryId,
    note,
    createdAt: '2026-11-02T10:00:00.000Z',
  };
}

const CTX: QuickAddContext = { today: '2026-11-09', accounts: [cash, bank], history: [expense('döner', 'eating-out')] };

const EXAMPLE = '12 for pizza with Tom yesterday, paid cash';

const ANSWER: QuickAddAnswer = {
  amount: 12,
  otherAmount: null,
  note: 'pizza with Tom',
  categoryId: 'eating-out',
  accountRef: 'a2',
  date: '2026-11-08',
};

/** A function that answers `answer`, or refuses with `problem`, and remembers what it was asked. */
function asking(result: QuickAddAnswer | AiCallProblem) {
  return vi.fn<AskQuickAdd>(
    async (): Promise<AiCallResult<QuickAddAnswer>> =>
      typeof result === 'string' ? { ok: false, problem: result } : { ok: true, answer: result, left: 49 },
  );
}

describe('quickAddRequestFor', () => {
  it('names the line, today, the language, the expense categories in that language and the accounts as a1, a2 …', () => {
    const built = quickAddRequestFor(`  ${EXAMPLE} `, CTX, 'de')!;
    const { request } = built;

    expect(quickAddRequest.safeParse(request).success).toBe(true);
    expect(request).toMatchObject({ feature: 'quick-add', lang: 'de', today: '2026-11-09', line: EXAMPLE });
    // Every built-in expense category, in German; no income category.
    expect(request.categories.map((c) => c.id)).toEqual(EXPENSE_CATEGORIES.map((c) => c.id));
    expect(request.categories.find((c) => c.id === 'eating-out')?.name).toBe(categoryNameIn(MESSAGES.de, 'eating-out'));
    expect(request.categories.some((c) => INCOME_CATEGORIES.some((i) => i.id === c.id))).toBe(false);
    // In the order Settings lists them, and never by id.
    expect(request.accounts).toEqual([
      { ref: 'a1', name: 'Sparkasse', kind: 'bank', currency: 'EUR' },
      { ref: 'a2', name: 'Cash', kind: 'cash', currency: 'EUR' },
    ]);
    expect(JSON.stringify(request)).not.toContain('acc-');
    expect(Object.fromEntries(built.accountIds)).toEqual({ a1: 'acc-bank', a2: 'acc-cash' });
  });

  it('adds a category an earlier expense was filed under, as checkReading allows', () => {
    const ctx = { ...CTX, history: [...CTX.history, expense('climbing gym', 'climbing')] };
    const { request } = quickAddRequestFor('climbing 12', ctx, 'en')!;
    expect(request.categories.at(-1)).toEqual({ id: 'climbing', name: 'climbing' });
  });

  it('takes no line the contract can’t: empty, or longer than 200 characters', () => {
    expect(quickAddRequestFor('   ', CTX, 'en')).toBeNull();
    expect(quickAddRequestFor(`döner 6 ${'x'.repeat(200)}`, CTX, 'en')).toBeNull();
  });

  it('cuts an account name to 60 characters on one line', () => {
    const long = account('acc-long', `My\nvery ${'long '.repeat(20)}name`, 'bank', 'EUR', '2026-10-01T08:00:00.000Z');
    const { request } = quickAddRequestFor('döner 6', { ...CTX, accounts: [long] }, 'en')!;
    expect(request.accounts[0].name).toHaveLength(60);
    expect(request.accounts[0].name).not.toContain('\n');
    expect(quickAddRequest.safeParse(request).success).toBe(true);
  });
});

describe('aiQuickAddProvider', () => {
  it('reads the example line as €12 · Eating out · Cash · yesterday', async () => {
    const ask = asking(ANSWER);
    const reading = await aiQuickAddProvider({ lang: 'en', ask }).read(EXAMPLE, CTX);

    expect(reading).toEqual({
      kind: 'amount',
      amountMinor: 1200,
      note: 'pizza with Tom',
      categoryId: 'eating-out',
      accountId: 'acc-cash',
      date: '2026-11-08',
    });
    // The field's own checks keep all of it.
    expect(checkReading(reading, CTX)).toEqual(reading);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('passes the field’s signal on to the call', async () => {
    const ask = asking(ANSWER);
    const controller = new AbortController();
    await aiQuickAddProvider({ lang: 'en', ask }).read(EXAMPLE, CTX, { signal: controller.signal });
    expect(ask.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it('turns cents into whole cents without float noise', async () => {
    const reading = await aiQuickAddProvider({ lang: 'en', ask: asking({ ...ANSWER, amount: 4.35 }) }).read('x 4,35', CTX);
    expect(reading).toMatchObject({ amountMinor: 435 });
  });

  it('offers both readings of "coffee 7 40", as the local reader orders them, and a choice names no day', async () => {
    const answer = { ...ANSWER, amount: 7.4, otherAmount: 40, note: 'coffee', categoryId: null, accountRef: null };
    const reading = await aiQuickAddProvider({ lang: 'en', ask: asking(answer) }).read('coffee 7 40', CTX);
    const local = await localQuickAddProvider.read('coffee 7 40', CTX);

    expect(reading).toEqual({ kind: 'choice', options: [740, 4000], note: 'coffee', categoryId: null });
    expect(reading?.kind === 'choice' && local?.kind === 'choice' && reading.options).toEqual(
      local?.kind === 'choice' && local.options,
    );
  });

  it('fills a category the model left open from this phone’s history, which never leaves it', async () => {
    const answer = { ...ANSWER, note: 'döner', categoryId: null };
    const ask = asking(answer);
    const reading = await aiQuickAddProvider({ lang: 'en', ask }).read('döner 6', CTX);

    expect(reading).toMatchObject({ categoryId: 'eating-out' });
    expect(JSON.stringify(ask.mock.calls[0][0])).not.toContain('e-döner');
  });

  it('saves a line written in euros to the euro account when the default isn’t in euros, as the local reader does', async () => {
    // Marked as the default: otherwise the euro cash account would be the default already.
    const rupees: Account = { ...account('acc-inr', 'Home bank', 'bank', 'INR', '2026-10-01T08:00:00.000Z'), isDefault: true };
    const ctx: QuickAddContext = { ...CTX, accounts: [rupees, cash] };
    const answer = { ...ANSWER, amount: 6, note: 'Döner', accountRef: null, date: null };

    const reading = await aiQuickAddProvider({ lang: 'en', ask: asking(answer) }).read('Döner 6 €', ctx);
    expect(reading).toMatchObject({ amountMinor: 600, accountId: 'acc-cash' });
    // Without a euro marker the default account stays.
    const plain = await aiQuickAddProvider({ lang: 'en', ask: asking(answer) }).read('Döner 6', ctx);
    expect(plain).not.toHaveProperty('accountId');
  });

  it('reads the line on the phone when the model found no amount', async () => {
    const reading = await aiQuickAddProvider({ lang: 'en', ask: asking({ ...ANSWER, amount: null }) }).read('döner 6', CTX);
    expect(reading).toEqual(await localQuickAddProvider.read('döner 6', CTX));
  });

  it('falls back to the local reader quietly on any other problem', async () => {
    for (const problem of ['off', 'offline', 'timeout', 'unavailable', 'failed', 'refused', 'busy', 'signed-out', 'bad-request'] as const) {
      const onHint = vi.fn();
      const reading = await aiQuickAddProvider({ lang: 'en', ask: asking(problem), onHint }).read('döner 6', CTX);
      expect(reading, problem).toEqual(await localQuickAddProvider.read('döner 6', CTX));
      expect(onHint, problem).not.toHaveBeenCalled();
    }
  });

  it('says when the day’s allowance is used up or the second step is owed, and still reads the line locally', async () => {
    for (const problem of ['daily-limit', 'second-step'] as const) {
      const onHint = vi.fn();
      const reading = await aiQuickAddProvider({ lang: 'en', ask: asking(problem), onHint }).read('döner 6', CTX);
      expect(onHint).toHaveBeenCalledWith(problem);
      expect(reading).toEqual(await localQuickAddProvider.read('döner 6', CTX));
    }
  });

  it('gives nothing for a read whose line is gone, not even the local reading', async () => {
    const controller = new AbortController();
    const local = { read: vi.fn(localQuickAddProvider.read) };
    const ask = vi.fn<AskQuickAdd>(async () => {
      controller.abort();
      return { ok: false, problem: 'aborted' };
    });

    expect(await aiQuickAddProvider({ lang: 'en', ask, local }).read('döner 6', CTX, { signal: controller.signal })).toBeNull();
    expect(local.read).not.toHaveBeenCalled();
  });

  it('reads a line the contract can’t take on the phone, without asking', async () => {
    const ask = asking(ANSWER);
    const long = `döner 6 ${'x'.repeat(200)}`;
    expect(await aiQuickAddProvider({ lang: 'en', ask }).read(long, CTX)).toEqual(await localQuickAddProvider.read(long, CTX));
    expect(ask).not.toHaveBeenCalled();
  });
});
