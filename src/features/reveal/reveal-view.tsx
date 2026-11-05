'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRightIcon, ScaleIcon } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import type { Entry, Guess, Plan } from '@/db/types';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { formatWeekAmount } from '@/lib/week-amount';
import { REVEAL_MIN_DAYS, completedMonths, guessVsReality, monthRecap, unlockOn, type GuessRow } from './reveal';
import { formatDay, recapLine } from './reveal-text';

const LINK_CLASS = 'text-primary underline-offset-4 hover:underline';

/** "You guessed €80. It was €190." Whole euros, except that a non-zero amount under 50 cents keeps its cents. */
function guessLine(row: GuessRow, t: Messages, locale: string): string {
  const guessed = formatWeekAmount(row.guessMinor, locale).text;
  const actual = formatWeekAmount(row.actualMonthlyMinor, locale).text;
  return t.reveal.guessLine(guessed, actual);
}

/**
 * The teaser on home, as one quiet line (pain points, chunk 2). Until the reveal unlocks it says when, and what it is;
 * after that it is the way in. It stays: this is the only way to the reveal and its month-by-month recaps. Both dates
 * are passed in, so nothing here reads the clock.
 */
export function RevealCard({ startedOn, today }: { startedOn: IsoDate; today: IsoDate }) {
  const { t, locale } = useT();
  const text = t.reveal.card;
  const unlockDate = unlockOn(startedOn);

  if (today >= unlockDate) {
    return (
      <Link href="/reveal" className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <ScaleIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">{text.open}</span>
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
      </Link>
    );
  }

  return (
    <section aria-label={text.label} className="flex min-h-11 flex-wrap items-center gap-x-3 text-sm">
      <ScaleIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">{text.unlocksOn(formatDay(unlockDate, locale))}</p>
      <Link href="/reveal" className={`${LINK_CLASS} inline-flex min-h-11 items-center`}>
        {text.whatsThis}
      </Link>
    </section>
  );
}

function Locked({ unlockDate }: { unlockDate: IsoDate }) {
  const { t, locale } = useT();
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{t.reveal.locked.unlocksOn(formatDay(unlockDate, locale))}</p>
      <p className="text-muted-foreground">{t.reveal.locked.explain(REVEAL_MIN_DAYS)}</p>
    </div>
  );
}

function Revealed({ rows, startedOn, today }: { rows: GuessRow[]; startedOn: IsoDate; today: IsoDate }) {
  const { t, locale } = useT();
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t.reveal.listLabel} className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.categoryId} className="flex flex-col gap-0.5">
            <p className="font-medium break-words">{categoryNameIn(t, row.categoryId)}</p>
            <p className="tabular-nums">{guessLine(row, t, locale)}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        {t.reveal.scaled(formatDay(startedOn, locale), formatDay(today, locale))}
      </p>
      <Link href="/setup?edit=1&step=envelopes" className={buttonVariants({ className: 'self-start px-4' })}>
        {t.reveal.adjust}
      </Link>
    </div>
  );
}

function Recaps({ guesses, plan, entries, today }: { guesses: Guess[]; plan: Plan; entries: Entry[]; today: IsoDate }) {
  const headingId = useId();
  const { t, lang } = useT();
  const months = completedMonths(plan.createdOn, today);
  if (months.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cardVariants()}>
      <h3 id={headingId} className="text-xl leading-tight font-extrabold">
        {t.reveal.monthByMonth}
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-col gap-2">
        {months.map((month) => (
          <li key={month}>
            {recapLine(month, monthRecap(guesses, plan, entries, month).leftoverMinor, plan.createdOn, lang)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reveal({ plan, guesses, entries, today }: { plan: Plan; guesses: Guess[]; entries: Entry[]; today: IsoDate }) {
  const { t } = useT();
  const { unlocked, unlockOn: unlockDate, rows } = guessVsReality(guesses, entries, plan.createdOn, today);

  return (
    <div className="flex flex-col gap-8">
      {guesses.length === 0 ? (
        // Guesses are optional, so there may be none to wait for.
        <p className="text-muted-foreground">{t.reveal.noGuesses}</p>
      ) : unlocked ? (
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
  const { t } = useT();
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const guesses = useLiveQuery(() => db.guesses.toArray(), []);
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  if (today === null || plan === 'loading' || guesses === undefined || entries === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        {t.reveal.noPlan}{' '}
        <Link href="/setup" className={LINK_CLASS}>
          {t.reveal.startSetup}
        </Link>
      </p>
    );
  }
  return <Reveal plan={plan} guesses={guesses} entries={entries} today={today} />;
}
