'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheckIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import type { Entry, Plan, PlanMonth } from '@/db/types';
import { dateFormat } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import { planForMonth } from '@/lib/plan-history';
import { useToday } from '@/lib/use-today';
import { completedMonths, monthRecap } from './reveal';
import { recapLine } from './reveal-text';

const LINK_CLASS = 'text-primary underline-offset-4 hover:underline';

/** "October", "Oktober", "octobre": a month's name alone, in the language's own case. */
const monthName = (month: IsoMonth, locale: string): string =>
  dateFormat(locale, { month: 'long' }).format(parseISO(`${month}-01`));

/**
 * Home's way to the month-by-month recaps, as one quiet line (pain points, chunk 2): "See how October went", for the
 * latest month that is over. Nothing while the setup month is still running. Both dates are passed in, so nothing here
 * reads the clock.
 */
export function RecapLink({ startedOn, today }: { startedOn: IsoDate; today: IsoDate }) {
  const { t, locale } = useT();
  const [latest] = completedMonths(startedOn, today);
  if (latest === undefined) return null;
  return (
    <Link href="/reveal" className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <CalendarCheckIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{t.reveal.link(monthName(latest, locale))}</span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
    </Link>
  );
}

/** Each month that is over against the envelopes, newest first, and the way to change them. */
function Recaps({
  plan,
  planMonths,
  entries,
  today,
}: {
  plan: Plan;
  planMonths: PlanMonth[];
  entries: Entry[];
  today: IsoDate;
}) {
  const { t, lang, locale } = useT();
  const months = completedMonths(plan.createdOn, today);
  if (months.length === 0) {
    return <p className="text-muted-foreground">{t.reveal.notYet(monthName(monthOf(plan.createdOn), locale))}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The page's one section, named by its heading (PageHeading's htmlId). */}
      <section aria-labelledby="reveal-heading" className={cardVariants()}>
        <p className="text-muted-foreground">{t.reveal.intro}</p>
        <ul aria-labelledby="reveal-heading" className="flex list-disc flex-col gap-2 ps-5">
          {months.map((month) => (
            // Each month against the plan it had (plan history).
            <li key={month}>
              {recapLine(month, monthRecap(planForMonth(plan, planMonths, month, today), entries, month).leftoverMinor, lang)}
            </li>
          ))}
        </ul>
      </section>
      <Link href="/setup?edit=1&step=envelopes" className={buttonVariants({ variant: 'outline', className: 'self-start px-4' })}>
        {t.reveal.adjust}
      </Link>
    </div>
  );
}

/** How each month that is over went against the envelopes. */
export function RevealView() {
  const { t } = useT();
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const planMonths = useLiveQuery(() => db.planMonths.toArray(), []);

  if (today === null || plan === 'loading' || entries === undefined || planMonths === undefined) return null;
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
  return <Recaps plan={plan} planMonths={planMonths} entries={entries} today={today} />;
}
