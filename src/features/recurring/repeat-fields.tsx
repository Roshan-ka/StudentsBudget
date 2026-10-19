'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Schedule } from '@/db/types';
import { WEEKDAYS } from './schedule';

export type Timing = Pick<Schedule, 'frequency' | 'day'>;

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "Monthly on day [1–31]" or "Weekly on [Monday–Sunday]". Switching the frequency starts over on day 1. */
export function RepeatFields({ timing, onChange }: { timing: Timing; onChange: (next: Timing) => void }) {
  const id = useId();
  const monthly = timing.frequency === 'monthly';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-repeats`}>Repeats</Label>
          <NativeSelect
            id={`${id}-repeats`}
            className="w-full"
            value={timing.frequency}
            onChange={(event) => onChange({ frequency: event.target.value === 'weekly' ? 'weekly' : 'monthly', day: 1 })}
          >
            <NativeSelectOption value="monthly">Monthly on day</NativeSelectOption>
            <NativeSelectOption value="weekly">Weekly on</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-day`}>Day</Label>
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
              : WEEKDAYS.map((name, i) => (
                  <NativeSelectOption key={name} value={String(i + 1)}>
                    {name}
                  </NativeSelectOption>
                ))}
          </NativeSelect>
        </div>
      </div>
      {monthly && timing.day > 28 && (
        <p className="text-sm text-muted-foreground">In a shorter month it&apos;s added on the last day.</p>
      )}
    </div>
  );
}
