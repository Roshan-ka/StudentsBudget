'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { SETUP_ENVELOPE_IDS } from '@/data/categories';
import { CITIES } from '@/data/cities';
import type { Plan } from '@/db/types';
import { liveSuggestions } from '@/features/home/suggest-budget';
import { categoryNameIn } from '@/i18n/category-name';
import { rangeIn } from '@/i18n/city';
import { listFormat } from '@/i18n/format';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { rangeWarnings } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, formatRange } from '@/lib/money';
import {
  FLEXIBLE_CATEGORIES,
  amountOf,
  askedCategories,
  budgetLine,
  envelopesFooter,
  previewPlan,
  rangeLine,
  summarizeDraft,
  topicOf,
  withAmount,
  type DraftUpdate,
  type SetupDraft,
} from '../draft';
import { AmountField } from './amount-field';
import { RangeSource } from './range-source';

const RANGES = CITIES.regensburg.ranges.filter((r) => SETUP_ENVELOPE_IDS.includes(r.categoryId));

/**
 * Where the six envelopes typically add up to, bottom to top (the sums of their city ranges), and which of them no
 * page states, as everywhere else: "Eating out, going out and transport are estimates."
 */
function budgetHint(t: Messages, lang: Language, locale: string): string {
  const typical = formatRange(
    RANGES.reduce((total, r) => total + r.minMinor, 0),
    RANGES.reduce((total, r) => total + r.maxMinor, 0),
    locale,
  );
  const estimates = RANGES.filter((r) => r.source === 'Estimate').map((r) => topicOf(r.categoryId, lang));
  const text = t.setup.envelopes;
  const sentences = [text.typicalSpend(typical)];
  if (estimates.length > 0) sentences.push(text.estimates(listFormat(locale).format(estimates), estimates.length));
  return sentences.join(' ');
}

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
  const { t, lang, locale } = useT();
  const text = t.setup.envelopes;
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
  const line = budgetLine(plannedMinor, budget, lang);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{text.budgetIntro}</p>
      <div className="grid gap-1.5">
        <AmountField
          label={text.budgetQuestion}
          value={draft.spendingBudgetMinor}
          onChange={(minor) => update((d) => ({ ...d, spendingBudgetMinor: minor ?? 0 }))}
          hint={<p>{budgetHint(t, lang, locale)}</p>}
        />
        <details className="text-xs text-muted-foreground">
          {/* The same 44 px tap target as a source line. */}
          <summary className="w-fit cursor-pointer py-3.5">{text.whereFrom}</summary>
          <div className="flex flex-col">
            {RANGES.map((range) => (
              <RangeSource
                key={range.categoryId}
                range={rangeIn(range, lang)}
                label={t.common.source.of(categoryNameIn(t, range.categoryId))}
              />
            ))}
          </div>
        </details>
      </div>
      <p className="text-muted-foreground">{edit ? text.askEdit : text.askNew}</p>
      {fillable.length > 0 && (
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="px-4"
            aria-describedby={noteId}
            onClick={() =>
              update((d) => ({
                ...d,
                envelopes: fillable.reduce((list, id) => withAmount(list, id, suggested.get(id) ?? 0), d.envelopes),
              }))
            }
          >
            {text.useSuggested}
          </Button>
          <p id={noteId} className="text-sm text-muted-foreground">
            {text.fillsOnly}
          </p>
        </div>
      )}
      {asked.map((c) => {
        const range = city.ranges.find((r) => r.categoryId === c.id);
        const suggestion = suggested.get(c.id);
        return (
          <div key={c.id} className="grid gap-1.5">
            <AmountField
              label={categoryNameIn(t, c.id)}
              value={amountOf(draft.envelopes, c.id) ?? 0}
              onChange={(minor) => update((d) => ({ ...d, envelopes: withAmount(d.envelopes, c.id, minor ?? 0) }))}
              hint={
                range && (
                  <>
                    <p>{rangeLine(text.studentsHere, range, lang)}</p>
                    {suggestion !== undefined && (
                      <p>{text.suggested(formatMoney(suggestion, 'EUR', { whole: true, locale }))}</p>
                    )}
                    {below.has(c.id) && <p>{text.below}</p>}
                  </>
                )
              }
            />
            {range && <RangeSource range={rangeIn(range, lang)} />}
          </div>
        );
      })}
      {/* The live region stays mounted, so the first total after a budget is typed is announced too. */}
      <div aria-live="polite">
        {(line !== null || edit) && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
            {line !== null && <p>{line}</p>}
            {edit && (
              <p className="font-normal text-muted-foreground">
                {envelopesFooter(summarizeDraft(draft, today, existing), lang)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
