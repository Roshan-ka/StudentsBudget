'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import type { Plan, Profile } from '@/db/types';
import { totalInEur } from '@/features/accounts/balances';
import { badgeHistory, badgesFrom, semesterWeeksFor } from '@/features/badges/badges';
import { BadgesCard } from '@/features/badges/badges-card';
import { CheckInCard } from '@/features/check-in/check-in-card';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { RecapLink } from '@/features/reveal/reveal-view';
import { listFormat } from '@/i18n/format';
import { PageHeading } from '@/components/page-heading';
import { useT } from '@/i18n/use-t';
import { monthStatus, weekToSpend } from '@/lib/budget';
import { monthOf } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { EnvelopeList, type EnvelopeRow } from './envelope-list';
import { LeftThisMonthCard } from './left-this-month-card';
import { SuggestedBudget } from './suggested-budget';

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
  const { t, lang, locale } = useT();
  const name = profile?.name.trim() ?? '';
  // The date follows the clock, so the week turns over on its own when the app comes back or midnight passes,
  // with no entry saved in between. It is null until the browser runs this (never a date from the prerender).
  const today = useToday();
  const data = useLiveQuery(async () => {
    if (today === null) return null;
    const [entries, accounts, rates, weekResults] = await Promise.all([
      db.entries.toArray(),
      db.accounts.toArray(),
      loadRates(),
      db.weekResults.toArray(),
    ]);
    return { today, entries, accounts, rates, weekResults };
  }, [today]);

  let content = null;
  // Rendered from the date the data was read for, so a new day swaps in as one piece.
  if (data) {
    const { today, entries, accounts, rates, weekResults } = data;
    const week = weekToSpend(plan, entries, today);
    const month = monthStatus(plan, entries, monthOf(today));
    const plannedMinor = month.reduce((total, status) => total + status.plannedMinor, 0);
    const spentMinor = month.reduce((total, status) => total + status.spentMinor, 0);
    // Negative once more has been spent than the envelopes planned, which the card says as "over".
    const leftMinor = plannedMinor - spentMinor;
    // Envelopes planned at €0 and never used would only add empty rows.
    const rows: EnvelopeRow[] = month.filter((status) => status.plannedMinor > 0 || status.spentMinor > 0);
    const badges = badgesFrom(
      weekResults,
      semesterWeeksFor(profile),
      badgeHistory(plan, entries, weekResults, today),
      lang,
    );

    const total = totalInEur(accounts, entries, rates);
    // Without a rate for any account's currency nothing was converted, and €0 would read as a real total.
    const nothingConverted = accounts.every((a) => total.missingRates.includes(a.currency));

    content = (
      <>
        <LeftThisMonthCard
          leftMinor={leftMinor}
          weekMinor={week.totalMinor}
          plannedMinor={plannedMinor}
          spentMinor={spentMinor}
        />
        <EnvelopeList rows={rows} today={today} />
        {/* Keyed by month: an installed app stays mounted for days, and "Not now", typed amounts and the saved note
            should not carry into the next month. */}
        <SuggestedBudget key={monthOf(today)} plan={plan} entries={entries} today={today} />
        {/* Quiet lines, not cards (pain points, chunk 2); only Sunday's check-in is a card. */}
        <div className="flex flex-col gap-1">
          <CheckInCard today={today} />
          <BadgesCard badges={badges} />
          {/* Shows once a month is over. */}
          <RecapLink startedOn={plan.createdOn} today={today} />
        </div>
        <div className={cn(cardVariants(), 'gap-1')}>
          <p className="font-semibold">
            {t.home.acrossAccounts(
              nothingConverted ? '—' : formatMoney(total.totalMinor, 'EUR', { whole: true, locale }),
            )}
          </p>
          {total.missingRates.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t.home.missingRates(listFormat(locale).format(total.missingRates), total.missingRates.length)}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading id="home" visuallyHidden />
      {name !== '' && (
        <p className="font-heading text-[28px] leading-tight font-extrabold tracking-tight break-words">
          {t.home.greeting(name)}
        </p>
      )}
      <QuickAddField />
      {content}
    </div>
  );
}
