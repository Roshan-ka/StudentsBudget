import { useId } from 'react';
import { categoryName } from '@/features/entries/categories';
import { localSuggestions, type Suggestion } from '@/features/swaps/suggest';
import { SwapLine } from '@/features/swaps/swap-line';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

export type EnvelopeRow = {
  categoryId: string;
  /** Planned for this month; in the month of setup only from the setup day on. */
  plannedMinor: Minor;
  spentMinor: Minor;
};

/** How full the bar is, 0 to 100. An envelope planned at €0 that has spending reads as full. */
function percentUsed(plannedMinor: Minor, spentMinor: Minor): number {
  if (plannedMinor <= 0) return spentMinor > 0 ? 100 : 0;
  return Math.min(100, Math.round((spentMinor / plannedMinor) * 100));
}

/** "€58 left of €64 this month", or "€42 over the €64 planned this month" once more has gone out than was planned. */
function monthLine(plannedMinor: Minor, spentMinor: Minor): string {
  const { text, over } = formatWeekAmount(plannedMinor - spentMinor);
  const planned = formatMoney(plannedMinor, 'EUR', { whole: true });
  return over ? `${text} over the ${planned} planned this month` : `${text} left of ${planned} this month`;
}

function EnvelopeItem({ row, suggestion }: { row: EnvelopeRow; suggestion: Suggestion | undefined }) {
  const name = categoryName(row.categoryId);
  const line = monthLine(row.plannedMinor, row.spentMinor);
  const percent = percentUsed(row.plannedMinor, row.spentMinor);

  return (
    <li className="flex flex-col gap-1.5">
      <p className="min-w-0 font-medium break-words">{name}</p>
      {/* The bar stops at full, so the real numbers are in its value text. */}
      <div
        role="progressbar"
        // Not the bare name: a hidden home page stays mounted, and the plan wizard's inputs are labelled with it.
        aria-label={`${name} this month`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={line}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      {/* A screen reader gets these numbers from the bar's value text instead. */}
      <p aria-hidden="true" className="text-sm text-muted-foreground tabular-nums">
        {line}
      </p>
      {suggestion !== undefined && <SwapLine suggestion={suggestion} />}
    </li>
  );
}

/**
 * One row per envelope: what is left of this month's plan, with a bar for how much of it is used. A row that runs over,
 * or is close to it early in the month, gets one sourced swap to try under it.
 */
export function EnvelopeList({ rows, today }: { rows: EnvelopeRow[]; today: IsoDate }) {
  const headingId = useId();
  if (rows.length === 0) return null;
  const suggestions = new Map(localSuggestions.suggest({ rows, today }).map((s) => [s.categoryId, s]));

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        Envelopes
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-4">
        {rows.map((row) => (
          <EnvelopeItem key={row.categoryId} row={row} suggestion={suggestions.get(row.categoryId)} />
        ))}
      </ul>
    </section>
  );
}
