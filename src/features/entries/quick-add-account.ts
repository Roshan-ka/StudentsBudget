import type { Account } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';

/**
 * The account quick add saves to, so a line like "döner 6" lands where the money was spent: a euro cash
 * account, else any cash account, else a euro account, else the first account. The first of several that
 * qualify is the one created first. Undefined when there are no accounts.
 */
export function pickQuickAddAccount(accounts: Account[]): Account | undefined {
  const sorted = sortAccounts(accounts);
  return (
    sorted.find((a) => a.kind === 'cash' && a.currency === 'EUR') ??
    sorted.find((a) => a.kind === 'cash') ??
    sorted.find((a) => a.currency === 'EUR') ??
    sorted[0]
  );
}
