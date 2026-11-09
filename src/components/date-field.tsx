'use client';

import { useEffect, useId, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { datePlaceholder } from '@/i18n/regions';
import { useT } from '@/i18n/use-t';
import { describedBy as describedByIds } from '@/lib/described-by';
import { formatDate, todayIso, type IsoDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { DateCalendar } from './date-calendar';
import { DATE_CHIPS, chipDate, selectedChip } from './date-field-helpers';
import { readTypedDate, typedDateText } from './date-input';

/** What the field shows for a date: the region's form (06.11.2026), or nothing for no date. */
function shown(value: IsoDate): string {
  return value === '' ? '' : formatDate(value);
}

/**
 * A whole date, with its four-digit year: the form gets it while it is typed, so a chip or a save straight after sees
 * it. A shorter form ("6.11") waits until the person leaves the field, since it may still grow ("6.11" is also the
 * start of "6.11.2027").
 */
const WITH_FULL_YEAR = /\d{4}\s*$/;

/** What the field holds: the date it last reported (or was given), the text it shows, and whether that text is no date. */
type FieldState = { value: IsoDate; typed: string; notADate: boolean };

/**
 * A date you type in the region's form (06.11.2026), with Today and Yesterday next to it unless `chips` is false (a
 * date that is rarely today, like a semester's). Typing fills in the separators (`typedDateText`), and short forms
 * count (`readTypedDate`: 6.11, 6.11.26, 0611). A whole date reaches the form while it is typed; anything else when
 * the person leaves the field or presses Enter, which rewrites it in full or, for text that is no date, says so in
 * place of the hint and gives the form an empty date, which its own check refuses. Today follows the clock
 * (`useToday`). `invalid` and `describedBy` mark the field and point at the form's error. The label is "Date" in the
 * phone's language unless `label` names it. The button at the end opens the calendar (`DateCalendar`), where `min`
 * is the earliest day that can be picked; a typed date before it is left to the form's own check.
 *
 * `onNotADate` tells the form whether the field holds text that is no date. A form whose date may be empty needs it:
 * its own check can't tell such text from a field left blank on purpose, and would save over a date that was there
 * (Profile's semester dates, review of 09-11-2026).
 */
export function DateField({
  value,
  onChange,
  label,
  chips = true,
  min,
  invalid = false,
  describedBy,
  onNotADate,
}: {
  value: IsoDate;
  onChange: (value: IsoDate) => void;
  label?: string;
  chips?: boolean;
  min?: IsoDate;
  invalid?: boolean;
  describedBy?: string;
  onNotADate?: (notADate: boolean) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const { t } = useT();
  const text = t.common.dateField;
  const today = useToday();
  const selected = today === null ? null : selectedChip(value, today);
  const form = datePlaceholder(text.letters);
  const name = label ?? text.label;

  // The text follows `value` only when the date changes from outside: a chip, the clock, an entry opened to edit, a
  // university's semester. A date the field reported itself is already `field.value`, so what the person typed stays,
  // even text that is no date while the form holds none.
  const [field, setField] = useState<FieldState>(() => ({ value, typed: shown(value), notADate: false }));
  if (field.value !== value) setField({ value, typed: shown(value), notADate: false });

  useEffect(() => {
    onNotADate?.(field.notADate);
  }, [field.notADate, onNotADate]);

  function report(next: FieldState) {
    setField(next);
    if (next.value !== value) onChange(next.value);
  }

  function type(event: ChangeEvent<HTMLInputElement>) {
    const typed = typedDateText(field.typed, event.target.value);
    const read = readTypedDate(typed, today ?? todayIso());
    if (read.kind === 'date' && WITH_FULL_YEAR.test(typed)) report({ value: read.date, typed, notADate: false });
    else setField({ ...field, typed, notADate: false });
  }

  /** Reads what was typed, rewrites it in full, and tells whether the form's date changed. */
  function commit(): boolean {
    const read = readTypedDate(field.typed, today ?? todayIso());
    if (read.kind === 'date') {
      report({ value: read.date, typed: formatDate(read.date), notADate: false });
      return read.date !== value;
    }
    report({ value: '', typed: read.kind === 'empty' ? '' : field.typed, notADate: read.kind === 'not-a-date' });
    return value !== '';
  }

  // Enter keeps the form from saving only when it changed the date: the save would still have the one before.
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && commit()) event.preventDefault();
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{name}</Label>
      <div
        data-slot="date-field"
        className="flex min-h-[50px] items-center gap-2 rounded-md border-[1.5px] border-input bg-card ps-3.5 pe-1.5 text-base transition-colors has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring has-[[aria-invalid]]:border-destructive md:text-sm dark:bg-input/30"
      >
        {/* 16 px on a phone, so iOS does not zoom in on it. A number pad: the separators fill in by themselves. No width
            of its own (w-0, then flex-1 fills the row): an input is 20 characters wide by default, which at 200 % text
            made the field wider than the phone (reflow.spec). */}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={form}
          value={field.typed}
          aria-invalid={invalid || field.notADate || undefined}
          aria-describedby={describedByIds(describedBy, hintId)}
          onChange={type}
          onBlur={commit}
          onKeyDown={keyDown}
          className="w-0 min-w-0 flex-1 self-stretch bg-transparent tabular-nums outline-none placeholder:text-muted-foreground"
        />
        <DateCalendar
          value={value}
          min={min}
          field={name}
          onPick={(day) => report({ value: day, typed: formatDate(day), notADate: false })}
        />
      </div>
      {/* The hint, or in its place why the typed text is no date; read out when it changes. */}
      <p
        id={hintId}
        aria-live="polite"
        className={cn('text-sm', field.notADate ? 'text-destructive' : 'text-muted-foreground')}
      >
        {field.notADate ? text.notADate(form) : text.hint(form)}
      </p>
      {chips && (
        <div role="group" aria-label={text.pickDay} className="flex flex-wrap gap-2">
          {DATE_CHIPS.map((chip) => (
            <Button
              key={chip}
              type="button"
              variant="chip"
              aria-pressed={selected === chip}
              disabled={today === null}
              onClick={() => {
                if (today !== null) onChange(chipDate(chip, today));
              }}
            >
              {text[chip]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
