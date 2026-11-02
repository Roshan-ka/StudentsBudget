'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Schedule } from '@/db/types';
import { useT } from '@/i18n/use-t';
import { WEEKDAYS, weekdayName } from './schedule';

export type Timing = Pick<Schedule, 'frequency' | 'day'>;

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "Monthly on day [1–31]" or "Weekly on [Monday–Sunday]". Switching the frequency starts over on day 1. */
export function RepeatFields({ timing, onChange }: { timing: Timing; onChange: (next: Timing) => void }) {
  const id = useId();
  const { t, locale } = useT();
  const text = t.recurring;
  const monthly = timing.frequency === 'monthly';

  return (
    <div className="flex flex-col gap-1.5">
      {/* "Monthly on day" is the longer text, so the first column is a little wider: at 375 px an even split clips it. */}
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-repeats`}>{text.repeats}</Label>
          <NativeSelect
            id={`${id}-repeats`}
            className="w-full"
            value={timing.frequency}
            onChange={(event) => onChange({ frequency: event.target.value === 'weekly' ? 'weekly' : 'monthly', day: 1 })}
          >
            <NativeSelectOption value="monthly">{text.monthlyOnDay}</NativeSelectOption>
            <NativeSelectOption value="weekly">{text.weeklyOn}</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-day`}>{text.day}</Label>
          <NativeSelect
            id={`${id}-day`}
            className="w-full"
            value={String(timing.day)}
            onChange={(event) => onChange({ ...timing, day: Number(event.target.value) })}
          >
            {monthly
              ? MONTH_DAYS.map((day) => (
                  <NativeSelectOption key={day} value={String(day)}>
                    {day}
                  </NativeSelectOption>
                ))
              : WEEKDAYS.map((day) => (
                  <NativeSelectOption key={day} value={String(day)}>
                    {weekdayName(day, locale)}
                  </NativeSelectOption>
                ))}
          </NativeSelect>
        </div>
      </div>
      {monthly && timing.day > 28 && <p className="text-sm text-muted-foreground">{text.lastDay}</p>}
    </div>
  );
}
