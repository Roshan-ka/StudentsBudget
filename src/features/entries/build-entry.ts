import type { Account, Entry } from '@/db/types';
import { buildTransfer } from '@/features/accounts/transfer';
import type { IsoDate } from '@/lib/dates';
import { toEurMinor, type RateMap } from '@/lib/fx';
import type { Minor } from '@/lib/money';

export type EntryInput =
  | { id?: string; type: 'expense' | 'income'; date: IsoDate; accountId: string; amountMinor: Minor; categoryId: string; note: string }
  | { id?: string; type: 'transfer'; date: IsoDate; accountId: string; amountMinor: Minor; toAccountId: string; toAmountMinor: Minor; note: string };

/**
 * Builds the entry to save, or says what is wrong with the input. `account` is the account the entry is
 * booked on (the sending account of a transfer). `eurMinor` is converted with the rate on file, so a
 * currency without one is an error. Transfers go through `buildTransfer` and report its errors.
 * With `existing` (an edit) the entry keeps that entry's `id` and `createdAt`; otherwise it keeps
 * `input.id` when there is one and gets a new id.
 */
export function buildEntry(
  input: EntryInput,
  account: Account,
  rates: RateMap,
  now: Date,
  existing?: Entry,
): { ok: true; entry: Entry } | { ok: false; error: string } {
  const built = build(input, account, rates, now, existing);
  if (!built.ok) return built;
  return { ok: true, entry: { ...built.entry, id: existing?.id ?? input.id ?? built.entry.id } };
}

function build(
  input: EntryInput,
  account: Account,
  rates: RateMap,
  now: Date,
  existing: Entry | undefined,
): { ok: true; entry: Entry } | { ok: false; error: string } {
  if (input.type === 'transfer') {
    const { accountId, ...rest } = input;
    return buildTransfer({ ...rest, fromAccountId: accountId }, account, rates, now, existing);
  }

  if (input.amountMinor <= 0) return { ok: false, error: 'Enter an amount.' };
  const eurMinor = toEurMinor(input.amountMinor, account.currency, rates);
  if (eurMinor === null) {
    return { ok: false, error: `No exchange rate for ${account.currency} yet. Set one in Settings.` };
  }

  return {
    ok: true,
    entry: {
      id: existing?.id ?? crypto.randomUUID(),
      type: input.type,
      date: input.date,
      accountId: input.accountId,
      amountMinor: input.amountMinor,
      eurMinor,
      categoryId: input.categoryId,
      note: input.note.trim(),
      createdAt: existing?.createdAt ?? now.toISOString(),
    },
  };
}
