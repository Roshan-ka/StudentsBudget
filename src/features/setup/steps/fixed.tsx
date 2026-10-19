'use client';

import { DraftScheduleFields } from '@/features/recurring/draft-schedule-fields';
import { formatMoney } from '@/lib/money';
import {
  FIXED_CATEGORIES,
  setLineAmount,
  setLineSchedule,
  type AccountOption,
  type DraftUpdate,
  type SetupDraft,
} from '../draft';
import { AmountField } from './amount-field';

/** The fixed costs, and rent's "Add it automatically": asked here rather than in step 1, once the accounts are known. */
export function FixedStep({
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
        What do you pay every month, in euros? Your rent is already in from step 1. Leave out what you do not pay.
      </p>
      {draft.rentSchedule && draft.rentMinor > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Rent: {formatMoney(draft.rentMinor, 'EUR')} a month</p>
          <DraftScheduleFields
            name="Rent"
            monthlyMinor={draft.rentMinor}
            schedule={draft.rentSchedule}
            accounts={accounts}
            onChange={(schedule) => update((d) => ({ ...d, rentSchedule: schedule }))}
          />
        </div>
      )}
      {FIXED_CATEGORIES.map((c) => {
        const line = draft.fixed.find((l) => l.categoryId === c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <AmountField
              label={c.name}
              value={line?.monthlyMinor ?? 0}
              onChange={(minor) => update((d) => ({ ...d, fixed: setLineAmount(d.fixed, c.id, minor ?? 0) }))}
            />
            {line?.schedule && line.monthlyMinor > 0 && (
              <DraftScheduleFields
                name={c.name}
                monthlyMinor={line.monthlyMinor}
                schedule={line.schedule}
                accounts={accounts}
                onChange={(schedule) => update((d) => ({ ...d, fixed: setLineSchedule(d.fixed, c.id, schedule) }))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
