import type { Account, Entry } from '@/db/types';
import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import type { IsoDate } from '@/lib/dates';
import { toEurMinor, type RateMap } from '@/lib/fx';
import type { Minor } from '@/lib/money';
import { newId } from '@/lib/new-id';

/** The field an input error is about, so the form can mark that field and tie the message to it. */
export type EntryField = 'account' | 'toAccount' | 'amount' | 'received';

/** What is wrong with the input, in `lang`, and the field it is about. */
export type InputError = { ok: false; error: string; field: EntryField };

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  /** Sent, in the sending account's currency. */
  amountMinor: Minor;
  /** Received, in the receiving account's currency. */
  toAmountMinor: Minor;
  date: IsoDate;
  note: string;
};

/**
 * Builds the transfer entry, or says what is wrong with the input. `eurMinor` is the sending side
 * converted to EUR with the rate on file, so a missing rate for the sending currency is an error.
 * With `existing` (an edit) the new entry keeps its `id` and `createdAt`. It also keeps its `eurMinor`
 * (and needs no rate) while the sending account and the amount sent are unchanged: the EUR value was fixed
 * when that amount was entered, so a later edit of the date or note must not move it. The error is in `lang`.
 */
export function buildTransfer(
  input: TransferInput,
  from: Account,
  rates: RateMap,
  now: Date,
  existing?: Entry,
  lang: Language = 'en',
): { ok: true; entry: Entry } | InputError {
  const t = MESSAGES[lang];
  if (input.fromAccountId === input.toAccountId) return { ok: false, error: t.accounts.transfer.pickTwo, field: 'toAccount' };
  if (input.amountMinor <= 0) return { ok: false, error: t.entries.errors.enterAmount, field: 'amount' };
  if (input.toAmountMinor <= 0) return { ok: false, error: t.accounts.transfer.enterReceived, field: 'received' };

  const unchanged =
    existing !== undefined && existing.accountId === input.fromAccountId && existing.amountMinor === input.amountMinor;
  const eurMinor = unchanged ? existing.eurMinor : toEurMinor(input.amountMinor, from.currency, rates);
  if (eurMinor === null) return { ok: false, error: t.entries.errors.noRate(from.currency), field: 'account' };

  return {
    ok: true,
    entry: {
      id: existing?.id ?? newId(),
      type: 'transfer',
      date: input.date,
      accountId: input.fromAccountId,
      amountMinor: input.amountMinor,
      eurMinor,
      note: input.note.trim(),
      createdAt: existing?.createdAt ?? now.toISOString(),
      toAccountId: input.toAccountId,
      toAmountMinor: input.toAmountMinor,
    },
  };
}
