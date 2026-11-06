'use client';

import { Dialog } from '@base-ui/react/dialog';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { dateFormat } from '@/i18n/format';
import { LANGUAGES } from '@/i18n/languages';
import { useT } from '@/i18n/use-t';
import { addDays, formatDate, monthOf, todayIso, type IsoDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { isCalendarKey, monthWeeks, movedDay, shiftDayByMonths } from './date-input';

/** A Monday, to name the weekdays from: Monday 2 November 2026 and the six days after it. */
const A_MONDAY = '2026-11-02';

/**
 * The date field's calendar (docs/superpowers/plans/2026-11-06-date-field.md, chunk 3): the button at the end of the
 * field, and the month it opens as a sheet from the bottom (a card in the middle on a wider screen). It follows the
 * date-picker dialog of the WAI-ARIA practices: a grid of six Monday–Sunday weeks, the arrow keys, Home and End,
 * Page Up and Page Down (a year with Shift) move the focus, Enter or Space picks, Escape closes, and closing hands the
 * focus back to the button. It opens on `value`, or on today without one. Days before `min` show but can't be picked.
 */
export function DateCalendar({
  value,
  min,
  field,
  onPick,
}: {
  value: IsoDate;
  min?: IsoDate;
  /** The field's label, which names the button: "Open the calendar: Semester start". */
  field: string;
  onPick: (date: IsoDate) => void;
}) {
  const { t, lang, locale } = useT();
  const text = t.common.dateField;
  // Every language so far reads left to right; the registry's type would refuse the comparison without the widening.
  const dir: string = LANGUAGES[lang].dir;
  const rtl = dir === 'rtl';
  const today = useToday();
  const monthId = useId();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<IsoDate>(value);
  const focusedRef = useRef<HTMLTableCellElement>(null);
  // Only a key moves the focus to the new day; the month buttons keep it, as the practices ask.
  const keyMoved = useRef(false);

  useEffect(() => {
    if (!keyMoved.current) return;
    keyMoved.current = false;
    focusedRef.current?.focus();
  }, [focused]);

  function openChange(next: boolean) {
    if (next) setFocused(value || today || todayIso());
    setOpen(next);
  }

  function pick(day: IsoDate) {
    if (min !== undefined && day < min) return;
    onPick(day);
    setOpen(false);
  }

  function keyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(focused);
      return;
    }
    if (!isCalendarKey(event.key)) return;
    event.preventDefault();
    const next = movedDay(focused, event.key, event.shiftKey, rtl);
    if (next === focused) return;
    keyMoved.current = true;
    setFocused(next);
  }

  const month = monthOf(focused);
  const monthName = dateFormat(locale, { month: 'long', year: 'numeric' }).format(parseISO(`${month}-01`));
  const weekdays = Array.from({ length: 7 }, (_, index) => addDays(A_MONDAY, index)).map((day) => ({
      short: dateFormat(locale, { weekday: 'short' }).format(parseISO(day)),
      long: dateFormat(locale, { weekday: 'long' }).format(parseISO(day)),
    }));
  const dayName = (day: IsoDate) => text.day(dateFormat(locale, { weekday: 'long' }).format(parseISO(day)), formatDate(day));
  const PreviousIcon = rtl ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = rtl ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <Dialog.Root open={open} onOpenChange={openChange}>
      <Dialog.Trigger
        aria-label={text.openCalendar(field)}
        className="-me-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
      >
        <CalendarIcon aria-hidden="true" className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        {/* A sheet from the bottom on a phone, in thumb reach; a card in the middle from 640 px. Six weeks always, so
            its height and the month buttons stay put while the months change. */}
        <Dialog.Popup
          initialFocus={focusedRef}
          className="fixed inset-x-0 bottom-0 z-50 max-h-dvh overflow-y-auto rounded-t-[calc(var(--radius)+0.25rem)] border-[1.5px] border-b-0 border-outline bg-card text-card-foreground outline-none transition-[translate,opacity] duration-200 max-sm:data-[ending-style]:translate-y-full max-sm:data-[starting-style]:translate-y-full motion-reduce:transition-none sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:mx-auto sm:w-[min(26rem,calc(100%-2rem))] sm:-translate-y-1/2 sm:rounded-[calc(var(--radius)+0.25rem)] sm:border-b-[1.5px] sm:data-[ending-style]:opacity-0 sm:data-[starting-style]:opacity-0"
        >
          <div className="mx-auto grid w-full max-w-sm gap-2 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Dialog.Title className="font-heading text-lg font-semibold">{text.calendarTitle}</Dialog.Title>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="size-11 p-0"
                aria-label={text.previousMonth}
                onClick={() => setFocused(shiftDayByMonths(focused, -1))}
              >
                <PreviousIcon aria-hidden="true" className="size-5" />
              </Button>
              {/* Read out when the month changes, so a screen reader hears where the buttons went. */}
              <p id={monthId} aria-live="polite" className="text-base font-semibold">
                {monthName}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="size-11 p-0"
                aria-label={text.nextMonth}
                onClick={() => setFocused(shiftDayByMonths(focused, 1))}
              >
                <NextIcon aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <table role="grid" aria-labelledby={monthId} className="w-full table-fixed border-collapse" onKeyDown={keyDown}>
              <thead>
                <tr>
                  {weekdays.map((weekday) => (
                    <th
                      key={weekday.long}
                      scope="col"
                      abbr={weekday.long}
                      className="pb-1 text-xs font-medium text-muted-foreground"
                    >
                      {weekday.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthWeeks(month).map((week) => (
                  <tr key={week[0]}>
                    {week.map((day) => {
                      const chosen = day === value;
                      const disabled = min !== undefined && day < min;
                      return (
                        <td
                          key={day}
                          role="gridcell"
                          ref={day === focused ? focusedRef : undefined}
                          tabIndex={day === focused ? 0 : -1}
                          aria-label={dayName(day)}
                          aria-selected={chosen}
                          aria-current={day === today ? 'date' : undefined}
                          aria-disabled={disabled || undefined}
                          onClick={() => pick(day)}
                          className="p-0.5 outline-none [&:focus-visible>span]:ring-3 [&:focus-visible>span]:ring-ring"
                        >
                          {/* 44 px high at least; the columns share the sheet's width (49 px on a 375 px phone). */}
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex min-h-11 cursor-pointer items-center justify-center rounded-full text-sm tabular-nums',
                              monthOf(day) !== month && 'text-muted-foreground',
                              day === today && !chosen && 'border-[1.5px] border-primary',
                              chosen ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
                              // Muted and struck through, still at 4.5:1: a day before the field's earliest.
                              disabled && 'cursor-not-allowed text-muted-foreground line-through hover:bg-transparent',
                            )}
                          >
                            {Number(day.slice(8, 10))}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="link"
                className="px-1"
                disabled={today === null}
                onClick={() => {
                  if (today !== null) setFocused(today);
                }}
              >
                {text.goToToday}
              </Button>
              <Dialog.Close render={<Button type="button" variant="outline" />}>{text.close}</Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
