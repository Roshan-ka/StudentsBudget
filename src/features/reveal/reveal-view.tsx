'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarRangeIcon, ClipboardListIcon, PencilIcon } from 'lucide-react';
import { useId } from 'react';
import { LinkButton } from '@/components/link-button';
import { cardVariants } from '@/components/ui/card';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { EmptyCard, RowCardLink, RowTile, tintCardClass } from '@/features/home/row-card';
import { db } from '@/db/db';
import type { Entry, Plan, PlanMonth } from '@/db/types';
import { categoryNameIn } from '@/i18n/category-name';
import { dateFormat } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { planForMonth } from '@/lib/plan-history';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { formatWeekAmount } from '@/lib/week-amount';
import { completedMonths, monthRecap, type RecapRow } from './reveal';
import { recapMonthLabel, recapResult } from './reveal-text';

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
    // Green, a category's tint for its colour (13-11-2026).
    <RowCardLink href="/reveal" icon={CalendarRangeIcon} tint={categoryTint('eating-out')}>
      <span className="font-semibold">{t.reveal.link(monthName(latest, locale))}</span>
    </RowCardLink>
  );
}

const sum = (values: Minor[]): Minor => values.reduce((total, value) => total + value, 0);

/**
 * One envelope of a finished month, in Home's envelope look (`EnvelopeCard`) without its bar: its category's tint, the
 * icon on a white tile, the name and "€290 of €310". Over its plan it reads "€72 of €60", in the same colours.
 */
function RecapEnvelope({ row }: { row: RecapRow }) {
  const { t, locale } = useT();
  const Icon = CATEGORY_ICONS[row.categoryId] ?? OTHER_ICON;
  const spent = formatWeekAmount(row.spentMinor, locale).text;
  const planned = formatWeekAmount(row.plannedMinor, locale).text;

  return (
    <li
      className={tintCardClass('min-h-14 flex-row items-center')}
      style={{ backgroundColor: categoryTint(row.categoryId) }}
    >
      <RowTile icon={Icon} tint="var(--card)" />
      <p className="min-w-0 flex-1 font-semibold break-words">{categoryNameIn(t, row.categoryId)}</p>
      <p className="shrink-0 text-sm text-muted-foreground tabular-nums">{t.charts.ofPlanned(spent, planned)}</p>
    </li>
  );
}

/**
 * One month that is over (Roshan's Group 3 mockups, 16-11-2026): the accent card with the month, how it went as the big
 * line ("€38 left over → savings", "€12 over plan") and "€462 spent of €500", then a card per envelope.
 */
function MonthRecap({ month, plan, entries }: { month: IsoMonth; plan: Plan; entries: Entry[] }) {
  const headingId = useId();
  const { t, lang, locale } = useT();
  const { rows, leftoverMinor } = monthRecap(plan, entries, month);
  const spent = formatWeekAmount(sum(rows.map((row) => row.spentMinor)), locale).text;
  const planned = formatWeekAmount(sum(rows.map((row) => row.plannedMinor)), locale).text;
  // Envelopes planned at €0 and never used would only add empty rows, as on Home.
  const shown = rows.filter((row) => row.plannedMinor > 0 || row.spentMinor > 0);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className={cn(cardVariants({ variant: 'accent' }), 'gap-1')}>
        <h3 id={headingId} className="font-sans text-sm font-semibold tracking-normal">
          {recapMonthLabel(month, lang)}
        </h3>
        <p className="font-heading text-[28px] leading-tight font-extrabold tracking-tight break-words tabular-nums">
          {recapResult(leftoverMinor, lang)}
        </p>
        <p className="text-sm tabular-nums">{t.reveal.spentOf(spent, planned)}</p>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-3">
          {shown.map((row) => (
            <RecapEnvelope key={row.categoryId} row={row} />
          ))}
        </ul>
      )}
    </section>
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
  const { t, locale } = useT();
  const months = completedMonths(plan.createdOn, today);
  if (months.length === 0) {
    return (
      <EmptyCard icon={CalendarRangeIcon} title={t.reveal.notYetTitle}>
        {t.reveal.notYet(monthName(monthOf(plan.createdOn), locale))}
      </EmptyCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t.reveal.intro}</p>
      {months.map((month) => (
        // Each month against the plan it had (plan history).
        <MonthRecap key={month} month={month} plan={planForMonth(plan, planMonths, month, today)} entries={entries} />
      ))}
      <LinkButton href="/setup?edit=1&step=envelopes" icon={PencilIcon}>
        {t.setup.editPlan.link}
      </LinkButton>
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
      <EmptyCard
        icon={CalendarRangeIcon}
        title={t.common.noPlanYet}
        action={
          <LinkButton href="/setup" icon={ClipboardListIcon}>
            {t.common.toSetup}
          </LinkButton>
        }
      >
        {t.reveal.noPlan}
      </EmptyCard>
    );
  }
  return <Recaps plan={plan} planMonths={planMonths} entries={entries} today={today} />;
}
