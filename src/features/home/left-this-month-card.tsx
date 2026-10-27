import { useId } from 'react';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

/**
 * The one number the app leads with: what is left to spend this month across the envelopes (the whole monthly
 * amounts minus what was spent), and under it what is safe to spend this week (`weekToSpend`). Overspending is said
 * plainly and in the same colours as the good case.
 */
export function LeftThisMonthCard({ leftMinor, weekMinor }: { leftMinor: Minor; weekMinor: Minor }) {
  const headingId = useId();
  const month = formatWeekAmount(leftMinor);
  const week = formatWeekAmount(weekMinor);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-4">
      <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
        Left to spend this month
      </h2>
      {month.over ? (
        <p className="tabular-nums">
          <span className="text-4xl font-semibold">{month.text}</span>
          <span className="text-xl font-medium"> over this month</span>
        </p>
      ) : (
        <p className="text-4xl font-semibold tabular-nums">{month.text}</p>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        {week.over ? `This week: ${week.text} over` : `This week: ${week.text} safe to spend`}
      </p>
    </section>
  );
}
