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
import { addDays, monthOf, todayIso, type IsoDate, type IsoMonth } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { isCalendarKey, monthWeeks, movedDay, sameDayIn, shiftDayByMonths, yearPage } from './date-input';

/** A Monday, to name the weekdays from: Monday 2 November 2026 and the six days after it. */
const A_MONDAY = '2026-11-02';

/** What the sheet shows below its header: the month's days, or the list to pick a month or a year from. */
type View = 'days' | 'months' | 'years';

/** The twelve months of a year, as `IsoMonth`s. */
function monthsOf(year: string): IsoMonth[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

/**
 * A cell of the calendar, a day, a month or a year, in its look: round, no border, this one (today, this month,
 * this year) ringed in cobalt, the chosen one filled, one outside the shown month muted, one before `min` struck through.
 */
function cellClass({ now, chosen, muted, disabled }: { now: boolean; chosen: boolean; muted?: boolean; disabled: boolean }) {
  return cn(
    'flex cursor-pointer items-center justify-center rounded-full text-sm tabular-nums',
    muted && 'text-muted-foreground',
    now && !chosen && 'border-[1.5px] border-primary',
    chosen ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
    // Muted and struck through, still at 4.5:1: before the field's earliest.
    disabled && 'cursor-not-allowed text-muted-foreground line-through hover:bg-transparent',
  );
}

/**
 * The date field's calendar (docs/superpowers/plans/2026-11-06-date-field.md, chunk 3): the button at the end of the
 * field, and the month it opens as a sheet from the bottom (a card in the middle on a wider screen). It follows the
 * date-picker dialog of the WAI-ARIA practices: a grid of six Monday–Sunday weeks, the arrow keys, Home and End,
 * Page Up and Page Down (a year with Shift) move the focus, Enter or Space picks, Escape closes, and closing hands the
 * focus back to the button. It opens on `value`, or on today without one. Days before `min` show but can't be picked.
 * Above the days, the month and the year are two outlined buttons (chunk 5, Roshan's mockups of 09-11-2026): each
 * swaps the days for its list, twelve months or twelve years in the days' look, and picking one brings the days back;
 * Escape in a list goes back to the days, and only then closes the sheet.
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
  // The day the grid is built around. Opening sets it (the date, or today); before that, with no date yet (an empty
  // semester field), a fixed Monday stands in, since a month can't be worked out from '' (formatting it throws).
  const [focused, setFocused] = useState<IsoDate>(value || A_MONDAY);
  const [view, setView] = useState<View>('days');
  const [yearsPage, setYearsPage] = useState(0);
  const focusedRef = useRef<HTMLTableCellElement>(null);
  // Only a key, or a month or year picked from a list, moves the focus to the day; the arrow buttons keep it, as the
  // practices ask.
  const keyMoved = useRef(false);

  useEffect(() => {
    if (!keyMoved.current || view !== 'days') return;
    keyMoved.current = false;
    focusedRef.current?.focus();
  }, [focused, view]);

  function openChange(next: boolean, details: Dialog.Root.ChangeEventDetails) {
    // Escape in a list goes back to the days first.
    if (!next && details.reason === 'escape-key' && view !== 'days') {
      details.cancel();
      setView('days');
      return;
    }
    if (next) {
      setFocused(value || today || todayIso());
      setView('days');
    }
    setOpen(next);
  }

  /** Opens a list, or goes back to the days when it is already open. */
  function toggle(list: 'months' | 'years') {
    setYearsPage(0);
    setView(view === list ? 'days' : list);
  }

  /** Shows the days of `month`, with the focus on the same day number there. */
  function showMonth(month: IsoMonth) {
    keyMoved.current = true;
    setFocused(sameDayIn(focused, month));
    setView('days');
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
  const year = month.slice(0, 4);
  const monthOn = (isoMonth: IsoMonth, options: Intl.DateTimeFormatOptions) =>
    dateFormat(locale, options).format(parseISO(`${isoMonth}-01`));
  const monthName = monthOn(month, { month: 'long', year: 'numeric' });
  const thisMonth = today === null ? null : monthOf(today);
  const thisYear = thisMonth === null ? null : thisMonth.slice(0, 4);
  const earliestMonth = min === undefined ? undefined : monthOf(min);
  const weekdays = Array.from({ length: 7 }, (_, index) => addDays(A_MONDAY, index)).map((day) => ({
      short: dateFormat(locale, { weekday: 'short' }).format(parseISO(day)),
      long: dateFormat(locale, { weekday: 'long' }).format(parseISO(day)),
    }));
  // A day's name is the language's long date ("Thursday 1 October 2026", "Donnerstag, 1. Oktober 2026"): it holds the
  // number the cell shows, which a name must (WCAG 2.5.3, axe's label-content-name-mismatch), and reads better aloud
  // than 01.10.2026. Nothing shows it, so the region's form doesn't apply.
  const dayName = (day: IsoDate) =>
    dateFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(day));
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
            {/* Read out when the month changes, so a screen reader hears where the buttons went; it names the grid. */}
            <p id={monthId} aria-live="polite" className="sr-only">
              {monthName}
            </p>
            <div className="flex items-center justify-between gap-2">
              {/* The arrows step a month by the days, twelve years by the years, and stand aside for the months. */}
              {view === 'months' ? (
                <span aria-hidden="true" className="size-11 shrink-0" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 shrink-0 p-0"
                  aria-label={view === 'years' ? text.earlierYears : text.previousMonth}
                  onClick={() =>
                    view === 'years' ? setYearsPage(yearsPage - 1) : setFocused(shiftDayByMonths(focused, -1))
                  }
                >
                  <PreviousIcon aria-hidden="true" className="size-5" />
                </Button>
              )}
              {/* Two sections, the month and the year, each outlined and with no arrow (Roshan, 09-11-2026). */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span id={`${monthId}-month`} className="sr-only">
                  {text.chooseMonth}
                </span>
                <Button
                  type="button"
                  variant="chip"
                  aria-expanded={view === 'months'}
                  aria-describedby={`${monthId}-month`}
                  className="aria-expanded:border-foreground aria-expanded:bg-foreground aria-expanded:text-background"
                  onClick={() => toggle('months')}
                >
                  {monthOn(month, { month: 'long' })}
                </Button>
                <span id={`${monthId}-year`} className="sr-only">
                  {text.chooseYear}
                </span>
                <Button
                  type="button"
                  variant="chip"
                  aria-expanded={view === 'years'}
                  aria-describedby={`${monthId}-year`}
                  className="tabular-nums aria-expanded:border-foreground aria-expanded:bg-foreground aria-expanded:text-background"
                  onClick={() => toggle('years')}
                >
                  {year}
                </Button>
              </div>
              {view === 'months' ? (
                <span aria-hidden="true" className="size-11 shrink-0" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 shrink-0 p-0"
                  aria-label={view === 'years' ? text.laterYears : text.nextMonth}
                  onClick={() =>
                    view === 'years' ? setYearsPage(yearsPage + 1) : setFocused(shiftDayByMonths(focused, 1))
                  }
                >
                  <NextIcon aria-hidden="true" className="size-5" />
                </Button>
              )}
            </div>
            {/* The days' height, whichever list is up, so the sheet and its header stay put. */}
            <div className="min-h-[19.25rem]">
              {view === 'months' && (
                <div role="group" aria-label={text.chooseMonth} className="grid grid-cols-3 gap-1 pt-2">
                  {monthsOf(year).map((isoMonth) => {
                    const disabled = earliestMonth !== undefined && isoMonth < earliestMonth;
                    return (
                      <button
                        key={isoMonth}
                        type="button"
                        // The full name, which holds the short one the cell shows ("November", "Nov").
                        aria-label={monthOn(isoMonth, { month: 'long' })}
                        aria-pressed={isoMonth === month}
                        aria-current={isoMonth === thisMonth ? 'date' : undefined}
                        aria-disabled={disabled || undefined}
                        onClick={() => {
                          if (!disabled) showMonth(isoMonth);
                        }}
                        className={cn(
                          'min-h-14 outline-none focus-visible:ring-3 focus-visible:ring-ring',
                          cellClass({ now: isoMonth === thisMonth, chosen: isoMonth === month, disabled }),
                        )}
                      >
                        {monthOn(isoMonth, { month: 'short' })}
                      </button>
                    );
                  })}
                </div>
              )}
              {view === 'years' && (
                <div role="group" aria-label={text.chooseYear} className="grid grid-cols-3 gap-1 pt-2">
                  {yearPage(Number(year), yearsPage).map((shownYear) => {
                    const isoYear = String(shownYear);
                    const disabled = earliestMonth !== undefined && isoYear < earliestMonth.slice(0, 4);
                    return (
                      <button
                        key={isoYear}
                        type="button"
                        aria-pressed={isoYear === year}
                        aria-current={isoYear === thisYear ? 'date' : undefined}
                        aria-disabled={disabled || undefined}
                        onClick={() => {
                          if (!disabled) showMonth(`${isoYear}-${month.slice(5, 7)}`);
                        }}
                        className={cn(
                          'min-h-14 outline-none focus-visible:ring-3 focus-visible:ring-ring',
                          cellClass({ now: isoYear === thisYear, chosen: isoYear === year, disabled }),
                        )}
                      >
                        {isoYear}
                      </button>
                    );
                  })}
                </div>
              )}
              {view === 'days' && (
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
                                  'min-h-11',
                                  cellClass({ now: day === today, chosen, muted: monthOf(day) !== month, disabled }),
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
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="link"
                className="px-1"
                disabled={today === null}
                onClick={() => {
                  if (today === null) return;
                  setFocused(today);
                  setView('days');
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
