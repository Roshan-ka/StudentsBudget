import type { Account } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';
import { callAi, type AiCallResult } from '@/features/ai/call';
import { CATEGORY_ID, MAX_LINE, quickAddAnswer, type QuickAddAnswer, type QuickAddRequest } from '@/features/ai/contract';
import { categoryNameIn } from '@/i18n/category-name';
import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { EXPENSE_CATEGORIES } from './categories';
import { readQuickAdd, suggestCategory } from './quick-add';
import {
  euroAccountId,
  localQuickAddProvider,
  type QuickAddContext,
  type QuickAddProvider,
  type QuickAddReading,
} from './quick-add-provider';

// Quick add read by Claude Haiku (the AI phase, chunk 6, docs/superpowers/plans/2026-11-09-ai-phase-1.md): the line,
// today, the language, the categories and the accounts go to the `ai` function through `callAi`, and the answer comes
// back as a `QuickAddReading`. The function has already held it to the request (chunk 4, `finishQuickAdd`: a listed
// category and account, a day from today back to 60 days, money to the cent), and the field still runs `checkReading`.
// Whatever goes wrong, the local reader reads the line instead; only a used-up allowance and an owed second step say
// so (`onHint`), since the student can do something about them.

/** The problems quick add mentions under the field; any other falls back to the local reader without a word. */
export type AiQuickAddHint = 'daily-limit' | 'second-step';

/** The most accounts and categories a request names, and the longest name (the contract's limits). */
const MAX_ACCOUNTS = 20;
const MAX_CATEGORIES = 60;
const NAME_LENGTH = 60;

/** A name as the contract takes it: on one line and at most NAME_LENGTH characters, else `fallback`. */
function nameFor(text: string, fallback: string): string {
  const name = Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, NAME_LENGTH).join('').trim();
  return name === '' ? fallback : name;
}

/** The request for one line, and the accounts behind its references, or null for a line the contract can't take. */
export function quickAddRequestFor(
  text: string,
  ctx: QuickAddContext,
  lang: Language,
): { request: QuickAddRequest; accountIds: Map<string, string> } | null {
  const line = text.trim();
  if (line === '' || line.length > MAX_LINE) return null;
  const t = MESSAGES[lang];

  // As `checkReading` allows: the built-in expense categories, then any other an earlier expense was filed under.
  const ids = [...EXPENSE_CATEGORIES.map((category) => category.id)];
  for (const entry of ctx.history) {
    if (entry.type === 'expense' && !ids.includes(entry.categoryId)) ids.push(entry.categoryId);
  }
  const categories = ids
    .filter((id) => CATEGORY_ID.safeParse(id).success)
    .slice(0, MAX_CATEGORIES)
    .map((id) => ({ id, name: nameFor(categoryNameIn(t, id), id) }));

  // a1, a2 … in the order Settings lists them; the ids never leave the phone.
  const accountIds = new Map<string, string>();
  const accounts = sortAccounts(ctx.accounts)
    .slice(0, MAX_ACCOUNTS)
    .map((account: Account, at) => {
      const ref = `a${at + 1}`;
      accountIds.set(ref, account.id);
      return { ref, name: nameFor(account.name, account.kind), kind: account.kind, currency: account.currency };
    });

  return { request: { feature: 'quick-add', lang, today: ctx.today, line, categories, accounts }, accountIds };
}

/**
 * The model's answer as a reading, or null when it found no amount. Amounts are in the account's currency, to the cent.
 * A category the model left open is the local suggestion (the history never leaves the phone). An account it didn't
 * name is, for a line written in euros on a phone whose default account isn't in euros, the euro account, as the local
 * reader does. Two readings ("coffee 7 40") become a choice, ordered as the local reader orders them; a choice has no
 * day.
 */
export function readingFrom(
  answer: QuickAddAnswer,
  text: string,
  ctx: QuickAddContext,
  accountIds: ReadonlyMap<string, string>,
): QuickAddReading | null {
  if (answer.amount === null) return null;
  const note = answer.note.trim();
  const categoryId = answer.categoryId ?? suggestCategory(note === '' ? text : note, ctx.history);
  const named = answer.accountRef === null ? undefined : accountIds.get(answer.accountRef);
  const accountId = named ?? (readQuickAdd(text)?.euro === true ? euroAccountId(ctx.accounts) : undefined);
  const account = accountId === undefined ? {} : { accountId };
  const amountMinor = Math.round(answer.amount * 100);
  if (answer.otherAmount !== null) {
    return { kind: 'choice', options: [amountMinor, Math.round(answer.otherAmount * 100)], note, categoryId, ...account };
  }
  return { kind: 'amount', amountMinor, note, categoryId, ...account, ...(answer.date !== null && { date: answer.date }) };
}

/** How the provider asks the function: `callAi` with quick add's answer, passed in so the tests can play it. */
export type AskQuickAdd = (
  request: QuickAddRequest,
  options: { signal?: AbortSignal },
) => Promise<AiCallResult<QuickAddAnswer>>;

const askFunction: AskQuickAdd = (request, options) => callAi(request, quickAddAnswer, options);

/**
 * Quick add's reader through the AI, in the phone's language. A line the contract can't take, any problem and an answer
 * without an amount are read by `local` instead; `onHint` hears `daily-limit` and `second-step` first. A read whose
 * signal aborts gives null, local or not: the line it was for is gone.
 */
export function aiQuickAddProvider(options: {
  lang: Language;
  onHint?: (hint: AiQuickAddHint) => void;
  local?: QuickAddProvider;
  ask?: AskQuickAdd;
}): QuickAddProvider {
  const local = options.local ?? localQuickAddProvider;
  const ask = options.ask ?? askFunction;
  return {
    async read(text, ctx, readOptions = {}) {
      const { signal } = readOptions;
      const built = quickAddRequestFor(text, ctx, options.lang);
      if (built !== null) {
        const result = await ask(built.request, { signal });
        if (result.ok) {
          const reading = readingFrom(result.answer, text, ctx, built.accountIds);
          if (reading !== null) return reading;
        } else if (result.problem === 'daily-limit' || result.problem === 'second-step') {
          options.onHint?.(result.problem);
        }
      }
      if (signal?.aborted) return null;
      return local.read(text, ctx, readOptions);
    },
  };
}
