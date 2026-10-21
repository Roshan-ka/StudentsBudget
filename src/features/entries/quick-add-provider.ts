import type { Account, Entry } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import { isIsoDate } from '@/features/recurring/schedule';
import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { EXPENSE_CATEGORIES } from './categories';
import { parseQuickAdd, suggestCategory } from './quick-add';

/** What a provider reads a line against: today, the accounts, and every expense so far (`history`). */
export type QuickAddContext = { today: IsoDate; accounts: Account[]; history: Entry[] };

/**
 * What a provider made of one line: one amount, or two readings to choose from ("coffee 7 40": €7.40 or €40).
 * `categoryId` is null when the provider cannot tell; quick add then asks with the chips. An amount may name the
 * account and the day; without them quick add saves to the default account, dated today.
 */
export type QuickAddReading =
  | { kind: 'amount'; amountMinor: Minor; note: string; categoryId: string | null; accountId?: string; date?: IsoDate }
  | { kind: 'choice'; options: [Minor, Minor]; note: string; categoryId: string | null };

export type QuickAddAmountReading = Extract<QuickAddReading, { kind: 'amount' }>;
export type QuickAddChoiceReading = Extract<QuickAddReading, { kind: 'choice' }>;

/**
 * Reads one typed or dictated line. The local provider below is the parser quick add has always used; the AI phase
 * plugs in its own. Quick add passes every reading through `checkReading`, whichever provider made it.
 */
export interface QuickAddProvider {
  read(text: string, ctx: QuickAddContext): Promise<QuickAddReading | null>;
}

/** `parseQuickAdd` for the amount and `suggestCategory` for the category, once per line. */
export const localQuickAddProvider: QuickAddProvider = {
  async read(text, ctx) {
    const parsed = parseQuickAdd(text);
    if (parsed === null) return null;
    const categoryId = suggestCategory(parsed.note, ctx.history);
    return 'kind' in parsed
      ? { kind: 'choice', options: parsed.options, note: parsed.note, categoryId }
      : { kind: 'amount', amountMinor: parsed.amountMinor, note: parsed.note, categoryId };
  },
};

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

  if (reading.kind === 'choice') {
    if (!reading.options.every(isAmount)) return null;
    return { kind: 'choice', options: reading.options, note: reading.note, categoryId };
  }

  if (!isAmount(reading.amountMinor)) return null;
  const { accountId, date } = reading;
  return {
    kind: 'amount',
    amountMinor: reading.amountMinor,
    note: reading.note,
    categoryId,
    ...(accountId !== undefined && ctx.accounts.some((a) => a.id === accountId) && { accountId }),
    ...(date !== undefined && isIsoDate(date) && { date }),
  };
}

/** The amount tapped on a choice, with the note and the category the line was read with: nothing is read again. */
export function chosenAmount(choice: QuickAddChoiceReading, amountMinor: Minor): QuickAddAmountReading {
  return { kind: 'amount', amountMinor, note: choice.note, categoryId: choice.categoryId };
}

/**
 * The account a reading names, or the default account when it names none or one that is gone. `accounts` can come in
 * any order: the default rule counts from the one created first.
 */
export function accountFor(accounts: Account[], accountId: string | undefined): Account | undefined {
  return accounts.find((a) => a.id === accountId) ?? defaultAccount(sortAccounts(accounts));
}
