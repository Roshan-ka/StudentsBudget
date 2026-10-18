'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Plan } from '@/db/types';
import { isDueMonthProblem, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';

type OneOffDraft = SetupDraft['oneOffs'][number];

function monthAfter(today: IsoDate): IsoMonth {
  const [year, month] = monthOf(today).split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function OneOffRow({
  oneOff,
  index,
  today,
  existing,
  onChange,
  onRemove,
}: {
  oneOff: OneOffDraft;
  index: number;
  today: IsoDate;
  existing?: Plan;
  onChange: (change: Partial<OneOffDraft>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [dueTouched, setDueTouched] = useState(false);
  const dueProblem = dueTouched && oneOff.dueMonth !== '' && isDueMonthProblem(oneOff, today, existing);

  return (
    <div role="group" aria-label={`One-off cost ${index + 1}`} className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          className="h-10"
          value={oneOff.name}
          autoComplete="off"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>
      <AmountField
        label="Amount"
        positive
        value={oneOff.amountMinor}
        onChange={(minor) => onChange({ amountMinor: minor ?? 0 })}
      />
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-due`}>Due month</Label>
        <Input
          id={`${id}-due`}
          className="h-10"
          type="month"
          placeholder="YYYY-MM"
          min={monthAfter(today)}
          value={oneOff.dueMonth}
          aria-invalid={dueProblem || undefined}
          aria-describedby={dueProblem ? `${id}-due-error` : undefined}
          onChange={(event) => onChange({ dueMonth: event.target.value })}
          onBlur={() => setDueTouched(true)}
        />
        {dueProblem && (
          <p id={`${id}-due-error`} className="text-sm text-destructive">
            Pick a month after this one.
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" className="h-10 self-start px-4" onClick={onRemove}>
        Remove one-off cost {index + 1}
      </Button>
    </div>
  );
}

export function OneOffsStep({
  draft,
  update,
  today,
  existing,
}: {
  draft: SetupDraft;
  update: DraftUpdate;
  today: IsoDate;
  existing?: Plan;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Big costs that come once, like a semester fee or a deposit. We set a share aside each month until the due
        month. Skip this if you have none.
      </p>
      {draft.oneOffs.map((oneOff, index) => (
        <OneOffRow
          // The rows have no id of their own, and removing one shifts the rest, so index is the identity.
          key={index}
          oneOff={oneOff}
          index={index}
          today={today}
          existing={existing}
          onChange={(change) =>
            update((d) => ({ ...d, oneOffs: d.oneOffs.map((o, i) => (i === index ? { ...o, ...change } : o)) }))
          }
          onRemove={() => update((d) => ({ ...d, oneOffs: d.oneOffs.filter((_, i) => i !== index) }))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-10 self-start px-4"
        onClick={() =>
          update((d) => ({ ...d, oneOffs: [...d.oneOffs, { name: '', amountMinor: 0, dueMonth: '' }] }))
        }
      >
        Add a one-off cost
      </Button>
    </div>
  );
}
