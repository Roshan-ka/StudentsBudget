'use client';

import { SETUP_INCOME_IDS } from '@/data/categories';
import { DraftScheduleFields } from '@/features/recurring/draft-schedule-fields';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import {
  INCOME_CATEGORIES,
  askedCategories,
  setLineAmount,
  setLineSchedule,
  type AccountOption,
  type DraftUpdate,
  type SetupDraft,
} from '../draft';
import { AmountField } from './amount-field';

export function IncomeStep({
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
  /** Edit mode asks every income source; a new setup asks the basic ones. */
  edit: boolean;
}) {
  const { t } = useT();
  const text = t.setup.income;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{text.intro}</p>
      <p className="text-muted-foreground">
        {text.savings.before}
        <em>{text.savings.automatic}</em>
        {text.savings.after}
      </p>
      {!edit && <p className="text-muted-foreground">{text.later}</p>}
      {askedCategories(INCOME_CATEGORIES, SETUP_INCOME_IDS, edit, draft.incomes).map((c) => {
        const line = draft.incomes.find((l) => l.categoryId === c.id);
        const name = categoryNameIn(t, c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <AmountField
              label={name}
              value={line?.monthlyMinor ?? 0}
              onChange={(minor) => update((d) => ({ ...d, incomes: setLineAmount(d.incomes, c.id, minor ?? 0) }))}
            />
            {line?.schedule && line.monthlyMinor > 0 && (
              <DraftScheduleFields
                name={name}
                categoryId={c.id}
                type="income"
                monthlyMinor={line.monthlyMinor}
                schedule={line.schedule}
                accounts={accounts}
                today={today}
                onChange={(schedule) => update((d) => ({ ...d, incomes: setLineSchedule(d.incomes, c.id, schedule) }))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
