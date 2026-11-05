import type { Account, Entry } from '@/db/types';
import { totalInEur } from '@/features/accounts/balances';
import type { Messages } from '@/i18n/messages';
import type { RateMap } from '@/lib/fx';
import { formatMoney } from '@/lib/money';

/**
 * The Accounts row's line on the Settings list (pain points, chunk 3): how many accounts, and their total in euros as
 * Home counts it. Without a rate for any account's currency nothing converts, so the total is a dash, as on Home.
 */
export function accountsSummary(
  accounts: Account[],
  entries: Entry[],
  rates: RateMap,
  t: Messages,
  locale: string,
): string {
  if (accounts.length === 0) return t.accounts.summaryNone;
  const total = totalInEur(accounts, entries, rates);
  const nothingConverted = accounts.every((a) => total.missingRates.includes(a.currency));
  return t.accounts.summary(
    accounts.length,
    nothingConverted ? '—' : formatMoney(total.totalMinor, 'EUR', { whole: true, locale }),
  );
}
