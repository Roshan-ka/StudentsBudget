'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CITIES } from '@/data/cities';
import { formatRange } from '@/lib/money';
import { setRentAmount, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';
import { RangeSource } from './range-source';

const rentRange = CITIES.regensburg.ranges.find((r) => r.categoryId === 'rent');

export function CityRentStep({ draft, update }: { draft: SetupDraft; update: DraftUpdate }) {
  const cityId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={cityId}>City</Label>
        <NativeSelect id={cityId} className="w-full" defaultValue="regensburg" disabled>
          <NativeSelectOption value="regensburg">{CITIES.regensburg.name}</NativeSelectOption>
        </NativeSelect>
        <p className="text-sm text-muted-foreground">Regensburg is the only city for now.</p>
      </div>
      <div className="grid gap-1.5">
        <AmountField
          label="Rent per month"
          value={draft.rentMinor}
          // Whether rent is added automatically is asked with the fixed costs, once the accounts are known.
          onChange={(minor) => update((d) => setRentAmount(d, minor ?? 0))}
          hint={rentRange && `Rooms here: ${formatRange(rentRange.minMinor, rentRange.maxMinor)}`}
        />
        {rentRange && <RangeSource range={rentRange} />}
      </div>
    </div>
  );
}
