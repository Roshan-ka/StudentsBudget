'use client';

import { parseISO } from 'date-fns';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CITIES } from '@/data/cities';
import { db } from '@/db/db';
import type { Amount, Entry, Plan } from '@/db/types';
import { categoryName } from '@/features/entries/categories';
import { rangeLine } from '@/features/setup/draft';
import { AmountField } from '@/features/setup/steps/amount-field';
import { RangeSource } from '@/features/setup/steps/range-source';
import { monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { suggestBudget, suggestionIsProminent, type Suggestion } from './suggest-budget';

const monthFormatter = new Intl.DateTimeFormat('en-IE', { month: 'long' });

/** "September". */
const monthName = (month: IsoMonth): string => monthFormatter.format(parseISO(`${month}-01`));

const whole = (minor: Minor): string => formatMoney(minor, 'EUR', { whole: true });

const isAmount = (minor: Minor): boolean => Number.isSafeInteger(minor) && minor >= 0;

/** Where a suggested amount comes from, in the words under its field. */
function basisLine(row: Suggestion[number], lastMonth: IsoMonth): string {
  if (row.basis === 'city' && row.range) return rangeLine('Students here', row.range);
  if (row.basis === 'last-month') return `Your spending in ${monthName(lastMonth)}`;
  return 'Nothing to go on yet';
}

/** What is left over, or by how much the amounts pass what is available. Whole euros, never flattering. */
function leftoverLine(availableMinor: Minor, totalMinor: Minor): string {
  const left = availableMinor - totalMinor;
  return left >= 0
    ? `${whole(Math.floor(left / 100) * 100)} left for savings`
    : `${whole(Math.ceil(-left / 100) * 100)} over what is available`;
}

/**
 * A budget to start the month from, with an editable amount for every flexible category. It leads Home in the
 * first week of the month and when the plan is over what is available; otherwise it sits behind a link.
 * "Use this budget" replaces the plan's envelopes and nothing else.
 */
export function SuggestedBudget({ plan, entries, today }: { plan: Plan; entries: Entry[]; today: IsoDate }) {
  const headingId = useId();
  // null follows the date and the plan; a choice made here overrides it.
  const [expanded, setExpanded] = useState<boolean | null>(null);
  // Only the rows the person has typed in; every other row follows the suggestion.
  const [edits, setEdits] = useState<Record<string, Minor>>({});
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'failed' | null>(null);

  const month = monthOf(today);
  const lastMonth = shiftMonth(month, -1);
  const { rows, availableMinor } = suggestBudget(plan, CITIES[plan.cityId], entries, month);
  const amountOf = (row: Suggestion[number]): Minor => edits[row.categoryId] ?? row.amountMinor;
  const shown = expanded ?? suggestionIsProminent(plan, today);

  async function applyBudget() {
    setSaving(true);
    setOutcome(null);
    // Every flexible category, in category order. Only the envelopes: the plan's other fields are not touched.
    const envelopes: Amount[] = rows.map((row) => ({ categoryId: row.categoryId, monthlyMinor: amountOf(row) }));
    try {
      await db.plan.update('current', { envelopes });
      setEdits({});
      setExpanded(false);
      setOutcome('saved');
    } catch (error) {
      console.error('StudentsBudget: could not save the suggested budget', error);
      setOutcome('failed');
    } finally {
      setSaving(false);
    }
  }

  if (!shown) {
    return (
      <div className="flex flex-col items-start">
        {outcome === 'saved' && <p role="status" className="text-sm text-muted-foreground">Envelopes updated.</p>}
        <button
          type="button"
          onClick={() => {
            setOutcome(null);
            setExpanded(true);
          }}
          className="inline-flex min-h-11 cursor-pointer items-center text-sm text-primary underline underline-offset-4"
        >
          See a suggested budget
        </button>
      </div>
    );
  }

  const invalid = Object.values(edits).some((minor) => !isAmount(minor));
  const total = rows.reduce((sum, row) => sum + (isAmount(amountOf(row)) ? amountOf(row) : 0), 0);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border px-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg font-semibold">
          Suggested budget
        </h2>
        <p className="text-sm text-muted-foreground">
          {availableMinor > 0
            ? `${whole(Math.floor(availableMinor / 100) * 100)} a month is available after your fixed costs and set-asides.`
            : 'Nothing is available to budget yet: your income leaves nothing after fixed costs and set-asides. ' +
              'You can change your plan in Settings.'}
        </p>
      </div>

      {rows.map((row) => {
        const value = amountOf(row);
        return (
          <div key={row.categoryId} className="grid gap-1.5">
            <AmountField
              label={`${categoryName(row.categoryId)} per month`}
              value={value}
              onChange={(minor) => setEdits((current) => ({ ...current, [row.categoryId]: minor ?? 0 }))}
              hint={<p>{basisLine(row, lastMonth)}</p>}
            />
            {row.basis === 'city' && row.range && <RangeSource range={row.range} />}
          </div>
        );
      })}

      {availableMinor > 0 && (
        <p aria-live="polite" className="rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
          {leftoverLine(availableMinor, total)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-3">
          <Button type="button" className="h-10 px-4" disabled={saving || invalid} onClick={() => void applyBudget()}>
            Use this budget
          </Button>
          <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setExpanded(false)}>
            Not now
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Using it replaces the amounts in your envelopes.</p>
        {invalid && <p className="text-sm text-muted-foreground">Fix the amounts marked above to use this budget.</p>}
        {outcome === 'failed' && (
          <p role="status" className="text-sm text-muted-foreground">
            That did not save. Try again.
          </p>
        )}
      </div>
    </section>
  );
}
