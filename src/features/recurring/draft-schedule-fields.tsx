'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { draftAccountOf, isRepaired, type AccountOption, type DraftSchedule } from '@/features/setup/draft';
import { AmountField } from '@/features/setup/steps/amount-field';
import { formatMoney, type Minor } from '@/lib/money';
import { ADDED_AGAIN, PICK_ACCOUNT } from './lines';
import { RepeatFields } from './repeat-fields';
import { perOccurrence } from './schedule';

/** Shown wherever a line is set to be added automatically. */
export const AUTO_HINT = "It's added on its day — don't log it by hand.";

/**
 * "Add it automatically" for one line of the setup wizard, with when it repeats and the account it uses. The euro
 * amount above stays the plan figure; an account in another currency asks for its own amount, because setup has
 * no exchange rate to convert with. A stored schedule whose account is gone shows no account until one is picked.
 * Labelled "<name> schedule", so the line's own amount field keeps its label.
 */
export function DraftScheduleFields({
  name,
  monthlyMinor,
  schedule,
  accounts,
  onChange,
}: {
  name: string;
  monthlyMinor: Minor;
  schedule: DraftSchedule;
  accounts: AccountOption[];
  onChange: (next: DraftSchedule) => void;
}) {
  const id = useId();
  const account = draftAccountOf(schedule, accounts);

  return (
    <div role="group" aria-label={`${name} schedule`} className="flex flex-col gap-3 rounded-lg border p-3">
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add an account in Settings to have this added automatically.</p>
      ) : (
        <>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={schedule.on}
              onChange={(event) => onChange({ ...schedule, on: event.target.checked })}
            />
            Add it automatically
          </label>
          {schedule.on && (
            <>
              <p className="text-sm text-muted-foreground">{AUTO_HINT}</p>
              {schedule.saved?.paused && (
                <p className="text-sm text-muted-foreground">
                  Paused for now. Resume it under Fixed costs and income in Settings.
                </p>
              )}
              <RepeatFields timing={schedule} onChange={(timing) => onChange({ ...schedule, ...timing })} />
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-account`}>Account</Label>
                <NativeSelect
                  id={`${id}-account`}
                  className="w-full"
                  value={account?.id ?? ''}
                  // An amount typed for one currency means nothing in another.
                  onChange={(event) => onChange({ ...schedule, accountId: event.target.value, foreignMinor: 0 })}
                >
                  {account === undefined && <NativeSelectOption value="">Pick an account</NativeSelectOption>}
                  {accounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {account === undefined && <p className="text-sm text-muted-foreground">{PICK_ACCOUNT}</p>}
                {isRepaired(schedule, accounts) && <p className="text-sm text-muted-foreground">{ADDED_AGAIN}</p>}
              </div>
              {account && account.currency !== 'EUR' ? (
                <AmountField
                  label={`Amount in ${account.currency}`}
                  unit={account.currency}
                  positive
                  value={schedule.foreignMinor}
                  onChange={(minor) => onChange({ ...schedule, foreignMinor: minor ?? 0 })}
                  hint="Each time it's added. The euro amount stays your plan."
                />
              ) : (
                account &&
                schedule.frequency === 'weekly' && (
                  <p className="text-sm text-muted-foreground">
                    That&apos;s {formatMoney(perOccurrence(monthlyMinor, 'weekly'), 'EUR')} each week.
                  </p>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
