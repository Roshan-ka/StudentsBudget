import { useId } from 'react';
import { categoryName } from '@/features/entries/categories';
import { formatMoney, type Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

export type EnvelopeRow = {
  categoryId: string;
  /** Planned for this month; in the month of setup only from the setup day on. */
  plannedMinor: Minor;
  spentMinor: Minor;
  /** What is left of the envelope up to the end of this week; negative when it is overspent. */
  safeMinor: Minor;
};

const whole = (minor: Minor) => formatMoney(minor, 'EUR', { whole: true });

/** How full the bar is, 0 to 100. An envelope planned at €0 that has spending reads as full. */
function percentUsed(plannedMinor: Minor, spentMinor: Minor): number {
  if (plannedMinor <= 0) return spentMinor > 0 ? 100 : 0;
  return Math.min(100, Math.round((spentMinor / plannedMinor) * 100));
}

function EnvelopeItem({ row }: { row: EnvelopeRow }) {
  const name = categoryName(row.categoryId);
  const used = `${whole(row.spentMinor)} of ${whole(row.plannedMinor)}`;
  const percent = percentUsed(row.plannedMinor, row.spentMinor);
  const week = formatWeekAmount(row.safeMinor);

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-medium break-words">{name}</p>
        <p className="shrink-0 text-sm tabular-nums">
          {`${week.text} ${week.over ? 'over' : 'left'} this week`}
        </p>
      </div>
      {/* The bar stops at full, so the real numbers are in its value text. */}
      <div
        role="progressbar"
        // Not the bare name: a hidden home page stays mounted, and the plan wizard's inputs are labelled with it.
        aria-label={`${name} this month`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={used}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      {/* A screen reader gets these numbers from the bar's value text instead. */}
      <p aria-hidden="true" className="text-sm text-muted-foreground tabular-nums">
        {used}
      </p>
    </li>
  );
}

/** One row per envelope: what is left this week, and how much of this month's plan is used. */
export function EnvelopeList({ rows }: { rows: EnvelopeRow[] }) {
  const headingId = useId();
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        Envelopes
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-4">
        {rows.map((row) => (
          <EnvelopeItem key={row.categoryId} row={row} />
        ))}
      </ul>
    </section>
  );
}
