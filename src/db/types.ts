import type { IsoDate, IsoMonth } from '@/lib/dates';
import type { CurrencyCode, Minor } from '@/lib/money';

export type Account = {
  id: string;
  name: string;
  kind: 'bank' | 'cash';
  currency: CurrencyCode;
  openingMinor: Minor;
  createdAt: string;
};

export type CategoryKind = 'flexible' | 'fixed' | 'oneoff' | 'income';

export type Category = { id: string; name: string; kind: CategoryKind; order: number };

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
};

export type Entry =
  | (EntryBase & { type: 'expense' | 'income'; categoryId: string })
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

export type Plan = {
  id: 'current';
  cityId: 'regensburg';
  incomes: Amount[];
  fixed: Amount[];
  oneOffs: OneOff[];
  envelopes: Amount[];
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
