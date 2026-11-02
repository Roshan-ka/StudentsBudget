'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { draftAccountOf, isRepaired, type AccountOption, type DraftSchedule } from '@/features/setup/draft';
import { AmountField } from '@/features/setup/steps/amount-field';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { formatMoney, type Minor } from '@/lib/money';
import { firstAddedLine } from './lines';
import { RepeatFields } from './repeat-fields';
import { firstAddedOn, perOccurrence, type LineType } from './schedule';
import { useLineEntries } from './use-line-entries';

/**
 * "Add it automatically" for one line of the setup wizard, with when it repeats and the account it uses. The euro
 * amount above stays the plan figure; an account in another currency asks for its own amount, because setup has
 * no exchange rate to convert with. A stored schedule whose account is gone shows no account until one is picked.
 * A line that has not started yet (new, turned on, resumed or added again) says when its first entry comes.
 * Labelled "<name> schedule", so the line's own amount field keeps its label. The line's `categoryId` and `type` let
 * the first entry's date skip a period the line already has an automatic entry in (edit mode; a new setup has none).
 */
export function DraftScheduleFields({
  name,
  categoryId,
  type,
  monthlyMinor,
  schedule,
  accounts,
  today,
  onChange,
}: {
  name: string;
  categoryId: string;
  type: LineType;
  monthlyMinor: Minor;
  schedule: DraftSchedule;
  accounts: AccountOption[];
  /** The wizard's day, which Save starts new schedules from. */
  today: IsoDate;
  onChange: (next: DraftSchedule) => void;
}) {
  const id = useId();
  const { t, lang, locale } = useT();
  const text = t.recurring;
  const account = draftAccountOf(schedule, accounts);
  // Saving starts a line without a stored schedule tomorrow, and one whose account was gone again from tomorrow.
  const lineEntries = useLineEntries(type, categoryId);
  // The entries only move the day later, never make it appear, so an empty line holds its place while they load.
  const repaired = isRepaired(schedule, accounts);
  const expectsFirst = account !== undefined && firstAddedOn(schedule, schedule.saved, today, repaired) !== null;
  const firstOn =
    expectsFirst && lineEntries ? firstAddedOn(schedule, schedule.saved, today, repaired, lineEntries) : null;

  return (
    <div role="group" aria-label={text.schedule(name)} className="flex flex-col gap-3 rounded-lg border p-3">
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.noAccountSettings}</p>
      ) : (
        <>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={schedule.on}
              onChange={(event) => onChange({ ...schedule, on: event.target.checked })}
            />
            {text.automatic}
          </label>
          {schedule.on && (
            <>
              <p className="text-sm text-muted-foreground">{text.autoHint}</p>
              {schedule.saved?.paused && <p className="text-sm text-muted-foreground">{text.pausedForNow}</p>}
              <RepeatFields timing={schedule} onChange={(timing) => onChange({ ...schedule, ...timing })} />
              {expectsFirst && (
                <p className="min-h-5 text-sm text-muted-foreground">
                  {firstOn ? firstAddedLine(firstOn, lang) : null}
                </p>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-account`}>{text.account}</Label>
                <NativeSelect
                  id={`${id}-account`}
                  className="w-full"
                  value={account?.id ?? ''}
                  // An amount typed for one currency means nothing in another.
                  onChange={(event) => onChange({ ...schedule, accountId: event.target.value, foreignMinor: 0 })}
                >
                  {account === undefined && <NativeSelectOption value="">{text.pickAccountOption}</NativeSelectOption>}
                  {accounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {t.common.accountOption(a.name, a.currency)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {account === undefined && <p className="text-sm text-muted-foreground">{text.pickAccount}</p>}
                {isRepaired(schedule, accounts) && <p className="text-sm text-muted-foreground">{text.addedAgain}</p>}
              </div>
              {account && account.currency !== 'EUR' ? (
                <AmountField
                  label={text.amountIn(account.currency)}
                  unit={account.currency}
                  positive
                  value={schedule.foreignMinor}
                  onChange={(minor) => onChange({ ...schedule, foreignMinor: minor ?? 0 })}
                  hint={text.keepsPlan}
                />
              ) : (
                account &&
                schedule.frequency === 'weekly' && (
                  <p className="text-sm text-muted-foreground">
                    {text.eachWeek(formatMoney(perOccurrence(monthlyMinor, 'weekly'), 'EUR', { locale }))}
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
