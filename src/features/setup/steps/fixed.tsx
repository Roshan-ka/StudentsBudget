'use client';

import { SETUP_FIXED_IDS } from '@/data/categories';
import { CITIES } from '@/data/cities';
import { DraftScheduleFields } from '@/features/recurring/draft-schedule-fields';
import { categoryNameIn } from '@/i18n/category-name';
import { rangeIn } from '@/i18n/city';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { formatRange } from '@/lib/money';
import {
  FIXED_CATEGORIES,
  askedCategories,
  setLineAmount,
  setLineSchedule,
  setRentAmount,
  type AccountOption,
  type DraftUpdate,
  type SetupDraft,
} from '../draft';
import { AmountField } from './amount-field';
import { CategoryCard } from './category-card';
import { RangeSource } from './range-source';
import { StepMore } from './step-more';

const rentRange = CITIES.regensburg.ranges.find((r) => r.categoryId === 'rent');

/**
 * Rent first, with what rooms in Regensburg cost and where that comes from, and its "Add it automatically" right under
 * it; then the other fixed costs. Regensburg is the only city, so setup asks no city. Each its own card (13-11-2026),
 * and what can be added later folded under them.
 */
export function FixedStep({
  draft,
  update,
  accounts,
  today,
  edit,
}: {
  draft: SetupDraft;
  update: DraftUpdate;
  accounts: AccountOption[];
  today: IsoDate;
  /** Edit mode asks every fixed cost; a new setup asks the basic ones. */
  edit: boolean;
}) {
  const { t, lang, locale } = useT();
  const text = t.setup.fixed;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{text.intro}</p>
      <ul className="flex flex-col gap-2.5">
        <CategoryCard
          categoryId="rent"
          field={
            <AmountField
              layout="row"
              label={text.rentLabel}
              value={draft.rentMinor}
              onChange={(minor) => update((d) => setRentAmount(d, minor ?? 0))}
              hint={rentRange && text.rooms(formatRange(rentRange.minMinor, rentRange.maxMinor, locale))}
            />
          }
        >
          {rentRange && <RangeSource range={rangeIn(rentRange, lang)} />}
          {draft.rentSchedule && draft.rentMinor > 0 && (
            <DraftScheduleFields
              name={categoryNameIn(t, 'rent')}
              categoryId="rent"
              type="expense"
              monthlyMinor={draft.rentMinor}
              schedule={draft.rentSchedule}
              accounts={accounts}
              today={today}
              onChange={(schedule) => update((d) => ({ ...d, rentSchedule: schedule }))}
            />
          )}
        </CategoryCard>
        {askedCategories(FIXED_CATEGORIES, SETUP_FIXED_IDS, edit, draft.fixed).map((c) => {
          const line = draft.fixed.find((l) => l.categoryId === c.id);
          const name = categoryNameIn(t, c.id);
          return (
            <CategoryCard
              key={c.id}
              categoryId={c.id}
              field={
                <AmountField
                  layout="row"
                  label={name}
                  value={line?.monthlyMinor ?? 0}
                  onChange={(minor) => update((d) => ({ ...d, fixed: setLineAmount(d.fixed, c.id, minor ?? 0) }))}
                />
              }
            >
              {line?.schedule && line.monthlyMinor > 0 && (
                <DraftScheduleFields
                  name={name}
                  categoryId={c.id}
                  type="expense"
                  monthlyMinor={line.monthlyMinor}
                  schedule={line.schedule}
                  accounts={accounts}
                  today={today}
                  onChange={(schedule) =>
                    update((d) => ({ ...d, fixed: setLineSchedule(d.fixed, c.id, schedule) }))
                  }
                />
              )}
            </CategoryCard>
          );
        })}
      </ul>
      {!edit && (
        <StepMore summary={text.more}>
          <p>{text.later}</p>
        </StepMore>
      )}
    </div>
  );
}
