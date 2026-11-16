import { PencilIcon } from 'lucide-react';
import { useId } from 'react';
import { LinkButton } from '@/components/link-button';
import { furthestOver, localSuggestions, type Suggestion } from '@/features/swaps/suggest';
import { SwapLine } from '@/features/swaps/swap-line';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';
import { EnvelopeCard } from './envelope-card';
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

  return (
    <EnvelopeCard
      categoryId={row.categoryId}
      name={name}
      percent={percentUsed(row.plannedMinor, row.spentMinor)}
      barLabel={t.home.envelopes.barLabel(name)}
      line={monthLine(row.plannedMinor, row.spentMinor, t, locale)}
    >
      {suggestion !== undefined && <SwapLine suggestion={suggestion} />}
    </EnvelopeCard>
  );
}

/**
 * One row per envelope: what is left of this month's plan, with a bar for how much of it is used. The row furthest over
 * (or closest to it early in the month) gets one sourced swap to try under it; the others don't, so Home stays short.
 * The check-in lists a swap for each.
 */
export function EnvelopeList({ rows, today }: { rows: EnvelopeRow[]; today: IsoDate }) {
  const headingId = useId();
  const { t } = useT();
  if (rows.length === 0) return null;
  const swap = furthestOver(localSuggestions.suggest({ rows, today }), rows);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      {/* Edit plan at the end of the heading's line (13-11-2026), where the envelopes are changed: an outlined button
          with a pencil (16-11-2026: buttons, never text links). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={headingId} className="text-[22px] leading-tight font-extrabold">
          {t.home.envelopes.heading}
        </h2>
        <LinkButton href="/setup?edit=1" icon={PencilIcon}>
          {t.setup.editPlan.link}
        </LinkButton>
      </div>
      <ul aria-labelledby={headingId} className="flex flex-col gap-3">
        {rows.map((row) => (
          <EnvelopeItem
            key={row.categoryId}
            row={row}
            suggestion={swap?.categoryId === row.categoryId ? swap : undefined}
          />
        ))}
      </ul>
    </section>
  );
}
