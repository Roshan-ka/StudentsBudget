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
