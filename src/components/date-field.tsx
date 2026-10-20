'use client';

import { CalendarIcon } from 'lucide-react';
import { useId, type MouseEvent } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { IsoDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { DATE_CHIPS, chipDate, dateText, selectedChip } from './date-field-helpers';

/**
 * Opens the picker on a mouse click anywhere on the field. A phone opens it on any tap by itself; a desktop
 * browser only does for the calendar icon, so there the click asks for it. A touch tap is left to the browser.
 */
function openPickerOnMouseClick(event: MouseEvent<HTMLInputElement>) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  try {
    event.currentTarget.showPicker();
  } catch {
    // The browser has no showPicker, or does not allow it here: the field still works by typing.
  }
}

/**
 * A date as DD-MM-YYYY on a button-sized field, with Today and Yesterday next to it. The native date input
 * lies over the field, transparent: a tap anywhere on the field opens the picker, and the input carries the
 * label and the ISO value. The text under it is for the eye only. Today follows the clock (`useToday`).
 */
export function DateField({
  value,
  onChange,
  label = 'Date',
}: {
  value: IsoDate;
  onChange: (value: IsoDate) => void;
  label?: string;
}) {
  const id = useId();
  const today = useToday();
  const selected = today === null ? null : selectedChip(value, today);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div
        data-slot="date-field"
        className="relative flex h-10 items-center justify-between gap-2 rounded-lg border border-input px-2.5 text-base transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <span aria-hidden="true" className={cn('tabular-nums', value === '' && 'text-muted-foreground')}>
          {dateText(value)}
        </span>
        <CalendarIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {/* 16 px, so iOS does not zoom in on it; one pixel past the border, so the whole field is the target. */}
        <input
          id={id}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={openPickerOnMouseClick}
          className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] min-w-0 cursor-pointer appearance-none text-base opacity-0"
        />
      </div>
      <div role="group" aria-label="Pick a day" className="flex flex-wrap gap-2">
        {DATE_CHIPS.map((chip) => (
          <Button
            key={chip.id}
            type="button"
            variant={selected === chip.id ? 'default' : 'outline'}
            aria-pressed={selected === chip.id}
            className="h-10 px-3"
            disabled={today === null}
            onClick={() => {
              if (today !== null) onChange(chipDate(chip.id, today));
            }}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
