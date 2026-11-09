import type { Entry, Plan } from '@/db/types';

/**
 * Whether an account's currency is fixed: an entry books on it (a transfer, either way), or a fixed cost or income line
 * posts to it. A schedule keeps its amount in the account's currency, so changing the currency would read the same
 * number in another one: ₹20,000 from home would post as €20,000 (review, 09-11-2026). The rule is the one
 * `accountUse` applies before a delete.
 */
export function currencyFixed(accountId: string, entries: readonly Entry[], plan: Plan | null | undefined): boolean {
  if (entries.some((e) => e.accountId === accountId || (e.type === 'transfer' && e.toAccountId === accountId))) {
    return true;
  }
  if (!plan) return false;
  return [...plan.incomes, ...plan.fixed].some((line) => line.schedule?.accountId === accountId);
}
