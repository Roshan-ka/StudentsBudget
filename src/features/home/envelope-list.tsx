import { useId } from 'react';
import { categoryTint, chartColor } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { localSuggestions, type Suggestion } from '@/features/swaps/suggest';
import { SwapLine } from '@/features/swaps/swap-line';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';
import { percentUsed } from './percent-used';

export type EnvelopeRow = {
  categoryId: string;
  /** Planned for this month: the whole monthly amount, in the month of setup too. */
  plannedMinor: Minor;
  spentMinor: Minor;
};

/** "€58 left of €64 this month", or "€42 over the €64 planned this month" once more has gone out than was planned. */
function monthLine(plannedMinor: Minor, spentMinor: Minor, t: Messages, locale: string): string {
  const { text, over } = formatWeekAmount(plannedMinor - spentMinor, locale);
  const planned = formatMoney(plannedMinor, 'EUR', { whole: true, locale });
  return over ? t.home.envelopes.over(text, planned) : t.home.envelopes.left(text, planned);
}

function EnvelopeItem({ row, suggestion }: { row: EnvelopeRow; suggestion: Suggestion | undefined }) {
  const { t, locale } = useT();
  const name = categoryNameIn(t, row.categoryId);
  const line = monthLine(row.plannedMinor, row.spentMinor, t, locale);
  const percent = percentUsed(row.plannedMinor, row.spentMinor);
  const Icon = CATEGORY_ICONS[row.categoryId] ?? OTHER_ICON;

  return (
    // The envelope's own block, tinted with its category's colour (tokens.test.ts holds its text to 4.5:1).
    <li
      className="flex gap-3 rounded-lg border-[1.5px] border-outline p-3.5 shadow-offset"
      style={{ backgroundColor: categoryTint(row.categoryId) }}
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline bg-card/80"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="min-w-0 font-semibold break-words">{name}</p>
        {/* The bar stops at full, so the real numbers are in its value text, and in the line under it. */}
        <div
          role="progressbar"
          // Not the bare name: a hidden home page stays mounted, and the plan wizard's inputs are labelled with it.
          aria-label={t.home.envelopes.barLabel(name)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={line}
          className="h-2.5 overflow-hidden rounded-full bg-track"
        >
          <div
            className="h-full rounded-full motion-safe:animate-bar-fill"
            style={{ width: `${percent}%`, backgroundColor: chartColor(row.categoryId) }}
          />
        </div>
        {/* A screen reader gets these numbers from the bar's value text instead. */}
        <p aria-hidden="true" className="text-sm text-muted-foreground tabular-nums">
          {line}
        </p>
        {suggestion !== undefined && <SwapLine suggestion={suggestion} />}
      </div>
    </li>
  );
}

/**
 * One row per envelope: what is left of this month's plan, with a bar for how much of it is used. A row that runs over,
 * or is close to it early in the month, gets one sourced swap to try under it.
 */
export function EnvelopeList({ rows, today }: { rows: EnvelopeRow[]; today: IsoDate }) {
  const headingId = useId();
  const { t } = useT();
  if (rows.length === 0) return null;
  const suggestions = new Map(localSuggestions.suggest({ rows, today }).map((s) => [s.categoryId, s]));

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-[22px] leading-tight font-extrabold">
        {t.home.envelopes.heading}
      </h2>
      <ul aria-labelledby={headingId} className="flex flex-col gap-3">
        {rows.map((row) => (
          <EnvelopeItem key={row.categoryId} row={row} suggestion={suggestions.get(row.categoryId)} />
        ))}
      </ul>
    </section>
  );
}
