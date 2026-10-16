'use client';

import { CITIES } from '@/data/cities';
import type { Plan } from '@/db/types';
import { rangeWarnings } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import {
  FLEXIBLE_CATEGORIES,
  amountOf,
  envelopesFooter,
  previewPlan,
  rangeLine,
  summarizeDraft,
  withAmount,
  type DraftUpdate,
  type SetupDraft,
} from '../draft';
import { AmountField } from './amount-field';
import { RangeSource } from './range-source';

export function EnvelopesStep({
  draft,
  update,
  today,
  existing,
}: {
  draft: SetupDraft;
  update: DraftUpdate;
  today: IsoDate;
  existing?: Plan;
}) {
  const below = new Set(rangeWarnings(previewPlan(draft, today, existing), CITIES.regensburg).map((w) => w.categoryId));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        How much do you want to allow yourself for each a month, in euros? Your plan has to fit within what is
        available.
      </p>
      {FLEXIBLE_CATEGORIES.map((c) => {
        const range = CITIES.regensburg.ranges.find((r) => r.categoryId === c.id);
        return (
          <div key={c.id} className="grid gap-1.5">
            <AmountField
              label={c.name}
              value={amountOf(draft.envelopes, c.id) ?? 0}
              onChange={(minor) => update((d) => ({ ...d, envelopes: withAmount(d.envelopes, c.id, minor ?? 0) }))}
              hint={
                range && (
                  <>
                    <p>{rangeLine('Students here', range)}</p>
                    {below.has(c.id) && <p>Below what students here typically need.</p>}
                  </>
                )
              }
            />
            {range && <RangeSource range={range} />}
          </div>
        );
      })}
      <p aria-live="polite" className="rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
        {envelopesFooter(summarizeDraft(draft, today, existing))}
      </p>
    </div>
  );
}
