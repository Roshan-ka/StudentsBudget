'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/db/db';
import { monthOf, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Plan } from '@/db/types';
import { monthLabel, semesterFeeOffer, type SemesterFeeOffer } from '@/features/profile/profile';
import { SemesterFeeSource } from '@/features/profile/semester-fee-source';
import { formatMoney } from '@/lib/money';
import { isDueMonthProblem, type DraftUpdate, type SetupDraft } from '../draft';
import { AmountField } from './amount-field';

type OneOffDraft = SetupDraft['oneOffs'][number];

function monthAfter(today: IsoDate): IsoMonth {
  const [year, month] = monthOf(today).split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** "Add semester fee: €215, due March 2027", or without the amount when no page states it. */
function offerLabel({ row }: SemesterFeeOffer): string {
  const { amountMinor, dueMonth } = row;
  const amount = amountMinor > 0 ? `: ${formatMoney(amountMinor, 'EUR', { whole: amountMinor % 100 === 0 })}` : '';
  return `Add semester fee${amount}, due ${monthLabel(dueMonth)}`;
}

function OneOffRow({
  oneOff,
  index,
  today,
  existing,
  feeOffer,
  onChange,
  onRemove,
}: {
  oneOff: OneOffDraft;
  index: number;
  today: IsoDate;
  existing?: Plan;
  /** The semester-fee offer this row was added from: its amount is what to check or fill in, with its source. */
  feeOffer?: SemesterFeeOffer;
  onChange: (change: Partial<OneOffDraft>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [dueTouched, setDueTouched] = useState(false);
  const dueProblem = dueTouched && oneOff.dueMonth !== '' && isDueMonthProblem(oneOff, today, existing);
  const amountRef = useRef<HTMLInputElement>(null);
  // Only when the row appears: the offer's button is gone, and focus would otherwise drop to the page.
  const [focusOnMount] = useState(feeOffer !== undefined);
  useEffect(() => {
    if (focusOnMount) amountRef.current?.focus();
  }, [focusOnMount]);
  // The source stays with the amount while it is the offered one.
  const feeSource =
    feeOffer && oneOff.amountMinor === feeOffer.row.amountMinor ? <SemesterFeeSource offer={feeOffer} /> : undefined;
  // A named cost with no amount is left out when saving: say so where the amount goes, without stopping anyone.
  const leftOut = oneOff.name.trim() !== '' && oneOff.amountMinor === 0;

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
        hint={
          feeSource || leftOut ? (
            <>
              {feeSource}
              {leftOut && <p>Without an amount, this cost isn&apos;t saved.</p>}
            </>
          ) : undefined
        }
        inputRef={amountRef}
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
  // With semester dates in the profile, one tap adds the next semester fee, with its amount where a page states it.
  const profile = useLiveQuery(() => db.profile.get('current'), []);
  const feeOffer = semesterFeeOffer(profile, today, draft.oneOffs);
  // The row the offer added and the offer it came from: that row takes the focus and keeps the source.
  const [added, setAdded] = useState<{ index: number; offer: SemesterFeeOffer } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Big costs that come once, like a semester fee or a deposit. We set a share aside each month until the due
        month. Skip this if you have none. A cost without an amount isn&apos;t saved.
      </p>
      {draft.oneOffs.map((oneOff, index) => (
        <OneOffRow
          // The rows have no id of their own, and removing one shifts the rest, so index is the identity.
          key={index}
          oneOff={oneOff}
          index={index}
          today={today}
          existing={existing}
          feeOffer={added?.index === index ? added.offer : undefined}
          onChange={(change) =>
            update((d) => ({ ...d, oneOffs: d.oneOffs.map((o, i) => (i === index ? { ...o, ...change } : o)) }))
          }
          onRemove={() => {
            // The offered row moves up one place when a row above it goes.
            setAdded((a) => {
              if (a === null || a.index === index) return null;
              return index < a.index ? { ...a, index: a.index - 1 } : a;
            });
            update((d) => ({ ...d, oneOffs: d.oneOffs.filter((_, i) => i !== index) }));
          }}
        />
      ))}
      {feeOffer && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            // The longest label ("…: €222, due September 2027") wraps on a narrow phone instead of scrolling sideways.
            className="h-auto min-h-10 self-start px-4 py-2 text-left whitespace-normal"
            onClick={() => {
              setAdded({ index: draft.oneOffs.length, offer: feeOffer });
              update((d) => ({ ...d, oneOffs: [...d.oneOffs, feeOffer.row] }));
            }}
          >
            {offerLabel(feeOffer)}
          </Button>
          <SemesterFeeSource offer={feeOffer} />
        </div>
      )}
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
