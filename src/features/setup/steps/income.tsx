'use client';

import { INCOME_CATEGORIES, amountOf, withAmount, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';

export function IncomeStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        How much comes in each month, in euros? Leave out what you do not get. If it varies, enter a low estimate.
      </p>
      {INCOME_CATEGORIES.map((c) => (
        <AmountField
          key={c.id}
          label={c.name}
          value={amountOf(draft.incomes, c.id) ?? 0}
          onChange={(minor) =>
            // A source you do not have is no row, so a 0 removes it.
            update((d) => ({ ...d, incomes: withAmount(d.incomes, c.id, minor === 0 ? undefined : minor) }))
          }
        />
      ))}
    </div>
  );
}
