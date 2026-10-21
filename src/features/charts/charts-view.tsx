'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import type { Entry, Plan } from '@/db/types';
import { firstOfMonth, monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import {
  defaultOverTimeCategory,
  incomeBySourceOver,
  monthsOf,
  spendingByCategoryOver,
  type Period,
} from './aggregate';
import {
  LINK_CLASS,
  monthAndYear,
  monthDate,
  monthOnly,
  rangeText,
  SegmentedControl,
} from './chart-parts';
import { IncomeSection, OverTimeSection, SavingsSection, SpendingSection } from './sections';

const dayAndMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });

const PERIODS = [
  { value: 1, text: 'This month' },
  { value: 3, text: '3 months' },
  { value: 6, text: '6 months' },
  { value: 12, text: '12 months' },
] as const;

/**
 * "Envelope spending counts from 16 Oct.", if the plan was set up in a month of the period, unless that was on the 1st;
 * null otherwise. The envelopes are planned for the whole month, but spending before the setup day is left out.
 */
function countedFromNote(plan: Plan, months: IsoMonth[]): string | null {
  const { createdOn } = plan;
  if (!months.includes(monthOf(createdOn)) || createdOn === firstOfMonth(monthOf(createdOn))) return null;
  return `Envelope spending counts from ${dayAndMonth.format(parseISO(createdOn))}.`;
}

/** The months of a period in a sentence or a caption: "October 2026", or "August 2026 to October 2026". */
function periodText(months: IsoMonth[]): string {
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined) return '';
  return first === last
    ? monthAndYear.format(monthDate(last))
    : `${monthAndYear.format(monthDate(first))} to ${monthAndYear.format(monthDate(last))}`;
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
  const [first] = months;
  return (
    <div role="group" aria-label="Month" className="flex items-center justify-between gap-2">
      <Button variant="ghost" className="h-10 px-3" onClick={() => onChange(shiftMonth(month, -1))}>
        <span aria-hidden="true">‹</span> Previous
      </Button>
      <div aria-live="polite" className="text-center">
        <p className="font-medium">{monthAndYear.format(monthDate(month))}</p>
        {months.length > 1 && first !== undefined && (
          <p className="text-xs text-muted-foreground">{rangeText(first, month)}</p>
        )}
      </div>
      <Button variant="ghost" className="h-10 px-3" onClick={() => onChange(shiftMonth(month, 1))}>
        Next <span aria-hidden="true">›</span>
      </Button>
    </div>
  );
}

function Charts({ plan, entries, today }: { plan: Plan; entries: Entry[]; today: IsoDate }) {
  // Null follows the clock to the current month; Previous and Next pin the month that was picked.
  const [pickedMonth, setPickedMonth] = useState<IsoMonth | null>(null);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [months, setMonths] = useState<Period['months']>(1);

  const endMonth = pickedMonth ?? monthOf(today);
  const period: Period = { endMonth, months };
  const inPeriod = monthsOf(period);
  const text = periodText(inPeriod);
  // The words for "nothing yet": "in October" for one month of this year, "in these 3 months" for more.
  const monthIn =
    months > 1
      ? `these ${months} months`
      : endMonth.slice(0, 4) === today.slice(0, 4)
        ? monthOnly.format(monthDate(endMonth))
        : text;
  const logged = entries.some((entry) => entry.type !== 'transfer' && inPeriod.includes(monthOf(entry.date)));

  const spending = spendingByCategoryOver(entries, plan, period);
  const income = incomeBySourceOver(entries, period);
  // One month is a single column over time, so on "This month" the two over-time charts look back 6 months to it.
  const lookBack = months === 1;
  const overTime: Period = lookBack ? { endMonth, months: 6 } : period;
  const overTimeText = lookBack ? periodText(monthsOf(overTime)) : text;
  const overTimeSubtitle = lookBack ? 'Last 6 months' : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <MonthSwitcher month={endMonth} months={inPeriod} onChange={setPickedMonth} />
        <SegmentedControl label="Period" options={PERIODS} value={months} onChange={setMonths} />
      </div>
      {!logged ? (
        <p className="text-muted-foreground">{`Nothing logged in ${monthIn} yet.`}</p>
      ) : (
        <>
          <SpendingSection
            spending={spending}
            period={period}
            periodText={text}
            note={countedFromNote(plan, inPeriod)}
            noneText={`No spending logged in ${monthIn} yet.`}
          />
          <IncomeSection
            income={income}
            period={period}
            periodText={text}
            noneText={`No income logged in ${monthIn} yet.`}
          />
          <SavingsSection entries={entries} period={overTime} periodText={overTimeText} subtitle={overTimeSubtitle} />
          <OverTimeSection
            categoryId={pickedCategory ?? defaultOverTimeCategory(spending)}
            onCategoryChange={setPickedCategory}
            entries={entries}
            period={overTime}
            periodText={overTimeText}
            subtitle={overTimeSubtitle}
          />
        </>
      )}
    </div>
  );
}

/**
 * Where the money went over one period (this month, or the last 3, 6 or 12): spending by category against the plan,
 * income by source, what was saved each month, and one category month by month. On "This month" the last two look
 * back 6 months, since one month is a single column, and say "Last 6 months". Each chart has its own style
 * (donut, bars or table; columns, line or table). Every slice, bar and column opens the entries behind it. It reads
 * the whole database and updates by itself when an entry is saved.
 */
export function ChartsView() {
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  if (today === null || plan === 'loading' || entries === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        Set up your plan to see where the money goes.{' '}
        <Link href="/setup" className={LINK_CLASS}>
          Start setup
        </Link>
      </p>
    );
  }
  return <Charts plan={plan} entries={entries} today={today} />;
}
