import type { Account, Entry } from '@/db/types';
import type { IsoDate } from '@/lib/dates';
import { toEurMinor, type RateMap } from '@/lib/fx';
import type { Minor } from '@/lib/money';

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
 * With `existing` (an edit) the new entry keeps its `id` and `createdAt`.
 */
export function buildTransfer(
  input: TransferInput,
  from: Account,
  rates: RateMap,
  now: Date,
  existing?: Entry,
): { ok: true; entry: Entry } | { ok: false; error: string } {
  if (input.fromAccountId === input.toAccountId) return { ok: false, error: 'Pick two different accounts.' };
  if (input.amountMinor <= 0) return { ok: false, error: 'Enter an amount.' };
  if (input.toAmountMinor <= 0) return { ok: false, error: 'Enter the amount received.' };

  const eurMinor = toEurMinor(input.amountMinor, from.currency, rates);
  if (eurMinor === null) {
    return { ok: false, error: `No exchange rate for ${from.currency} yet. Set one in Settings.` };
  }

  return {
    ok: true,
    entry: {
      id: existing?.id ?? crypto.randomUUID(),
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
