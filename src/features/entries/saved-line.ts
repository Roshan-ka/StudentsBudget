import type { Account } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import { formatDate, type IsoDate } from '@/lib/dates';

/**
 * What a Saved line lists after quick add or a receipt scan saved an expense: "€23.45 · REWE · Food & groceries", then
 * the account and the day only when they aren't the ones a line goes to anyway, the default account and today. Empty
 * parts (no note) are left out.
 */
export function savedWhat(
  saved: { amount: string; note: string; category: string; accountId: string; date: IsoDate },
  accounts: readonly Account[],
  today: IsoDate,
): string {
  const usual = defaultAccount(sortAccounts([...accounts]));
  const account = accounts.find((candidate) => candidate.id === saved.accountId);
  const parts = [
    saved.amount,
    saved.note,
    saved.category,
    account === undefined || account.id === usual?.id ? '' : account.name,
    saved.date === today ? '' : formatDate(saved.date),
  ];
  return parts.filter((part) => part !== '').join(' · ');
}
