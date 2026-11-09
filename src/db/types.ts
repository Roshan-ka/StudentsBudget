import type { IsoDate, IsoMonth } from '@/lib/dates';
import type { CurrencyCode, Minor } from '@/lib/money';
import type { ServerTable } from '@/sync/tables';

export type Account = {
  id: string;
  name: string;
  kind: 'bank' | 'cash';
  currency: CurrencyCode;
  /** Negative for an account that starts overdrawn. */
  openingMinor: Minor;
  createdAt: string;
  /**
   * The account new entries, quick add and transfers start from, chosen in Settings. At most one account has it; with
   * none, `defaultAccount` picks by rule. It is not indexed, so it needed no new schema version.
   */
  isDefault?: true;
};

export type CategoryKind = 'flexible' | 'fixed' | 'oneoff' | 'income';

export type Category = { id: string; name: string; kind: CategoryKind; order: number };

/**
 * The mark of an entry that an imported bank statement row made (CSV import,
 * docs/superpowers/plans/2026-11-09-csv-import-export.md). `batchId` names the import, so Undo removes it whole;
 * `merchant` is the shop name the import read, so learning categories works even after the note is edited; `guess` is
 * the category the import gave the row (none for a transfer), so a category that differs from it is the student's own
 * choice, and only that is learned from.
 */
export type ImportMark = { batchId: string; merchant: string; guess?: string };

type EntryBase = {
  id: string;
  date: IsoDate;
  accountId: string;
  /** In the account's own currency. */
  amountMinor: Minor;
  /** Converted to EUR when the entry is saved. */
  eurMinor: Minor;
  note: string;
  createdAt: string;
  /** Set on an entry a statement import made. It stays when the entry is edited; not indexed, so no new schema version. */
  imported?: ImportMark;
};

export type Entry =
  | (EntryBase & {
      type: 'expense' | 'income';
      categoryId: string;
      /** Set on an entry a schedule posted. It stays when the entry is edited. */
      recurring?: { scheduleId: string };
    })
  | (EntryBase & { type: 'transfer'; toAccountId: string; toAmountMinor: Minor });

export type OneOff = {
  id: string;
  name: string;
  amountMinor: Minor;
  createdMonth: IsoMonth;
  dueMonth: IsoMonth;
};

/** Plan, envelope and city amounts are always EUR. */
export type Amount = { categoryId: string; monthlyMinor: Minor };

/**
 * When an income or fixed line posts itself as entries. `amountMinor` is per occurrence, in the account's currency.
 * `postedThrough` is a watermark: every period that ends on or before it has been handled, so nothing posts twice.
 */
export type Schedule = {
  id: string;
  frequency: 'monthly' | 'weekly';
  /** Monthly: 1–31, clipped to the month's last day. Weekly: 1 = Monday … 7 = Sunday. */
  day: number;
  accountId: string;
  amountMinor: Minor;
  /** The first day an occurrence may fall on. */
  startOn: IsoDate;
  postedThrough: IsoDate;
  paused?: boolean;
};

/** An income or fixed line: the monthly amount, and optionally the schedule that posts it. */
export type PlanLine = Amount & { schedule?: Schedule };

export type Plan = {
  id: 'current';
  cityId: 'regensburg';
  incomes: PlanLine[];
  fixed: PlanLine[];
  oneOffs: OneOff[];
  envelopes: Amount[];
  /**
   * The monthly everyday-spending budget setup asked for, in EUR: rent and fixed costs are not part of it. It only
   * guides the envelope suggestions, in setup and in Home's suggested budget, and blocks nothing. A plan saved without
   * one has none.
   */
  spendingBudgetMinor?: Minor;
  createdOn: IsoDate;
};

/** Saved once in setup, never edited afterwards. */
export type Guess = { categoryId: string; monthlyMinor: Minor; guessedOn: IsoDate };

export type Rate = {
  currency: CurrencyCode;
  perEur: number;
  rateDate: IsoDate;
  fetchedOn: IsoDate;
  source: 'ecb' | 'manual';
};

/**
 * What one finished week came to, saved once (from the Wednesday after it) so badges can read it without the plan of
 * that day. The week runs Monday to Sunday and `weekStart` is its key. Amounts are EUR; `paused` marks a week the user
 * was away. Until a week is recorded, a row with an empty `recordedAt` and no amounts only keeps its "I was away"
 * mark; the week fills it in when it is recorded.
 */
export type WeekResult = {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  plannedMinor: Minor;
  spentMinor: Minor;
  foodSpentMinor: Minor;
  eatingOutSpentMinor: Minor;
  /** Expenses dated in the week that the user typed in: no transfers, no income, none a schedule posted. */
  handLoggedCount: number;
  paused: boolean;
  recordedAt: string;
};

/** The user's verdict on one discount. One vote per discount: voting again replaces it. */
export type DiscountVote = { discountId: string; vote: 'works' | 'outdated'; on: IsoDate };

/** One row, like the plan. A field the user has not chosen yet is the empty string. */
export type Profile = {
  id: 'current';
  name: string;
  university: 'ur' | 'oth' | 'other' | '';
  semesterStart: IsoDate | '';
  semesterEnd: IsoDate | '';
  updatedAt: string;
};

/**
 * One row of this phone that changed and still has to reach the account: which server table, the row's server id, and
 * when it was recorded (`seq`, rising). Only the key is kept; a push sends the row as it is then. One entry per row:
 * a later change replaces it. `auto`: only the poster changed the row since it last synced (a recurring entry, the
 * plan's watermarks), so a push adds it where the account has none and never writes it over the account's copy.
 */
export type OutboxEntry = { table: ServerTable; id: string; seq: number; auto?: true };

/**
 * This phone's link to an account, one row like the plan. `userId` is the account it syncs with (null: not linked, and
 * nothing is recorded in the outbox); `cursor` the highest revision it has pulled.
 */
export type SyncState = {
  id: 'current';
  userId: string | null;
  cursor: number;
  lastSyncedAt: string | null;
  problem: string | null;
};
