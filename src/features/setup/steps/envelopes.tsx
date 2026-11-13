'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
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
import { useSettled } from '@/lib/use-settled';
import {
  FLEXIBLE_CATEGORIES,
  amountOf,
  askedCategories,
  budgetLine,
  envelopesFooter,
  previewPlan,
  rangeLine,
  suggestionTarget,
  summarizeDraft,
  topicOf,
  withAmount,
  type DraftUpdate,
  type SetupDraft,
} from '../draft';
import { AmountField } from './amount-field';
import { CategoryCard } from './category-card';
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
  // Only an envelope with an amount can be below what students here need; one still at €0 is just not set yet. Two or
  // more say so once, above them, rather than under each (review, 09-11-2026: all six said it at once).
  const below = new Set(
    rangeWarnings(preview, city)
      .map((w) => w.categoryId)
      .filter((id) => (amountOf(draft.envelopes, id) ?? 0) > 0),
  );
  const belowEach = below.size === 1;
  const asked = askedCategories(FLEXIBLE_CATEGORIES, SETUP_ENVELOPE_IDS, edit, draft.envelopes);

  // Every envelope is suggested what is left of the budget (without one, of what is available) after the others that
  // are set; typing into one moves the suggestions of the rest. A target that comes to €0 everywhere suggests €0.
  const budget = draft.spendingBudgetMinor > 0 ? draft.spendingBudgetMinor : 0;
  const summary = summarizeDraft(draft, today, existing);
  const available = Math.max(0, summary.availableMinor);
  // Whole euros, rounded down as the footer does: a set-aside can leave cents, and the line never shows more than there is.
  const availableText = formatMoney(Math.floor(available / 100) * 100, 'EUR', { whole: true, locale });
  const suggested = liveSuggestions(preview.envelopes, SETUP_ENVELOPE_IDS, suggestionTarget(budget, available), city);
  // The button fills the envelopes that are not set, and only where it has something to put in.
  const fillable = SETUP_ENVELOPE_IDS.filter(
    (id) => (amountOf(preview.envelopes, id) ?? 0) <= 0 && (suggested.get(id) ?? 0) > 0,
  );
  const plannedMinor = preview.envelopes.reduce((total, a) => total + a.monthlyMinor, 0);
  // The totals follow the amounts once the typing pauses, so a screen reader reads them once, not after every key
  // (accessibility, chunk 6).
  const line = useSettled(budgetLine(plannedMinor, budget, lang));
  const footer = useSettled(edit ? envelopesFooter(summary, lang) : null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        {(edit ? text.budgetIntroEdit : text.budgetIntroNew)(availableText)}
      </p>
      <div className="grid gap-1.5">
        {/* The budget question in its own card, in the highlight colour (13-11-2026); tokens.test.ts holds its texts. */}
        <div className={cardVariants({ variant: 'accent' })}>
          <AmountField
            label={text.budgetQuestion}
            value={draft.spendingBudgetMinor}
            onChange={(minor) => update((d) => ({ ...d, spendingBudgetMinor: minor ?? 0 }))}
            hint={<p>{budgetHint(t, lang, locale)}</p>}
          />
        </div>
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
      {below.size > 1 && <p className="text-sm text-muted-foreground">{text.belowSome(below.size)}</p>}
      {/* Each envelope its own card, as on Home (13-11-2026). */}
      <ul className="flex flex-col gap-2.5">
        {asked.map((c) => {
          const range = city.ranges.find((r) => r.categoryId === c.id);
          const suggestion = suggested.get(c.id);
          return (
            <CategoryCard
              key={c.id}
              categoryId={c.id}
              field={
                <AmountField
                  layout="row"
                  label={categoryNameIn(t, c.id)}
                  value={amountOf(draft.envelopes, c.id) ?? 0}
                  onChange={(minor) =>
                    update((d) => ({ ...d, envelopes: withAmount(d.envelopes, c.id, minor ?? 0) }))
                  }
                  hint={
                    range && (
                      <>
                        <p>{rangeLine(text.studentsHere, range, lang)}</p>
                        {suggestion !== undefined && (
                          <p>{text.suggested(formatMoney(suggestion, 'EUR', { whole: true, locale }))}</p>
                        )}
                        {belowEach && below.has(c.id) && <p>{text.below}</p>}
                      </>
                    )
                  }
                />
              }
            >
              {/* In Edit plan, every envelope is asked, so the sources stay in the one "Where this comes from" above. */}
              {range && !edit && <RangeSource range={rangeIn(range, lang)} about={categoryNameIn(t, c.id)} />}
            </CategoryCard>
          );
        })}
      </ul>
      {/* The live region stays mounted, so the first total after a budget is typed is announced too. */}
      <div aria-live="polite">
        {(line !== null || edit) && (
          <div className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-sm font-medium tabular-nums">
            {line !== null && <p>{line}</p>}
            {footer !== null && <p className="font-normal text-muted-foreground">{footer}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
