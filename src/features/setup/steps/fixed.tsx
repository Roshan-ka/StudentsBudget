'use client';

import { FIXED_CATEGORIES, amountOf, withAmount, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';

export function FixedStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        What do you pay every month, in euros? Your rent is already in from step 1. Leave out what you do not pay.
      </p>
      {FIXED_CATEGORIES.map((c) => (
        <AmountField
          key={c.id}
          label={c.name}
          value={amountOf(draft.fixed, c.id) ?? 0}
          onChange={(minor) =>
            // A cost you do not have is no row, so a 0 removes it.
            update((d) => ({ ...d, fixed: withAmount(d.fixed, c.id, minor === 0 ? undefined : minor) }))
          }
        />
      ))}
    </div>
  );
}
