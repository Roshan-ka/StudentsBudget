'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useId } from 'react';
import { db } from '@/db/db';
import type { Account, Entry, Plan } from '@/db/types';
import { setAway, weekAwaitingRecord } from '@/features/badges/week-results';
import { entryTitle } from '@/features/entries/entry-title';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { RecurringTag, isRecurring } from '@/features/entries/recurring-tag';
import { SwapLine } from '@/features/swaps/swap-line';
import { categoryNameIn } from '@/i18n/category-name';
import { dateFormat } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { weekToSpend } from '@/lib/budget';
import { previousMonthTail, weekOf, type IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { weekLabel } from '@/lib/week-label';
import { notCountedNote } from './not-counted';
import { weekLine, weekTotalLine } from './week-line';
import { weekRows } from './week-rows';
import { weekSwaps } from './week-swaps';

const LINK_CLASS = 'inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline';

/**
 * "Fri 16", or another locale's own short day ("Fr., 16."). English stays built from its two parts, as weekLabel's
 * does, so it reads the same in every browser engine. `parseISO` reads a date-only string as local midnight, so the
 * day never shifts.
 */
function dayLabel(date: IsoDate, locale: string): string {
  const day = parseISO(date);
  if (locale !== 'en-IE') return dateFormat(locale, { weekday: 'short', day: 'numeric' }).format(day);
  return `${dateFormat(locale, { weekday: 'short' }).format(day)} ${dateFormat(locale, { day: 'numeric' }).format(day)}`;
}

/** The entries dated from `start` to `end`, newest day first; within a day the entry saved last comes first. */
function entriesOfWeek(entries: Entry[], start: IsoDate, end: IsoDate): Entry[] {
  return entries
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function EntryItem({ entry, accounts, planStart }: { entry: Entry; accounts: Account[]; planStart: IsoDate }) {
  const { t, lang, locale } = useT();
  const currency = accounts.find((a) => a.id === entry.accountId)?.currency ?? 'EUR';
  const { title, label } = entryTitle(entry, t);
  const details = [label, dayLabel(entry.date, locale)].filter((part) => part !== null);
  const notCounted = notCountedNote(entry, planStart, lang);

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block">
          <span className="font-medium break-words">{title}</span>
          {isRecurring(entry) && <RecurringTag className="ms-2 align-middle" />}
        </span>
        <span className="block text-sm text-muted-foreground">{details.join(' · ')}</span>
        {notCounted !== null && <span className="block text-sm text-muted-foreground">{notCounted}</span>}
      </span>
      <span className="shrink-0 font-medium tabular-nums">
        {entry.type === 'income' ? '+' : ''}
        {formatMoney(entry.amountMinor, currency, { locale })}
      </span>
    </li>
  );
}

/**
 * What the two sections of one part of the week are called: `this` week, or `earlier` (the days of the week that
 * fall in the previous month, on the Sunday the new month starts).
 */
type Part = 'this' | 'earlier';

/**
 * One part of a week, as `weekToSpend` cuts it at the month's edge: its range, each envelope against the
 * part's share of the plan, and what was logged in it. `day` is any day of the part, which also picks the
 * month whose budget it is measured against. `withTotal` adds the week's total, the number Home shows as "This
 * week", to the part that is today's.
 */
function WeekPart({
  plan,
  entries,
  accounts,
  day,
  part,
  withTotal,
}: {
  plan: Plan;
  entries: Entry[];
  accounts: Account[];
  day: IsoDate;
  part: Part;
  withTotal: boolean;
}) {
  const planId = useId();
  const weekId = useId();
  const { t, lang, locale } = useT();
  const titles = part === 'this' ? t.checkIn.thisWeek : t.checkIn.earlierThisWeek;
  const week = weekToSpend(plan, entries, day);
  // Every envelope with a monthly amount is listed, even one that is used up and so has no share of the week; an
  // envelope at €0 and a category with no envelope only when something was spent on it this week.
  const rows = weekRows(plan, week.envelopes);
  // A swap is judged by the check-in's own measure: only a row over this week's share of the plan ("€12 over") gets
  // one. The month's early warning is Home's.
  const suggestions = weekSwaps(rows, day);
  const thisWeek = entriesOfWeek(entries, week.weekStart, week.weekEnd);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{weekLabel(week.weekStart, week.weekEnd, locale)}</p>

      <section aria-labelledby={planId} className="flex flex-col gap-3">
        <h3 id={planId} className="text-lg font-semibold">
          {titles.against}
        </h3>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{t.checkIn.noEnvelopes}</p>
        ) : (
          <>
            {withTotal && <p className="font-medium tabular-nums">{weekTotalLine(week.totalMinor, lang)}</p>}
            <ul aria-labelledby={planId} className="flex flex-col gap-3">
              {rows.map((row) => {
                const suggestion = suggestions.get(row.categoryId);
                return (
                  <li key={row.categoryId} className="flex flex-col gap-0.5">
                    <p className="font-medium break-words">{categoryNameIn(t, row.categoryId)}</p>
                    <p className="text-sm tabular-nums">{weekLine(row, row.usedUp, lang)}</p>
                    {suggestion !== undefined && <SwapLine suggestion={suggestion} />}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby={weekId} className="flex flex-col gap-2">
        <h3 id={weekId} className="text-lg font-semibold">
          {titles.logged}
        </h3>
        {thisWeek.length === 0 ? (
          <p className="text-muted-foreground">{titles.empty}</p>
        ) : (
          <ul aria-labelledby={weekId} className="flex flex-col divide-y">
            {thisWeek.map((entry) => (
              <EntryItem key={entry.id} entry={entry} accounts={accounts} planStart={plan.createdOn} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One "I was away" switch, for the whole Monday–Sunday week of `day`. It is read from and saved to the database, so
 * it survives a reload and the page coming back from hidden; the week keeps it when it is recorded. A switch, not a
 * checkbox: a checkbox would flick back for a moment before the database answers.
 */
function AwaySwitch({ day, label, hintId }: { day: IsoDate; label: string; hintId: string }) {
  const { start } = weekOf(day);
  // null until read; a week with no row yet is not away.
  const away = useLiveQuery(() => db.weekResults.get(start).then((row) => row?.paused === true), [start], null);

  const toggle = () => {
    if (away === null) return;
    setAway(day, !away).catch((error: unknown) => console.error(`StudentsBudget: could not save "${label}"`, error));
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={away === true}
      aria-describedby={hintId}
      disabled={away === null}
      onClick={toggle}
      className="flex min-h-11 items-center gap-3 self-start rounded-md text-start font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors',
          away ? 'bg-primary' : 'bg-muted-foreground/80',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 start-0.5 size-5 rounded-full bg-background shadow-sm transition-transform',
            away && 'translate-x-4 rtl:-translate-x-4',
          )}
        />
      </span>
      {label}
    </button>
  );
}

/**
 * "I was away this week", and on the Monday and the Tuesday also "I was away last week", for the week that waits to
 * be recorded until the Wednesday: someone who was away all week often opens the app only after it. One hint
 * describes both.
 */
function AwayToggle({ plan, today }: { plan: Plan; today: IsoDate }) {
  const hintId = useId();
  const { t } = useT();
  const text = t.checkIn.away;
  const lastWeek = weekAwaitingRecord(plan, today);

  return (
    <div className="flex flex-col gap-1">
      {lastWeek !== null && <AwaySwitch day={lastWeek.start} label={text.lastWeek} hintId={hintId} />}
      <AwaySwitch day={today} label={text.thisWeek} hintId={hintId} />
      <p id={hintId} className="text-sm text-muted-foreground">
        {text.hint}
      </p>
    </div>
  );
}

function CheckIn({
  plan,
  entries,
  accounts,
  today,
}: {
  plan: Plan;
  entries: Entry[];
  accounts: Account[];
  today: IsoDate;
}) {
  const addId = useId();
  const { t } = useT();
  // On the Sunday a month starts mid-week, the week's days in the previous month would otherwise never be
  // reviewed. They come first, measured against that month's budget, with its last day standing in for today.
  // A month before the plan was set up has no budget, so a tail that ends before the setup day is left out.
  const tail = previousMonthTail(today);
  const earlierDay = tail !== null && tail.end >= plan.createdOn ? tail.end : null;

  return (
    <div className="flex flex-col gap-6">
      {earlierDay !== null && (
        <WeekPart
          plan={plan}
          entries={entries}
          accounts={accounts}
          day={earlierDay}
          part="earlier"
          withTotal={false}
        />
      )}
      <WeekPart plan={plan} entries={entries} accounts={accounts} day={today} part="this" withTotal />
      <AwayToggle plan={plan} today={today} />

      <section aria-labelledby={addId} className="flex flex-col gap-3">
        <h3 id={addId} className="text-lg font-semibold">
          {t.checkIn.add.heading}
        </h3>
        <QuickAddField />
        <Link href="/entries/new" className={`${LINK_CLASS} self-start`}>
          {t.checkIn.add.earlier}
        </Link>
      </section>

      {/* A plain link, not <Link>: this is a file, and the browser or the phone's calendar app takes it from here. */}
      <a href="/weekly-check-in.ics" className={`${LINK_CLASS} self-start`}>
        {t.checkIn.reminder}
      </a>
    </div>
  );
}

/**
 * The Sunday look back: this week against the plan, what was logged, and a quick way to add what was
 * forgotten. It reads the whole database and updates by itself when an entry is saved.
 */
export function CheckInView() {
  const { t } = useT();
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);

  if (today === null || plan === 'loading' || entries === undefined || accounts === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        {t.checkIn.noPlan}{' '}
        <Link href="/setup" className={LINK_CLASS}>
          {t.checkIn.startSetup}
        </Link>
      </p>
    );
  }
  return <CheckIn plan={plan} entries={entries} accounts={accounts} today={today} />;
}
