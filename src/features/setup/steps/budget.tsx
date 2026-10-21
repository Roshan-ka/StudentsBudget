'use client';

import { SETUP_ENVELOPE_IDS } from '@/data/categories';
import { CITIES } from '@/data/cities';
import { categoryName } from '@/features/entries/categories';
import { startingRows } from '@/features/home/suggest-budget';
import { formatMoney } from '@/lib/money';
import type { DraftUpdate, SetupDraft } from '../draft';
import { AmountField } from './amount-field';
import { RangeSource } from './range-source';

const RANGES = CITIES.regensburg.ranges.filter((r) => SETUP_ENVELOPE_IDS.includes(r.categoryId));

/** What the six envelopes come to when each starts at the middle of its city range, to the nearest €5. */
const TYPICAL = formatMoney(
  startingRows(CITIES.regensburg, new Map(), SETUP_ENVELOPE_IDS).reduce((total, row) => total + row.amountMinor, 0),
  'EUR',
  { whole: true },
);

/** Ranges nobody published say so, as everywhere else. */
const HAS_ESTIMATE = RANGES.some((r) => r.source === 'Estimate');

/** The one optional question that guides the envelope amounts on the next step. */
export function BudgetStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Optional. With an amount, the next step suggests how to split it across your envelopes. Skip it to set each
        envelope yourself.
      </p>
      <div className="grid gap-1.5">
        <AmountField
          label="How much do you want to spend in a month on everyday things, apart from rent and your fixed costs?"
          value={draft.spendingBudgetMinor}
          onChange={(minor) => update((d) => ({ ...d, spendingBudgetMinor: minor ?? 0 }))}
          hint={
            <p>
              Students here typically spend about {TYPICAL} a month on food, eating out, going out, transport,
              shopping and other things.{HAS_ESTIMATE && ' Part of this is an estimate.'}
            </p>
          }
        />
        <details className="text-xs text-muted-foreground">
          {/* The same 44 px tap target as a source line. */}
          <summary className="w-fit cursor-pointer py-3.5">Where this comes from</summary>
          <div className="flex flex-col">
            {RANGES.map((range) => (
              <RangeSource key={range.categoryId} range={range} label={`Source: ${categoryName(range.categoryId)}`} />
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
