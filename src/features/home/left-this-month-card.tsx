import { useId } from 'react';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import type { Minor } from '@/lib/money';
import { cn } from '@/lib/utils';
import { formatWeekAmount } from '@/lib/week-amount';
import { percentUsed } from './percent-used';

/** The ring's radius and its circumference, in the 108-unit box it is drawn in. */
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How much of the month's plan has been spent, as a ring beside the number (redesign, chunk 4): it fills as the
 * envelope bars do, and is full, in the same colours, once the plan is spent. Decoration only: the number says it.
 */
function MonthRing({ percent }: { percent: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 108 108" className="size-[94px] shrink-0">
      <circle cx="54" cy="54" r={RADIUS} fill="none" stroke="var(--track)" strokeWidth="13" />
      {percent > 0 && (
        <circle
          cx="54"
          cy="54"
          r={RADIUS}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${(CIRCUMFERENCE * percent) / 100} ${CIRCUMFERENCE}`}
          transform="rotate(-90 54 54)"
        />
      )}
    </svg>
  );
}

/**
 * The one number the app leads with: what is left to spend this month across the envelopes (the whole monthly
 * amounts minus what was spent), and under it what is safe to spend this week (`weekToSpend`). Overspending is said
 * plainly and in the same colours as the good case.
 */
export function LeftThisMonthCard({
  leftMinor,
  weekMinor,
  plannedMinor,
  spentMinor,
}: {
  leftMinor: Minor;
  weekMinor: Minor;
  /** The month's plan across the envelopes, and what has been spent of it: the ring. */
  plannedMinor: Minor;
  spentMinor: Minor;
}) {
  const headingId = useId();
  const { t, locale } = useT();
  const text = t.home.leftThisMonth;
  const month = formatWeekAmount(leftMinor, locale);
  const week = formatWeekAmount(weekMinor, locale);
  const amount = <span className="font-heading text-5xl leading-none font-extrabold tracking-tight">{month.text}</span>;

  return (
    <section aria-labelledby={headingId} className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
      <h2 id={headingId} className="font-sans text-sm font-semibold tracking-normal">
        {text.heading}
      </h2>
      <div className="flex items-center gap-4">
        <MonthRing percent={percentUsed(plannedMinor, spentMinor)} />
        {/* One line of text, however it wraps, so "€12 over this month" reads as one. The amount sits where the
            language puts it. */}
        <p className="min-w-0 tabular-nums break-words">
          {month.over ? (
            <>
              {text.overThisMonth.before && <span className="text-xl font-semibold">{text.overThisMonth.before}</span>}
              {amount}
              <span className="text-xl font-semibold">{text.overThisMonth.after}</span>
            </>
          ) : (
            amount
          )}
        </p>
      </div>
      <p className="w-fit rounded-full bg-foreground/10 px-3 py-1 text-[13px] font-semibold tabular-nums">
        {week.over ? text.weekOver(week.text) : text.weekSafe(week.text)}
      </p>
    </section>
  );
}
