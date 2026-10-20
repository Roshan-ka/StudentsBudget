'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/db/db';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Plan } from '@/db/types';
import { monthLabel, semesterFeeOffer } from '@/features/profile/profile';
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
  focusAmount = false,
  onChange,
  onRemove,
}: {
  oneOff: OneOffDraft;
  index: number;
  today: IsoDate;
  existing?: Plan;
  /** The row the semester-fee offer just added: its amount is the one thing left to fill in. */
  focusAmount?: boolean;
  onChange: (change: Partial<OneOffDraft>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [dueTouched, setDueTouched] = useState(false);
  const dueProblem = dueTouched && oneOff.dueMonth !== '' && isDueMonthProblem(oneOff, today, existing);
  const groupRef = useRef<HTMLDivElement>(null);
  // Only when the row appears: the offer's button is gone, and focus would otherwise drop to the page.
  const [focusOnMount] = useState(focusAmount);
  useEffect(() => {
    if (focusOnMount) groupRef.current?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus();
  }, [focusOnMount]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={`One-off cost ${index + 1}`}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
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
  // With semester dates in the profile, one tap adds the next semester fee; the person fills in the amount.
  const profile = useLiveQuery(() => db.profile.get('current'), []);
  const feeOffer = semesterFeeOffer(profile, today, draft.oneOffs);
  // The index of the row the offer added, so that row takes the focus when it appears.
  const [feeRow, setFeeRow] = useState<number | null>(null);

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
          focusAmount={index === feeRow}
          onChange={(change) =>
            update((d) => ({ ...d, oneOffs: d.oneOffs.map((o, i) => (i === index ? { ...o, ...change } : o)) }))
          }
          onRemove={() => {
            setFeeRow(null);
            update((d) => ({ ...d, oneOffs: d.oneOffs.filter((_, i) => i !== index) }));
          }}
        />
      ))}
      {feeOffer && (
        <Button
          type="button"
          variant="outline"
          // The longest label ("…, due September 2027") wraps on a narrow phone instead of scrolling sideways.
          className="h-auto min-h-10 self-start px-4 py-2 text-left whitespace-normal"
          onClick={() => {
            setFeeRow(draft.oneOffs.length);
            update((d) => ({ ...d, oneOffs: [...d.oneOffs, feeOffer] }));
          }}
        >
          {`Add semester fee, due ${monthLabel(feeOffer.dueMonth)}`}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-10 self-start px-4"
        onClick={() => {
          setFeeRow(null);
          update((d) => ({ ...d, oneOffs: [...d.oneOffs, { name: '', amountMinor: 0, dueMonth: '' }] }));
        }}
      >
        Add a one-off cost
      </Button>
    </div>
  );
}
