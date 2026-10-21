'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import type { Plan, Profile } from '@/db/types';
import { totalInEur } from '@/features/accounts/balances';
import { badgeHistory, badgesFrom, semesterWeeksFor } from '@/features/badges/badges';
import { BadgesCard } from '@/features/badges/badges-card';
import { CheckInCard } from '@/features/check-in/check-in-card';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { RevealCard } from '@/features/reveal/reveal-view';
import { monthStatus, safeToSpend } from '@/lib/budget';
import { monthOf } from '@/lib/dates';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { EnvelopeList, type EnvelopeRow } from './envelope-list';
import { LeftThisMonthCard } from './left-this-month-card';
import { SuggestedBudget } from './suggested-budget';

const currencyList = new Intl.ListFormat('en-IE', { style: 'long', type: 'conjunction' });

/** "INR rate missing", or "INR and USD rates missing". */
function missingRatesNote(currencies: CurrencyCode[]): string {
  return `${currencyList.format(currencies)} ${currencies.length === 1 ? 'rate' : 'rates'} missing`;
}

/**
 * The main screen: log a spending, see what is left to spend this month (and this week), how the envelopes are
 * filling, a suggested budget, the badges and what all the accounts add up to. It updates by itself when an entry is
 * saved or a week is recorded.
 */
export function HomeScreen({
  plan,
  profile,
}: {
  plan: Plan;
  /** Read with the plan: its name is the greeting, and its semester sets gold Under-Budget Week. */
  profile: Profile | null;
}) {
  const name = profile?.name.trim() ?? '';
  // The date follows the clock, so the week turns over on its own when the app comes back or midnight passes,
  // with no entry saved in between. It is null until the browser runs this (never a date from the prerender).
  const today = useToday();
  const data = useLiveQuery(async () => {
    if (today === null) return null;
    const [entries, accounts, rates, weekResults, guessCount] = await Promise.all([
      db.entries.toArray(),
      db.accounts.toArray(),
      loadRates(),
      db.weekResults.toArray(),
      db.guesses.count(),
    ]);
    return { today, entries, accounts, rates, weekResults, guessCount };
  }, [today]);

  let content = null;
  // Rendered from the date the data was read for, so a new day swaps in as one piece.
  if (data) {
    const { today, entries, accounts, rates, weekResults, guessCount } = data;
    const week = safeToSpend(plan, entries, today);
    const month = monthStatus(plan, entries, monthOf(today));
    // Negative once more has been spent than the envelopes planned, which the card says as "over".
    const leftMinor = month.reduce((total, status) => total + status.plannedMinor - status.spentMinor, 0);
    // Envelopes planned at €0 and never used would only add empty rows.
    const rows: EnvelopeRow[] = month.filter((status) => status.plannedMinor > 0 || status.spentMinor > 0);
    const badges = badgesFrom(weekResults, semesterWeeksFor(profile), badgeHistory(plan, entries, weekResults, today));

    const total = totalInEur(accounts, entries, rates);
    // Without a rate for any account's currency nothing was converted, and €0 would read as a real total.
    const nothingConverted = accounts.every((a) => total.missingRates.includes(a.currency));

    content = (
      <>
        <LeftThisMonthCard leftMinor={leftMinor} weekMinor={week.totalMinor} />
        <EnvelopeList rows={rows} today={today} />
        {/* Keyed by month: an installed app stays mounted for days, and "Not now", typed amounts and the saved note
            should not carry into the next month. */}
        <SuggestedBudget key={monthOf(today)} plan={plan} entries={entries} today={today} />
        <CheckInCard today={today} />
        <BadgesCard badges={badges} />
        {/* Guesses are optional: with none saved there is nothing to unlock. */}
        {guessCount > 0 && <RevealCard startedOn={plan.createdOn} today={today} />}
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
      {name !== '' && <p className="text-lg font-semibold break-words">{`Hi ${name}`}</p>}
      <QuickAddField />
      {content}
    </div>
  );
}
