'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import type { Plan } from '@/db/types';
import { totalInEur } from '@/features/accounts/balances';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { monthStatus, safeToSpend } from '@/lib/budget';
import { monthOf } from '@/lib/dates';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { EnvelopeList, type EnvelopeRow } from './envelope-list';
import { SafeToSpendCard } from './safe-to-spend-card';
import { useToday } from './use-today';

const currencyList = new Intl.ListFormat('en-IE', { style: 'long', type: 'conjunction' });

/** "INR rate missing", or "INR and USD rates missing". */
function missingRatesNote(currencies: CurrencyCode[]): string {
  return `${currencyList.format(currencies)} ${currencies.length === 1 ? 'rate' : 'rates'} missing`;
}

/**
 * The main screen: log a spending, see what is safe to spend this week, how the envelopes are filling and
 * what all the accounts add up to. It updates by itself when an entry is saved.
 */
export function HomeScreen({ plan }: { plan: Plan }) {
  // The date follows the clock, so the week turns over on its own when the app comes back or midnight passes,
  // with no entry saved in between. It is null until the browser runs this (never a date from the prerender).
  const today = useToday();
  const data = useLiveQuery(async () => {
    if (today === null) return null;
    const [entries, accounts, rates] = await Promise.all([db.entries.toArray(), db.accounts.toArray(), loadRates()]);
    return { today, entries, accounts, rates };
  }, [today]);

  let content = null;
  // Rendered from the date the data was read for, so a new day swaps in as one piece.
  if (data) {
    const { today, entries, accounts, rates } = data;
    const week = safeToSpend(plan, entries, today);
    const month = new Map(monthStatus(plan, entries, monthOf(today)).map((status) => [status.categoryId, status]));
    const rows = week.envelopes.flatMap((envelope): EnvelopeRow[] => {
      const status = month.get(envelope.categoryId);
      // Envelopes planned at €0 and never used would only add empty rows.
      if (!status || (status.plannedMinor <= 0 && status.spentMinor <= 0)) return [];
      return [
        {
          categoryId: envelope.categoryId,
          plannedMinor: status.plannedMinor,
          spentMinor: status.spentMinor,
          safeMinor: envelope.safeMinor,
        },
      ];
    });

    const total = totalInEur(accounts, entries, rates);
    // Without a rate for any account's currency nothing was converted, and €0 would read as a real total.
    const nothingConverted = accounts.every((a) => total.missingRates.includes(a.currency));

    content = (
      <>
        <SafeToSpendCard totalMinor={week.totalMinor} weekStart={week.weekStart} weekEnd={week.weekEnd} />
        <EnvelopeList rows={rows} />
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {`Across all accounts: ${nothingConverted ? '—' : formatMoney(total.totalMinor, 'EUR', { whole: true })}`}
          </p>
          {total.missingRates.length > 0 && (
            <p className="text-sm text-muted-foreground">{missingRatesNote(total.missingRates)}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <QuickAddField />
      {content}
    </div>
  );
}
