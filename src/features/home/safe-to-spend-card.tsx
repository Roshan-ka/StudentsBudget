import { parseISO } from 'date-fns';
import { useId } from 'react';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';

const weekday = new Intl.DateTimeFormat('en-IE', { weekday: 'short' });
const dayOfMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric' });
const monthShort = new Intl.DateTimeFormat('en-IE', { month: 'short' });

/**
 * "Mon 12 – Sun 18 Oct". The week is cut off at the month's edges, so it never spans two months and the
 * month can go last. A one-day week (the 1st falling on a Sunday) reads "Sun 1 Nov".
 */
function weekLabel(start: IsoDate, end: IsoDate): string {
  // `parseISO` reads a date-only string as local midnight, so the day never shifts.
  const first = parseISO(start);
  const last = parseISO(end);
  const lastDay = `${weekday.format(last)} ${dayOfMonth.format(last)}`;
  if (start === end) return `${lastDay} ${monthShort.format(last)}`;
  return `${weekday.format(first)} ${dayOfMonth.format(first)} – ${lastDay} ${monthShort.format(last)}`;
}

/** The one number the app is about: what can still be spent this week, and the week it is for. */
export function SafeToSpendCard({
  totalMinor,
  weekStart,
  weekEnd,
}: {
  totalMinor: Minor;
  weekStart: IsoDate;
  weekEnd: IsoDate;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-4">
      <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
        Safe to spend this week
      </h2>
      {totalMinor < 0 ? (
        // Calm on purpose: the same colours as the good case, just said plainly.
        <p className="tabular-nums">
          <span className="text-4xl font-semibold">{formatMoney(-totalMinor, 'EUR', { whole: true })}</span>
          <span className="text-xl font-medium"> over this week</span>
        </p>
      ) : (
        <p className="text-4xl font-semibold tabular-nums">{formatMoney(totalMinor, 'EUR', { whole: true })}</p>
      )}
      <p className="text-sm text-muted-foreground">{weekLabel(weekStart, weekEnd)}</p>
    </section>
  );
}
