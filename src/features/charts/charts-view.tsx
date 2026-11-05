'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useState } from 'react';
import { useChoicePref } from '@/lib/phone-pref';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import type { Entry, Plan } from '@/db/types';
import { dateFormat } from '@/i18n/format';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { firstOfMonth, monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import {
  defaultOverTimeCategory,
  hasEntriesIn,
  incomeBySourceOver,
  monthsOf,
  spendingByCategoryOver,
  type Period,
} from './aggregate';
import { LINK_CLASS, monthAndYear, monthOnly, rangeText, SegmentedControl } from './chart-parts';
import { IncomeSection, OverTimeSection, SavingsSection, SpendingSection } from './sections';

const PERIODS = [1, 3, 6, 12] as const;
/** The periods as the phone stores them. */
const PERIOD_KEYS = ['1', '3', '6', '12'] as const;

/**
 * "Envelope spending counts from 16 Oct, the day you set up.", if the plan was set up in a month of the period,
 * unless that was on the 1st; null otherwise. The envelopes are planned for the whole month, but spending before the
 * setup day is left out.
 */
function countedFromNote(plan: Plan, months: IsoMonth[], t: Messages, locale: string): string | null {
  const { createdOn } = plan;
  if (!months.includes(monthOf(createdOn)) || createdOn === firstOfMonth(monthOf(createdOn))) return null;
  return t.charts.countedFrom(dateFormat(locale, { day: 'numeric', month: 'short' }).format(parseISO(createdOn)));
}

/** The months of a period in a sentence or a caption: "October 2026", or "August 2026 to October 2026". */
function periodText(months: IsoMonth[], t: Messages, locale: string): string {
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined) return '';
  return first === last
    ? monthAndYear(last, locale)
    : t.charts.periodRange(monthAndYear(first, locale), monthAndYear(last, locale));
}

/** The month the period ends on, with Previous and Next to move it, and for a longer period the months it covers. */
function MonthSwitcher({
  month,
  months,
  onChange,
}: {
  month: IsoMonth;
  months: IsoMonth[];
  onChange: (month: IsoMonth) => void;
}) {
  const { t, locale } = useT();
  const [first] = months;
  return (
    // One row where it fits (a container of 20 rem); with large text the month goes on its own line above the buttons.
    <div
      role="group"
      aria-label={t.charts.monthLabel}
      className="@container flex flex-wrap items-center justify-between gap-2"
    >
      <Button variant="ghost" className="min-w-0 shrink px-3" onClick={() => onChange(shiftMonth(month, -1))}>
        <span aria-hidden="true">‹</span> {t.charts.previous}
      </Button>
      <div aria-live="polite" className="order-first w-full min-w-0 text-center @xs:order-none @xs:w-auto">
        <p className="font-medium">{monthAndYear(month, locale)}</p>
        {months.length > 1 && first !== undefined && (
          <p className="text-xs text-muted-foreground">{rangeText(first, month, locale)}</p>
        )}
      </div>
      <Button variant="ghost" className="min-w-0 shrink px-3" onClick={() => onChange(shiftMonth(month, 1))}>
        {t.charts.next} <span aria-hidden="true">›</span>
      </Button>
    </div>
  );
}

function Charts({ plan, entries, today }: { plan: Plan; entries: Entry[]; today: IsoDate }) {
  const { t, locale } = useT();
  // Null follows the clock to the current month; Previous and Next pin the month that was picked.
  const [pickedMonth, setPickedMonth] = useState<IsoMonth | null>(null);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  // Remembered on this phone (pain points, chunk 8), like each chart's style.
  const [storedMonths, setStoredMonths] = useChoicePref('studentsbudget-charts-period', PERIOD_KEYS, '1');
  const months = Number(storedMonths) as Period['months'];
  const setMonths = (value: Period['months']) => setStoredMonths(`${value}` as (typeof PERIOD_KEYS)[number]);

  const endMonth = pickedMonth ?? monthOf(today);
  const period: Period = { endMonth, months };
  const inPeriod = monthsOf(period);
  const text = periodText(inPeriod, t, locale);
  // The words for "nothing yet": "in October" for one month of this year, "in these 3 months" for more.
  const monthIn =
    months > 1
      ? t.charts.theseMonths(months)
      : endMonth.slice(0, 4) === today.slice(0, 4)
        ? monthOnly(endMonth, locale)
        : text;
  const logged = hasEntriesIn(entries, inPeriod);

  const spending = spendingByCategoryOver(entries, plan, period);
  const income = incomeBySourceOver(entries, period);
  // One month is a single column over time, so on "This month" the two over-time charts look back 6 months to it.
  const lookBack = months === 1;
  const overTime: Period = lookBack ? { endMonth, months: 6 } : period;
  const overTimeText = lookBack ? periodText(monthsOf(overTime), t, locale) : text;
  const overTimeSubtitle = lookBack ? t.charts.lastSixMonths : null;
  const overTimeSpending = lookBack ? spendingByCategoryOver(entries, plan, overTime) : spending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <MonthSwitcher month={endMonth} months={inPeriod} onChange={setPickedMonth} />
        <SegmentedControl
          label={t.charts.periodLabel}
          options={PERIODS.map((value) => ({ value, text: t.charts.period(value) }))}
          value={months}
          onChange={setMonths}
        />
      </div>
      {/* Every chart shows, at €0 where nothing was logged (pain points, chunk 5); this line says why. */}
      {!logged && <p className="text-muted-foreground">{t.charts.nothing(monthIn)}</p>}
      <SpendingSection
        spending={spending}
        period={period}
        periodText={text}
        note={countedFromNote(plan, inPeriod, t, locale)}
        noneText={t.charts.noSpending(monthIn)}
      />
      <IncomeSection income={income} period={period} periodText={text} noneText={t.charts.noIncome(monthIn)} />
      <SavingsSection entries={entries} period={overTime} periodText={overTimeText} subtitle={overTimeSubtitle} />
      <OverTimeSection
        categoryId={pickedCategory ?? defaultOverTimeCategory(spending, overTimeSpending)}
        onCategoryChange={setPickedCategory}
        entries={entries}
        period={overTime}
        periodText={overTimeText}
        subtitle={overTimeSubtitle}
      />
    </div>
  );
}

/**
 * Where the money went over one period (this month, or the last 3, 6 or 12): spending by category against the plan,
 * income by source, what was saved each month, and one category month by month. On "This month" the last two look
 * back 6 months, since one month is a single column, and say "Last 6 months". A period with nothing logged in it
 * still shows every chart, at €0 (the envelopes as planned, nothing spent), under a line that says so. Each chart has its own style
 * (donut, bars or table; columns, line or table). Every slice, bar and column opens the entries behind it. It reads
 * the whole database and updates by itself when an entry is saved.
 */
export function ChartsView() {
  const { t } = useT();
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  if (today === null || plan === 'loading' || entries === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        {t.charts.noPlan}{' '}
        <Link href="/setup" className={LINK_CLASS}>
          {t.charts.startSetup}
        </Link>
      </p>
    );
  }
  return <Charts plan={plan} entries={entries} today={today} />;
}
