import type { Account, Entry } from '@/db/types';
import { defaultAccount, euroAccount, sortAccounts } from '@/features/accounts/balances';
import { isIsoDate } from '@/features/recurring/schedule';
import type { Language } from '@/i18n/languages';
import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { EXPENSE_CATEGORIES } from './categories';
import { guessCategory } from './category-words';
import { numberWordsToDigits } from './number-words';
import { readQuickAdd, type QuickAddLine } from './quick-add';
import { lineDates } from './quick-add-date';

/**
 * What a provider reads a line against: today, the accounts, every expense so far (`history`), and the phone's
 * language, whose date words the local reader knows besides English (none given: English only).
 */
export type QuickAddContext = { today: IsoDate; accounts: Account[]; history: Entry[]; lang?: Language };

/**
 * What a provider made of one line: one amount, or two readings to choose from ("coffee 7 40": €7.40 or €40).
 * `categoryId` is null when the provider cannot tell; quick add then asks with the chips. An amount may name the
 * account and the day; without them quick add saves to the default account, dated today. A choice may name the account
 * too, so its two buttons show that account's currency and the amount tapped is saved there.
 */
export type QuickAddReading =
  | { kind: 'amount'; amountMinor: Minor; note: string; categoryId: string | null; accountId?: string; date?: IsoDate }
  | { kind: 'choice'; options: [Minor, Minor]; note: string; categoryId: string | null; accountId?: string; date?: IsoDate };

export type QuickAddAmountReading = Extract<QuickAddReading, { kind: 'amount' }>;
export type QuickAddChoiceReading = Extract<QuickAddReading, { kind: 'choice' }>;

/** How a read may be cut short: `signal` aborts a read in flight when the line changes or the page goes. */
export type QuickAddReadOptions = { signal?: AbortSignal };

/**
 * Reads one typed or dictated line. The local provider below is the parser quick add has always used; the AI phase
 * plugs in its own (`aiQuickAddProvider`, which asks the model and stops when `signal` aborts). Quick add passes every
 * reading through `checkReading`, whichever provider made it.
 */
export interface QuickAddProvider {
  read(text: string, ctx: QuickAddContext, options?: QuickAddReadOptions): Promise<QuickAddReading | null>;
}

/**
 * The euro account a line written in euros is saved to, when the default account is not in euros: "Döner 6 €" must not
 * become ₹6. The first euro bank account, else any euro account. Undefined when the default is in euros already (the
 * field saves there), or when there is no euro account at all (the default stays).
 */
export function euroAccountId(accounts: Account[]): string | undefined {
  const ordered = sortAccounts(accounts);
  const fallback = defaultAccount(ordered);
  return fallback === undefined || fallback.currency === 'EUR' ? undefined : euroAccount(ordered)?.id;
}

/**
 * `readQuickAdd` for the amount and `guessCategory` for the category, once per line. A line with a euro sign, "eur"
 * or "euro" next to the amount names a euro account when the default account is not in euros. A date in the line
 * ("on 27 november 2025", "gestern"; `lineDates`) is taken out first and dates the reading: the first one that leaves
 * an amount, so "6 mai Döner" stays €6 with no date. Before both, the phone language's number words become digits
 * (`numberWordsToDigits`: "Döner sechs Euro fünfzig" reads as "Döner 6 Euro 50").
 */
export const localQuickAddProvider: QuickAddProvider = {
  async read(text, ctx) {
    const { line, date: day } = readLineParts(text, ctx);
    if (line === null) return null;
    const { reading: parsed, euro } = line;
    const categoryId = guessCategory(parsed.note, ctx.history);
    const accountId = euro ? euroAccountId(ctx.accounts) : undefined;
    const account = accountId === undefined ? {} : { accountId };
    const date = day === undefined ? {} : { date: day };
    return 'kind' in parsed
      ? { kind: 'choice', options: parsed.options, note: parsed.note, categoryId, ...account, ...date }
      : { kind: 'amount', amountMinor: parsed.amountMinor, note: parsed.note, categoryId, ...account, ...date };
  },
};

/**
 * A line as the local reader reads it before its category: the phone language's number words as digits
 * (`numberWordsToDigits`), then the first date that leaves an amount (`lineDates`), with the amount and note from the
 * rest; with no such date, the whole line and no day. The AI reader takes its day from here too (18-11-2026), so a day
 * the line names is read the same way whichever reader reads the amount.
 */
export function readLineParts(text: string, ctx: QuickAddContext): { line: QuickAddLine | null; date?: IsoDate } {
  const lang = ctx.lang ?? 'en';
  const typed = numberWordsToDigits(text, lang);
  const dated = lineDates(typed, ctx.today, lang)
    .map((found) => ({ date: found.date, line: readQuickAdd(found.rest) }))
    .find((candidate) => candidate.line !== null);
  return dated === undefined ? { line: readQuickAdd(typed) } : { line: dated.line, date: dated.date };
}

const EXPENSE_CATEGORY_IDS = new Set(EXPENSE_CATEGORIES.map((c) => c.id));

/** Whole cents above zero, the only amount quick add saves. */
function isAmount(minor: Minor): boolean {
  return Number.isSafeInteger(minor) && minor > 0;
}

/**
 * The reading with only what the context backs: a category an expense can be filed under (built in, or one an
 * earlier expense was filed under), an account that exists and a real day. Anything else is dropped, so quick add
 * falls back to the chips, the default account and today. An amount that is not whole cents above zero is no reading.
 */
export function checkReading(reading: QuickAddReading | null, ctx: QuickAddContext): QuickAddReading | null {
  if (reading === null) return null;
  const wanted = reading.categoryId;
  const known =
    wanted !== null &&
    (EXPENSE_CATEGORY_IDS.has(wanted) || ctx.history.some((e) => e.type === 'expense' && e.categoryId === wanted));
  const categoryId = known ? wanted : null;

  const { accountId } = reading;
  const account = accountId !== undefined && ctx.accounts.some((a) => a.id === accountId) ? { accountId } : {};

  const { date } = reading;
  const day = date !== undefined && isIsoDate(date) ? { date } : {};
  if (reading.kind === 'choice') {
    if (!reading.options.every(isAmount)) return null;
    return { kind: 'choice', options: reading.options, note: reading.note, categoryId, ...account, ...day };
  }

  if (!isAmount(reading.amountMinor)) return null;
  return {
    kind: 'amount',
    amountMinor: reading.amountMinor,
    note: reading.note,
    categoryId,
    ...account,
    ...day,
  };
}

/**
 * The amount tapped on a choice, with the note, the category, the account and the day the line was read with: nothing
 * is read again.
 */
export function chosenAmount(choice: QuickAddChoiceReading, amountMinor: Minor): QuickAddAmountReading {
  const { accountId, date } = choice;
  return {
    kind: 'amount',
    amountMinor,
    note: choice.note,
    categoryId: choice.categoryId,
    ...(accountId !== undefined && { accountId }),
    ...(date !== undefined && { date }),
  };
}

/**
 * The account a reading names, or the default account when it names none or one that is gone. `accounts` can come in
 * any order: the default rule counts from the one created first.
 */
export function accountFor(accounts: Account[], accountId: string | undefined): Account | undefined {
  return accounts.find((a) => a.id === accountId) ?? defaultAccount(sortAccounts(accounts));
}
