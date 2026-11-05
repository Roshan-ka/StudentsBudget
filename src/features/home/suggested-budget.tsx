'use client';

import { parseISO } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { CITIES } from '@/data/cities';
import { db } from '@/db/db';
import type { Amount, Entry, Plan } from '@/db/types';
import { budgetLine, rangeLine } from '@/features/setup/draft';
import { AmountField } from '@/features/setup/steps/amount-field';
import { RangeSource } from '@/features/setup/steps/range-source';
import { categoryNameIn } from '@/i18n/category-name';
import { rangeIn } from '@/i18n/city';
import { dateFormat } from '@/i18n/format';
import { LANGUAGES, type Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { cn } from '@/lib/utils';
import { suggestBudget, type Suggestion } from './suggest-budget';
import { focusOnMount, useFocusAfter } from '@/lib/focus';

/** "September". */
const monthName = (month: IsoMonth, locale: string): string =>
  dateFormat(locale, { month: 'long' }).format(parseISO(`${month}-01`));

const whole = (minor: Minor, locale: string): string => formatMoney(minor, 'EUR', { whole: true, locale });

const isAmount = (minor: Minor): boolean => Number.isSafeInteger(minor) && minor >= 0;

/** Where a suggested amount comes from, in the words under its field. */
function basisLine(row: Suggestion[number], lastMonth: IsoMonth, t: Messages, lang: Language): string {
  const text = t.home.suggestedBudget;
  const locale = LANGUAGES[lang].locale;
  if (row.basis === 'city' && row.range) return rangeLine(text.studentsHere, row.range, lang);
  if (row.basis === 'last-month') return text.lastMonth(monthName(lastMonth, locale));
  return text.nothingToGoOn;
}

/** Whole euros, rounded down: an amount to spend never reads as more than it is. */
const wholeDown = (minor: Minor, locale: string): string => whole(Math.floor(minor / 100) * 100, locale);

/**
 * What is available, and with an everyday budget (`budgetMinor` above €0) which of the two the amounts keep to: the
 * budget, or what is available when that is less. Compared in the whole euros shown, so the line never reads
 * "€600 is less than your budget of €600".
 */
function availableLine(availableMinor: Minor, budgetMinor: Minor, t: Messages, lang: Language): string {
  const text = t.home.suggestedBudget;
  const locale = LANGUAGES[lang].locale;
  if (availableMinor <= 0) return text.nothingAvailable;
  const available = wholeDown(availableMinor, locale);
  if (!(budgetMinor > 0)) return text.available(available);
  const budget = wholeDown(budgetMinor, locale);
  if (Math.floor(budgetMinor / 100) <= Math.floor(availableMinor / 100)) {
    return text.availableWithinBudget(available, budget);
  }
  return text.availableBelowBudget(available, budget);
}

/**
 * What is left over, or by how much the amounts pass what is available, after setup's "€600 of your €600 budget"
 * when there is an everyday budget. Whole euros, never flattering.
 */
function leftoverLine(
  availableMinor: Minor,
  totalMinor: Minor,
  budgetMinor: Minor,
  t: Messages,
  lang: Language,
): string {
  const text = t.home.suggestedBudget;
  const locale = LANGUAGES[lang].locale;
  const left = availableMinor - totalMinor;
  const savings =
    left >= 0
      ? text.leftForSavings(wholeDown(left, locale))
      : text.overAvailable(whole(Math.ceil(-left / 100) * 100, locale));
  const budget = budgetLine(totalMinor, budgetMinor, lang);
  return budget ? `${budget} · ${savings}` : savings;
}

/**
 * A budget to start the month from, with an editable amount for every flexible category, split across what is
 * available or the everyday budget when that is less (`suggestBudget`). It leads Home in the first week of the month
 * and when the plan is over what is available; otherwise it sits behind a link. "Use this budget" replaces the
 * plan's envelopes and nothing else.
 */
export function SuggestedBudget({ plan, entries, today }: { plan: Plan; entries: Entry[]; today: IsoDate }) {
  const headingId = useId();
  const { t, lang } = useT();
  const text = t.home.suggestedBudget;
  // Behind its link until tapped, on every day of the month (Roshan, 05-11-2026): it never opens by itself.
  const [shown, setShown] = useState(false);
  // It opens on its heading; Not now and Use give the focus back to the link that opened it.
  const focus = useFocusAfter();
  // Rows the suggestion puts at €0 wait behind More categories while another row has an amount.
  const [showZero, setShowZero] = useState(false);
  // Only the rows the person has typed in; every other row follows the suggestion.
  const [edits, setEdits] = useState<Record<string, Minor>>({});
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'failed' | null>(null);

  const month = monthOf(today);
  const lastMonth = shiftMonth(month, -1);
  const { rows, availableMinor } = suggestBudget(plan, CITIES[plan.cityId], entries, month);
  const budgetMinor = plan.spendingBudgetMinor ?? 0;
  const amountOf = (row: Suggestion[number]): Minor => edits[row.categoryId] ?? row.amountMinor;

  async function applyBudget() {
    // Every flexible category, in category order. Only the envelopes: the plan's other fields are not touched.
    const envelopes: Amount[] = rows.map((row) => ({ categoryId: row.categoryId, monthlyMinor: amountOf(row) }));
    // The button is disabled for this too; a budget of €0 everywhere would empty every envelope.
    if (envelopes.every((envelope) => envelope.monthlyMinor === 0)) return;
    setSaving(true);
    setOutcome(null);
    try {
      await db.plan.update('current', { envelopes });
      setEdits({});
      focus.mark('show');
      setShown(false);
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
        {outcome === 'saved' && (
          <p role="status" className="text-sm text-muted-foreground">
            {text.updated}
          </p>
        )}
        <button
          ref={focus.refFor('show')}
          type="button"
          onClick={() => {
            setOutcome(null);
            setShown(true);
          }}
          className="inline-flex min-h-11 cursor-pointer items-center text-sm text-primary underline underline-offset-4"
        >
          {text.show}
        </button>
      </div>
    );
  }

  const invalid = Object.values(edits).some((minor) => !isAmount(minor));
  const total = rows.reduce((sum, row) => sum + (isAmount(amountOf(row)) ? amountOf(row) : 0), 0);
  // A row typed into stays out, whatever its amount; with every row at €0 there is nothing to fold.
  const folds = (row: Suggestion[number]) => row.amountMinor === 0 && !(row.categoryId in edits);
  const folding = rows.some((row) => !folds(row)) && rows.some(folds);
  const listed = folding && !showZero ? rows.filter((row) => !folds(row)) : rows;

  return (
    <section aria-labelledby={headingId} className={cn(cardVariants(), 'gap-4')}>
      <div className="flex flex-col gap-1">
        <h2 ref={focusOnMount} id={headingId} tabIndex={-1} className="text-[22px] leading-tight font-extrabold outline-none">
          {text.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{availableLine(availableMinor, budgetMinor, t, lang)}</p>
      </div>

      {listed.map((row) => {
        const value = amountOf(row);
        return (
          <div key={row.categoryId} className="grid gap-1.5">
            <AmountField
              label={text.perMonth(categoryNameIn(t, row.categoryId))}
              value={value}
              onChange={(minor) => setEdits((current) => ({ ...current, [row.categoryId]: minor ?? 0 }))}
              hint={<p>{basisLine(row, lastMonth, t, lang)}</p>}
            />
            {row.basis === 'city' && row.range && <RangeSource range={rangeIn(row.range, lang)} />}
          </div>
        );
      })}

      {folding && (
        <Button
          type="button"
          variant="chip"
          className="self-start"
          aria-expanded={showZero}
          onClick={() => setShowZero((open) => !open)}
        >
          {text.moreCategories}
          <ChevronDownIcon aria-hidden="true" className={cn('transition-transform', showZero && 'rotate-180')} />
        </Button>
      )}

      {availableMinor > 0 && (
        <p aria-live="polite" className="rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
          {leftoverLine(availableMinor, total, budgetMinor, t, lang)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          {/* Never with €0 everywhere: one tap would empty every envelope. */}
          <Button
            type="button"
            className="px-4"
            disabled={saving || invalid || total === 0}
            onClick={() => void applyBudget()}
          >
            {text.use}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="px-4"
            onClick={() => {
              focus.mark('show');
              setShown(false);
            }}
          >
            {text.notNow}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{text.replaces}</p>
        {invalid && <p className="text-sm text-muted-foreground">{text.fixAmounts}</p>}
        {!invalid && total === 0 && availableMinor > 0 && (
          <p className="text-sm text-muted-foreground">{text.enterOne}</p>
        )}
        {outcome === 'failed' && (
          <p role="status" className="text-sm text-muted-foreground">
            {text.failed}
          </p>
        )}
      </div>
    </section>
  );
}
