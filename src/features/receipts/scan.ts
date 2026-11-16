import type { Account } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import { CORE_FLEXIBLE_CATEGORIES, FLEXIBLE_CATEGORIES } from '@/features/entries/categories';
import type { IsoDate } from '@/lib/dates';
import { amountInputText } from '@/lib/money';
import type { ReceiptReading } from './read-receipt';

// The receipt scan's card (chunk 4, docs/superpowers/plans/2026-11-13-receipt-scan.md), apart from React: the engine it
// is handed, the fields it starts with, and the category chips it shows.

/**
 * The text recognition the card is handed (chunk 1's `ocr.ts`): it reads a photo into text on the phone, reporting
 * how much is done (0 to 1), and stops when `signal` aborts. `downloadMb` is the first scan's download, which the note
 * before it names.
 */
export type ReceiptEngine = {
  downloadMb: number;
  read: (image: File, options: { signal: AbortSignal; onProgress: (share: number) => void }) => Promise<string>;
};

/** What the check card's fields hold: the amount as typed text, and every choice by id (none for the category). */
export type ScanDraft = { amount: string; date: IsoDate; note: string; categoryId: string | null; accountId: string };

/**
 * The fields a scan starts the card with, and whether the receipt was read: it was when a total was found. Without
 * one the card asks the student to type it in ("Couldn't read this receipt"), still holding whatever else was found.
 * The date is the receipt's or today, the account the default one (`defaultAccount`).
 */
export function draftOf(
  reading: ReceiptReading | null,
  accounts: readonly Account[],
  today: IsoDate,
  locale: string,
): { draft: ScanDraft; found: boolean } {
  const account = defaultAccount(sortAccounts([...accounts]));
  const total = reading?.amountMinor ?? null;
  return {
    found: total !== null,
    draft: {
      amount: total === null ? '' : amountInputText(total, locale),
      date: reading?.date ?? today,
      note: reading?.note ?? '',
      categoryId: reading?.categoryId ?? null,
      accountId: account?.id ?? '',
    },
  };
}

const CORE_IDS = CORE_FLEXIBLE_CATEGORIES.map((category) => category.id);
const MORE_IDS = FLEXIBLE_CATEGORIES.map((category) => category.id).filter((id) => !CORE_IDS.includes(id));

/**
 * The category chips, in order: the six core ones, the chosen one when it isn't among them (a fixed cost such as
 * Phone & internet, or one behind More while More is closed), so the reading always shows as a pressed chip, then the
 * rest behind More while it is open.
 */
export function chipIds(chosen: string | null, moreOpen: boolean): string[] {
  const shown = moreOpen ? [...CORE_IDS, ...MORE_IDS] : CORE_IDS;
  return chosen === null || shown.includes(chosen) ? shown : [...CORE_IDS, chosen, ...(moreOpen ? MORE_IDS : [])];
}
