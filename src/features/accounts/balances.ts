import type { Account, Entry } from '@/db/types';
import { toEurMinor, type RateMap } from '@/lib/fx';
import type { CurrencyCode, Minor } from '@/lib/money';

/**
 * The balance of one account in its own currency: the opening balance, plus income and transfers in,
 * minus expenses and transfers out. A transfer in adds the amount received, not the amount sent.
 */
export function accountBalance(a: Account, entries: Entry[]): Minor {
  let balance = a.openingMinor;
  for (const entry of entries) {
    if (entry.type === 'transfer') {
      if (entry.accountId === a.id) balance -= entry.amountMinor;
      if (entry.toAccountId === a.id) balance += entry.toAmountMinor;
    } else if (entry.accountId === a.id) {
      balance += entry.type === 'income' ? entry.amountMinor : -entry.amountMinor;
    }
  }
  return balance;
}

/**
 * All balances converted to EUR and added up. An account whose currency has no rate is left out of
 * the total, and its currency is listed once in `missingRates`.
 */
export function totalInEur(
  accounts: Account[],
  entries: Entry[],
  rates: RateMap,
): { totalMinor: Minor; missingRates: CurrencyCode[] } {
  let totalMinor = 0;
  const missingRates: CurrencyCode[] = [];
  for (const account of accounts) {
    const eur = toEurMinor(accountBalance(account, entries), account.currency, rates);
    if (eur === null) {
      if (!missingRates.includes(account.currency)) missingRates.push(account.currency);
    } else {
      totalMinor += eur;
    }
  }
  return { totalMinor, missingRates };
}

/** A new array in the order the accounts were created, ties broken by name. */
export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

/** What `defaultAccount` reads: a stored account, or a setup option that carries the same fields. */
type DefaultCandidate = Pick<Account, 'currency'> & Partial<Pick<Account, 'kind' | 'isDefault'>>;

/**
 * The account new entries start from: the one marked as the default in Settings, else the first euro bank account,
 * else the first bank account, else the first account. "First" is the order of `accounts`, so pass them as
 * `sortAccounts` returns them. Undefined when there are none. A default that has been deleted leaves no mark behind,
 * so the rule applies again.
 */
export function defaultAccount<A extends DefaultCandidate>(accounts: readonly A[]): A | undefined {
  return (
    accounts.find((a) => a.isDefault) ??
    accounts.find((a) => a.kind === 'bank' && a.currency === 'EUR') ??
    accounts.find((a) => a.kind === 'bank') ??
    accounts[0]
  );
}
