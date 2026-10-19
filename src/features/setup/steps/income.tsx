'use client';

import { DraftScheduleFields } from '@/features/recurring/draft-schedule-fields';
import {
  INCOME_CATEGORIES,
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
}: {
  draft: SetupDraft;
  update: DraftUpdate;
  accounts: AccountOption[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        How much comes in each month, in euros? Leave out what you do not get. If it varies, enter a low estimate.
      </p>
      {INCOME_CATEGORIES.map((c) => {
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
                onChange={(schedule) => update((d) => ({ ...d, incomes: setLineSchedule(d.incomes, c.id, schedule) }))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
