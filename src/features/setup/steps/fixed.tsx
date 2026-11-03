'use client';

import { SETUP_FIXED_IDS } from '@/data/categories';
import { DraftScheduleFields } from '@/features/recurring/draft-schedule-fields';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  FIXED_CATEGORIES,
  askedCategories,
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
  const { t, locale } = useT();
  const text = t.setup.fixed;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{text.intro}</p>
      {!edit && <p className="text-muted-foreground">{text.later}</p>}
      {draft.rentSchedule && draft.rentMinor > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{text.rent(formatMoney(draft.rentMinor, 'EUR', { locale }))}</p>
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
        </div>
      )}
      {askedCategories(FIXED_CATEGORIES, SETUP_FIXED_IDS, edit, draft.fixed).map((c) => {
        const line = draft.fixed.find((l) => l.categoryId === c.id);
        const name = categoryNameIn(t, c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <AmountField
              label={name}
              value={line?.monthlyMinor ?? 0}
              onChange={(minor) => update((d) => ({ ...d, fixed: setLineAmount(d.fixed, c.id, minor ?? 0) }))}
            />
            {line?.schedule && line.monthlyMinor > 0 && (
              <DraftScheduleFields
                name={name}
                categoryId={c.id}
                type="expense"
                monthlyMinor={line.monthlyMinor}
                schedule={line.schedule}
                accounts={accounts}
                today={today}
                onChange={(schedule) => update((d) => ({ ...d, fixed: setLineSchedule(d.fixed, c.id, schedule) }))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
