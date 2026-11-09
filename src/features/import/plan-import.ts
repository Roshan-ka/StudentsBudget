import type { Account, Category, Entry, ImportMark, Plan } from '@/db/types';
import type { EntryInput } from '@/features/entries/build-entry';
import { monthOf, todayIso, type IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { categorize } from './categorize';
import { merchantKey } from './merchants';
import { importNote } from './note';
import { findOverlaps } from './overlap';
import type { ReadRows, StatementRow } from './read-rows';
import { transferTarget } from './transfers';

// What an import will do (CSV import, docs/superpowers/plans/2026-11-09-csv-import-export.md), worked out from the
// statement's rows and what the phone holds, without writing anything: the entries to add, the rows left out and why,
// and how each touched account's starting balance moves. `saveImport` (chunk 5) runs it again inside its transaction
// and writes the result; the summary shows it.

/** Why a row isn't imported, in the order they are checked. */
export type SkipReason =
  | 'unreadable'
  | 'pending'
  | 'internal'
  | 'zero'
  | 'currency'
  | 'future'
  | 'beforePlan'
  | 'otherCurrencyTransfer'
  | 'noTransferAccount'
  | 'duplicate';

/** A row left out, with what the summary shows of it: its date, amount (in `currency`, the row's or the account's) and text. */
export type SkippedRow = {
  index: number;
  reason: SkipReason;
  date: IsoDate | null;
  amountMinor: Minor | null;
  currency: string | null;
  text: string;
};

/** An entry to add: the input `buildEntry` takes (it converts to EUR and gives the id), its mark, and its row. */
export type ImportDraft = { input: EntryInput; imported: ImportMark; row: StatementRow };

export type ImportPlan = {
  add: ImportDraft[];
  skipped: SkippedRow[];
  /**
   * How each account's `openingMinor` moves (Roshan, 09-11-2026): an entry dated before the day an account was added
   * is already inside the balance typed in then, so the account's start moves the other way and today's balance stays.
   */
  openingChanges: Map<string, Minor>;
};

export type ImportInput = {
  read: ReadRows;
  /** The account the statement is for. */
  account: Account;
  accounts: readonly Account[];
  entries: readonly Entry[];
  categories: readonly Category[];
  /** Rows before the plan's month have no plan to count against: left out. Without a plan, nothing is. */
  plan: Plan | null;
  batchId: string;
  now: Date;
};

/** A left-out row as the summary shows it: cleaned as a note is, so no card or account number reaches the screen. */
const rowText = (row: StatementRow) => importNote(row);

/** The local day an account was added. */
const addedOn = (account: Account) => todayIso(new Date(account.createdAt));

export function planImport({ read, account, accounts, entries, categories, plan, batchId, now }: ImportInput): ImportPlan {
  const today = todayIso(now);
  const planMonth = plan === null ? null : monthOf(plan.createdOn);
  const skipped: SkippedRow[] = read.unread.map((row) => ({
    index: row.index,
    reason: 'unreadable',
    date: null,
    amountMinor: null,
    currency: null,
    text: row.text,
  }));
  const skip = (row: StatementRow, reason: SkipReason) =>
    skipped.push({
      index: row.index,
      reason,
      date: row.date,
      amountMinor: row.amountMinor,
      currency: row.currency ?? account.currency,
      text: rowText(row),
    });

  // The rows that could be entries, before overlap is checked against what the phone holds.
  const candidates: { row: StatementRow; target: ReturnType<typeof transferTarget> }[] = [];
  for (const row of read.rows) {
    if (row.pending) skip(row, 'pending');
    else if (row.kind === 'internal') skip(row, 'internal');
    else if (row.amountMinor === 0) skip(row, 'zero');
    else if (row.currency !== null && row.currency !== account.currency) skip(row, 'currency');
    else if (row.date > today) skip(row, 'future');
    else if (planMonth !== null && monthOf(row.date) < planMonth) skip(row, 'beforePlan');
    else {
      const target = transferTarget(row, account, accounts);
      if (target.kind === 'skip') skip(row, target.reason);
      else candidates.push({ row, target });
    }
  }

  const overlaps = findOverlaps(candidates.map(({ row }) => row), account.id, entries);
  const add: ImportDraft[] = [];
  for (const { row, target } of candidates) {
    if (overlaps.has(row.index)) {
      skip(row, 'duplicate');
      continue;
    }
    const note = importNote(row);
    const amount = Math.abs(row.amountMinor);
    if (target.kind === 'transfer') {
      const out = row.amountMinor < 0;
      add.push({
        input: {
          type: 'transfer',
          date: row.date,
          accountId: out ? account.id : target.otherAccountId,
          toAccountId: out ? target.otherAccountId : account.id,
          amountMinor: amount,
          // Both accounts are in one currency (transferTarget checks): what leaves one arrives in the other.
          toAmountMinor: amount,
          note,
        },
        imported: { batchId, merchant: merchantKey(row.payee, row.purpose) },
        row,
      });
    } else {
      const { categoryId, merchant } = categorize(row, entries, categories);
      add.push({
        input: { type: row.amountMinor < 0 ? 'expense' : 'income', date: row.date, accountId: account.id, amountMinor: amount, categoryId, note },
        imported: { batchId, merchant, guess: categoryId },
        row,
      });
    }
  }

  skipped.sort((a, b) => a.index - b.index);
  return { add, skipped, openingChanges: openingChanges(add, accounts) };
}

/** How each account's start moves for the drafts dated before the day it was added: by what they move on it, reversed. */
function openingChanges(add: readonly ImportDraft[], accounts: readonly Account[]): Map<string, Minor> {
  const added = new Map(accounts.map((account) => [account.id, addedOn(account)]));
  const changes = new Map<string, Minor>();
  const move = (accountId: string, date: IsoDate, by: Minor) => {
    const since = added.get(accountId);
    if (since === undefined || date >= since) return;
    changes.set(accountId, (changes.get(accountId) ?? 0) - by);
  };
  for (const { input } of add) {
    if (input.type === 'transfer') {
      move(input.accountId, input.date, -input.amountMinor);
      move(input.toAccountId, input.date, input.toAmountMinor);
    } else {
      move(input.accountId, input.date, input.type === 'income' ? input.amountMinor : -input.amountMinor);
    }
  }
  for (const [id, change] of changes) if (change === 0) changes.delete(id);
  return changes;
}
