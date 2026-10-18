'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { db } from '@/db/db';
import type { Entry, Guess, Plan } from '@/db/types';
import { categoryName } from '@/features/entries/categories';
import type { IsoDate, IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { formatWeekAmount } from '@/lib/week-amount';
import { REVEAL_MIN_DAYS, completedMonths, guessVsReality, monthRecap, unlockOn, type GuessRow } from './reveal';

const LINK_CLASS = 'text-primary underline-offset-4 hover:underline';

const dayAndMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });
const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });

// `parseISO` reads a date-only string as local midnight, so the day never shifts.
const formatDay = (date: IsoDate): string => dayAndMonth.format(parseISO(date));

/** "You guessed €80. It was €190." Whole euros, except that a non-zero amount under 50 cents keeps its cents. */
function guessLine(row: GuessRow): string {
  const guessed = formatWeekAmount(row.guessMinor).text;
  const actual = formatWeekAmount(row.actualMonthlyMinor).text;
  return `You guessed ${guessed}. It was ${actual}.`;
}

/** "October 2026: €15 left over → savings", or "October 2026: €12 over plan". Calm either way. */
function recapLine(month: IsoMonth, leftoverMinor: Minor): string {
  const label = monthAndYear.format(parseISO(`${month}-01`));
  const { text } = formatWeekAmount(leftoverMinor);
  if (leftoverMinor > 0) return `${label}: ${text} left over → savings`;
  if (leftoverMinor < 0) return `${label}: ${text} over plan`;
  return `${label}: right on plan`;
}

/**
 * The teaser on home. Until the reveal unlocks it says when, and what it is; after that it is the way in.
 * Both dates are passed in, so nothing here reads the clock.
 */
export function RevealCard({ startedOn, today }: { startedOn: IsoDate; today: IsoDate }) {
  const unlockDate = unlockOn(startedOn);

  if (today >= unlockDate) {
    return (
      <Link
        href="/reveal"
        className="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-3 font-medium"
      >
        See how your guesses compare
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <section aria-label="Your guesses" className="flex flex-col items-start gap-1 rounded-lg border px-4 py-3">
      <p className="font-medium">{`Your guesses unlock on ${formatDay(unlockDate)}.`}</p>
      <Link href="/reveal" className={`${LINK_CLASS} inline-flex min-h-8 items-center text-sm`}>
        What&apos;s this?
      </Link>
    </section>
  );
}

function Locked({ unlockDate }: { unlockDate: IsoDate }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{`Your guesses unlock on ${formatDay(unlockDate)}. Keep logging.`}</p>
      <p className="text-muted-foreground">
        {'At setup you guessed what you spend each month. ' +
          `After ${REVEAL_MIN_DAYS} days of logging, you will see how your guesses compare with what you really spent.`}
      </p>
    </div>
  );
}

function Revealed({ rows, startedOn, today }: { rows: GuessRow[]; startedOn: IsoDate; today: IsoDate }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No guesses were saved in setup, so there is nothing to compare yet.</p>
      ) : (
        <>
          <ul aria-label="Your guesses" className="flex flex-col gap-4">
            {rows.map((row) => (
              <li key={row.categoryId} className="flex flex-col gap-0.5">
                <p className="font-medium break-words">{categoryName(row.categoryId)}</p>
                <p className="tabular-nums">{guessLine(row)}</p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {`Your spending from ${formatDay(startedOn)} to ${formatDay(today)}, scaled to a month of 30 days.`}
          </p>
        </>
      )}
      <Link href="/setup?edit=1" className={buttonVariants({ className: 'h-10 self-start px-4' })}>
        Adjust my plan
      </Link>
    </div>
  );
}

function Recaps({ guesses, plan, entries, today }: { guesses: Guess[]; plan: Plan; entries: Entry[]; today: IsoDate }) {
  const headingId = useId();
  const months = completedMonths(plan.createdOn, today);
  if (months.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold">
        Month by month
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-col gap-2">
        {months.map((month) => (
          <li key={month}>{recapLine(month, monthRecap(guesses, plan, entries, month).leftoverMinor)}</li>
        ))}
      </ul>
    </section>
  );
}

function Reveal({ plan, guesses, entries, today }: { plan: Plan; guesses: Guess[]; entries: Entry[]; today: IsoDate }) {
  const { unlocked, unlockOn: unlockDate, rows } = guessVsReality(guesses, entries, plan.createdOn, today);

  return (
    <div className="flex flex-col gap-8">
      {unlocked ? (
        <Revealed rows={rows} startedOn={plan.createdOn} today={today} />
      ) : (
        <Locked unlockDate={unlockDate} />
      )}
      <Recaps guesses={guesses} plan={plan} entries={entries} today={today} />
    </div>
  );
}

/** What you guessed against what you spent, once there are 21 days of it, and how each finished month went. */
export function RevealView() {
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const guesses = useLiveQuery(() => db.guesses.toArray(), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  if (today === null || plan === 'loading' || guesses === undefined || entries === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        Set up your plan to compare your guesses with what you spend.{' '}
        <Link href="/setup" className={LINK_CLASS}>
          Start setup
        </Link>
      </p>
    );
  }
  return <Reveal plan={plan} guesses={guesses} entries={entries} today={today} />;
}
