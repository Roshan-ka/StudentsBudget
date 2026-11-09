import type { Account } from '@/db/types';
import { fold } from './merchants';
import type { StatementRow } from './read-rows';

// Money moved between the student's own accounts (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md;
// Roshan, 09-11-2026): a row that names another of the student's accounts, a top-up or a cash withdrawal becomes a
// transfer, so balances and spending stay right. The account a transfer goes to or comes from:
// - the account whose name (three letters at least) the row's text holds as a whole word, the longest name winning;
// - else, for a top-up, the only other euro bank account; for a cash withdrawal, the only euro cash account.
// A transfer to an account in another currency needs the received amount, which a statement doesn't give: skipped.

export type TransferTarget =
  | { kind: 'none' }
  | { kind: 'transfer'; otherAccountId: string }
  | { kind: 'skip'; reason: 'otherCurrencyTransfer' | 'noTransferAccount' };

/** A cash withdrawal at a German bank: Sparkasse's booking text, a cash machine (Geldautomat, GAA, "GA NR…"), an ATM. */
const CASH = /\b(bargeldauszahlung|bargeldabhebung|bargeld|geldautomat|gaa|ga nr\w*|atm|cash withdrawal)\b/;

/** Whether the row is a cash withdrawal: the bank says so (Revolut's ATM), or its text does. */
export function isCashWithdrawal(row: StatementRow): boolean {
  return row.kind === 'cash' || (row.amountMinor < 0 && CASH.test(fold(`${row.bookingText} ${row.purpose}`)));
}

/**
 * Account names that say what an account is, not which: a shop's text holds them too ("Deutsche Bank", "Cash at
 * Sparkasse"), so they never name an account. A cash withdrawal finds the cash account by its kind instead.
 */
const GENERIC_NAMES = new Set(['bank', 'konto', 'girokonto', 'account', 'main account', 'cash', 'bargeld', 'wallet', 'geldbeutel', 'portemonnaie', 'card', 'karte']);

/** The other account the row names: its name as a whole word in the row's text, the longest name first. */
function namedAccount(row: StatementRow, account: Account, accounts: readonly Account[]): Account | null {
  const text = ` ${fold(`${row.payee} ${row.purpose} ${row.bookingText}`)} `;
  const named = accounts
    .filter((other) => other.id !== account.id && fold(other.name).replace(/[^\p{L}\p{N}]/gu, '').length >= 3)
    .filter((other) => !GENERIC_NAMES.has(fold(other.name)))
    .filter((other) => {
      const name = fold(other.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^\\p{L}\\p{N}])${name}($|[^\\p{L}\\p{N}])`, 'u').test(text);
    })
    .sort((a, b) => b.name.length - a.name.length);
  return named[0] ?? null;
}

/** The only other account of this kind in euros, or null for none or more than one. */
function onlyEuro(kind: Account['kind'], account: Account, accounts: readonly Account[]): Account | null {
  const found = accounts.filter((other) => other.id !== account.id && other.kind === kind && other.currency === 'EUR');
  return found.length === 1 ? found[0] : null;
}

/** Whether the row is a transfer between two of the student's accounts, and with which; or why it can't be one. */
export function transferTarget(row: StatementRow, account: Account, accounts: readonly Account[]): TransferTarget {
  const cash = isCashWithdrawal(row);
  // Cash goes into a cash account: one the row names, else the only one in euros. Never the bank whose machine it was.
  const other = cash
    ? (namedAccount(row, account, accounts.filter((a) => a.kind === 'cash')) ?? onlyEuro('cash', account, accounts))
    : (namedAccount(row, account, accounts) ?? (row.kind === 'topUp' ? onlyEuro('bank', account, accounts) : null));
  if (other === null) return row.kind === 'topUp' || cash ? { kind: 'skip', reason: 'noTransferAccount' } : { kind: 'none' };
  if (other.currency !== account.currency) return { kind: 'skip', reason: 'otherCurrencyTransfer' };
  return { kind: 'transfer', otherAccountId: other.id };
}
