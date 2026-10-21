'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { SETUP_ENVELOPE_IDS } from '@/data/categories';
import { CITIES } from '@/data/cities';
import type { Plan } from '@/db/types';
import { categoryName } from '@/features/entries/categories';
import { liveSuggestions } from '@/features/home/suggest-budget';
import { rangeWarnings } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, formatRange, type Minor } from '@/lib/money';
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

const RANGES = CITIES.regensburg.ranges.filter((r) => SETUP_ENVELOPE_IDS.includes(r.categoryId));
const names = new Intl.ListFormat('en-IE', { style: 'long', type: 'conjunction' });

/** Where the six envelopes typically add up to, bottom to top: the sums of their city ranges. */
const TYPICAL = formatRange(
  RANGES.reduce((total, r) => total + r.minMinor, 0),
  RANGES.reduce((total, r) => total + r.maxMinor, 0),
);

/** Ranges nobody published say so, as everywhere else: "Eating out, going out and transport are estimates." */
function estimateSentence(): string {
  const estimates = RANGES.filter((r) => r.source === 'Estimate').map((r) => categoryName(r.categoryId).toLowerCase());
  if (estimates.length === 0) return '';
  const list = names.format(estimates);
  return ` ${list.charAt(0).toUpperCase()}${list.slice(1)} ${estimates.length === 1 ? 'is an estimate' : 'are estimates'}.`;
}

const BUDGET_HINT = `Students here typically spend about ${TYPICAL} a month on these.${estimateSentence()}`;

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
  const noteId = useId();
  const city = CITIES.regensburg;
  const preview = previewPlan(draft, today, existing);
  const below = new Set(rangeWarnings(preview, city).map((w) => w.categoryId));
  const asked = askedCategories(FLEXIBLE_CATEGORIES, SETUP_ENVELOPE_IDS, edit, draft.envelopes);

  // With a budget, every envelope is suggested what is left of it after the others that are set; typing into one
  // moves the suggestions of the rest. A budget that comes to €0 everywhere (a euro or two) suggests €0.
  const budget = draft.spendingBudgetMinor > 0 ? draft.spendingBudgetMinor : 0;
  const suggested = liveSuggestions(preview.envelopes, SETUP_ENVELOPE_IDS, budget, city);
  // The button fills the envelopes that are not set, and only where it has something to put in.
  const fillable = SETUP_ENVELOPE_IDS.filter(
    (id) => (amountOf(preview.envelopes, id) ?? 0) <= 0 && (suggested.get(id) ?? 0) > 0,
  );
  const plannedMinor = preview.envelopes.reduce((total, a) => total + a.monthlyMinor, 0);
  const line = budgetLine(plannedMinor, budget);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">Optional. The envelopes below are suggested from it.</p>
      <div className="grid gap-1.5">
        <AmountField
          label="How much do you want to spend in a month on everyday things, apart from rent and your fixed costs?"
          value={draft.spendingBudgetMinor}
          onChange={(minor) => update((d) => ({ ...d, spendingBudgetMinor: minor ?? 0 }))}
          hint={<p>{BUDGET_HINT}</p>}
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
      <p className="text-muted-foreground">
        {edit
          ? 'How much do you want to allow yourself for each of these a month, in euros? You can change these any time.'
          : 'How much do you want to allow yourself for each of these a month, in euros? You can change them, and add envelopes like study materials or travel, under Edit plan in Settings.'}
      </p>
      {fillable.length > 0 && (
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4"
            aria-describedby={noteId}
            onClick={() =>
              update((d) => ({
                ...d,
                envelopes: fillable.reduce((list, id) => withAmount(list, id, suggested.get(id) ?? 0), d.envelopes),
              }))
            }
          >
            Use the suggested amounts
          </Button>
          <p id={noteId} className="text-sm text-muted-foreground">
            It fills only the envelopes you haven&apos;t set.
          </p>
        </div>
      )}
      {asked.map((c) => {
        const range = city.ranges.find((r) => r.categoryId === c.id);
        const suggestion = suggested.get(c.id);
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
                    {suggestion !== undefined && <p>{`Suggested: ${whole(suggestion)}`}</p>}
                    {below.has(c.id) && <p>Below what students here typically need.</p>}
                  </>
                )
              }
            />
            {range && <RangeSource range={range} />}
          </div>
        );
      })}
      {(line !== null || edit) && (
        <div
          aria-live="polite"
          className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums"
        >
          {line !== null && <p>{line}</p>}
          {edit && (
            <p className="font-normal text-muted-foreground">
              {envelopesFooter(summarizeDraft(draft, today, existing))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
