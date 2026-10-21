'use client';

import { SETUP_INCOME_IDS } from '@/data/categories';
import { DraftScheduleFields } from '@/features/recurring/draft-schedule-fields';
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
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        How much comes in each month, in euros? Leave out what you do not get. If it varies, enter a low estimate.
      </p>
      <p className="text-muted-foreground">
        Living off savings? Add what you use each month under Other income and switch off{' '}
        <em>Add it automatically</em>.
      </p>
      {askedCategories(INCOME_CATEGORIES, SETUP_INCOME_IDS, edit, draft.incomes).map((c) => {
        const line = draft.incomes.find((l) => l.categoryId === c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <AmountField
              label={c.name}
              value={line?.monthlyMinor ?? 0}
              onChange={(minor) => update((d) => ({ ...d, incomes: setLineAmount(d.incomes, c.id, minor ?? 0) }))}
            />
            {line?.schedule && line.monthlyMinor > 0 && (
              <DraftScheduleFields
                name={c.name}
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
