'use client';

import { Button } from '@/components/ui/button';
import { SETUP_ENVELOPE_IDS } from '@/data/categories';
import { CITIES } from '@/data/cities';
import type { Plan } from '@/db/types';
import { fitTo, startingRows } from '@/features/home/suggest-budget';
import { rangeWarnings } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import {
  FLEXIBLE_CATEGORIES,
  amountOf,
  askedCategories,
  budgetLine,
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

const whole = (minor: Minor): string => formatMoney(minor, 'EUR', { whole: true });

export function EnvelopesStep({
  draft,
  update,
  today,
  existing,
  edit,
}: {
  draft: SetupDraft;
  update: DraftUpdate;
  today: IsoDate;
  existing?: Plan;
  /** Edit mode asks every envelope and keeps the income-based line; a new setup asks the basic ones, with none. */
  edit: boolean;
}) {
  const city = CITIES.regensburg;
  const preview = previewPlan(draft, today, existing);
  const below = new Set(rangeWarnings(preview, city).map((w) => w.categoryId));
  const asked = askedCategories(FLEXIBLE_CATEGORIES, SETUP_ENVELOPE_IDS, edit, draft.envelopes);

  // The suggestion needs a budget; one that comes to €0 everywhere (a budget of a euro or two) has nothing to offer.
  const budget = draft.spendingBudgetMinor > 0 ? draft.spendingBudgetMinor : 0;
  const rows = budget > 0 ? fitTo(startingRows(city, new Map(), SETUP_ENVELOPE_IDS), budget) : [];
  const suggested = new Map(rows.map((row) => [row.categoryId, row.amountMinor]));
  const hasSuggestion = rows.some((row) => row.amountMinor > 0);
  const plannedMinor = preview.envelopes.reduce((total, a) => total + a.monthlyMinor, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        How much do you want to allow yourself for each a month, in euros? You can change these any time.
      </p>
      {hasSuggestion && (
        <Button
          type="button"
          variant="outline"
          className="h-10 self-start px-4"
          onClick={() =>
            update((d) => ({
              ...d,
              envelopes: rows.reduce((list, row) => withAmount(list, row.categoryId, row.amountMinor), d.envelopes),
            }))
          }
        >
          Use this split
        </Button>
      )}
      {asked.map((c) => {
        const range = city.ranges.find((r) => r.categoryId === c.id);
        const suggestion = hasSuggestion ? suggested.get(c.id) : undefined;
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
                    {suggestion !== undefined && <p>Suggested: about {whole(suggestion)}</p>}
                    {below.has(c.id) && <p>Below what students here typically need.</p>}
                  </>
                )
              }
            />
            {range && <RangeSource range={range} />}
          </div>
        );
      })}
      {budget > 0 && (
        <p aria-live="polite" className="rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
          {budgetLine(plannedMinor, budget)}
        </p>
      )}
      {edit && (
        <p aria-live="polite" className="rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
          {envelopesFooter(summarizeDraft(draft, today, existing))}
        </p>
      )}
    </div>
  );
}
