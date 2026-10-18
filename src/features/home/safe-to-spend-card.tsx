import { useId } from 'react';
import type { IsoDate } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';
import { weekLabel } from '@/lib/week-label';

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
  const { text, over } = formatWeekAmount(totalMinor);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-4">
      <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
        Safe to spend this week
      </h2>
      {over ? (
        // Calm on purpose: the same colours as the good case, just said plainly.
        <p className="tabular-nums">
          <span className="text-4xl font-semibold">{text}</span>
          <span className="text-xl font-medium"> over this week</span>
        </p>
      ) : (
        <p className="text-4xl font-semibold tabular-nums">{text}</p>
      )}
      <p className="text-sm text-muted-foreground">{weekLabel(weekStart, weekEnd)}</p>
    </section>
  );
}
