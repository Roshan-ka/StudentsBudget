'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BellIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  ClipboardListIcon,
  NotebookPenIcon,
  PlaneIcon,
  PlusIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { LinkButton, linkButtonClass } from '@/components/link-button';
import { PageHeading } from '@/components/page-heading';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import type { Account, Entry, Plan, PlanMonth } from '@/db/types';
import { setAway, weekAwaitingRecord } from '@/features/badges/week-results';
import { categoryTint } from '@/features/charts/colors';
import { entryTitle } from '@/features/entries/entry-title';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { EnvelopeCard } from '@/features/home/envelope-card';
import { percentUsed } from '@/features/home/percent-used';
import { EmptyCard, RowTile } from '@/features/home/row-card';
import { remindersInBuild } from '@/features/reminder/reminder';
import { RecurringTag, isRecurring } from '@/features/entries/recurring-tag';
import { SwapLine } from '@/features/swaps/swap-line';
import { categoryNameIn } from '@/i18n/category-name';
import { dateFormat } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { weekToSpend, type WeekToSpend } from '@/lib/budget';
import { monthOf, previousMonthTail, weekOf, type IsoDate } from '@/lib/dates';
import { planForMonth } from '@/lib/plan-history';
import { formatMoney, type Minor } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { formatWeekAmount } from '@/lib/week-amount';
import { weekLabel } from '@/lib/week-label';
import { calendarFileOf } from './calendar-file';
import { weekLine } from './week-line';
import { weekRows } from './week-rows';
import { weekSwaps } from './week-swaps';

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

function EntryItem({ entry, accounts }: { entry: Entry; accounts: Account[] }) {
  const { t, locale } = useT();
  const currency = accounts.find((a) => a.id === entry.accountId)?.currency ?? 'EUR';
  const { title, label } = entryTitle(entry, t);
  const details = [label, dayLabel(entry.date, locale)].filter((part) => part !== null);

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block">
          <span className="font-medium break-words">{title}</span>
          {isRecurring(entry) && <RecurringTag className="ms-2 align-middle" />}
        </span>
        <span className="block text-sm text-muted-foreground">{details.join(' · ')}</span>
      </span>
      <span className="shrink-0 font-medium tabular-nums">
        {entry.type === 'income' ? '+' : ''}
        {formatMoney(entry.amountMinor, currency, { locale })}
      </span>
    </li>
  );
}

/** A week's days as a small muted line with a calendar icon, as Home's date line over the greeting (16-11-2026). */
function DateLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      <CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </p>
  );
}

/** A check-in card's heading: its tile and its words on one line, as Home's cards have them (16-11-2026). */
function CardHeading({
  id,
  icon,
  tint,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <RowTile icon={icon} tint={tint} />
      <h3 id={id} className="min-w-0 text-lg leading-tight font-extrabold break-words">
        {children}
      </h3>
    </div>
  );
}

/**
 * The week in one number, in the yellow accent card (Roshan's mockups, 16-11-2026): what is safe to spend this week,
 * the number Home shows as "This week", a bar of how much of the week's money has gone, and what was spent so far.
 * Over, it says so in the same colours with the bar full, as Home's card does. `totalMinor` is `weekToSpend`'s total
 * and `spentMinor` what its envelopes spent this week, so the week had the two together when it began.
 */
function WeekCard({ totalMinor, spentMinor }: { totalMinor: Minor; spentMinor: Minor }) {
  const { t, locale } = useT();
  const text = t.checkIn.week;
  const total = formatWeekAmount(totalMinor, locale);
  const spent = text.spent(formatWeekAmount(spentMinor, locale).text);
  const words = total.over ? text.over : text.safe;
  const percent = total.over ? 100 : percentUsed(totalMinor + spentMinor, spentMinor);

  return (
    <div className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
      <p className="text-sm font-semibold">{t.checkIn.thisWeek.logged}</p>
      {/* One line of text, however it wraps, so "€139 safe to spend" and "€9 over this week" each read as one. The
          amount sits where the language puts it. */}
      <p className="min-w-0 tabular-nums break-words">
        {words.before && <span className="text-xl font-semibold">{words.before}</span>}
        <span className="font-heading text-5xl leading-none font-extrabold tracking-tight">{total.text}</span>
        <span className="text-xl font-semibold">{words.after}</span>
      </p>
      {/* The bar stops at full, so what was spent is in its value text, and in the line under it. Its colours are
          those of Home's ring, on the same card. */}
      <div
        role="progressbar"
        aria-label={text.bar}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={spent}
        className="h-2.5 overflow-hidden rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-primary motion-safe:animate-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      {/* A screen reader gets it from the bar's value text instead. */}
      <p aria-hidden="true" className="text-sm font-semibold tabular-nums">
        {spent}
      </p>
    </div>
  );
}

/**
 * What the two sections of one part of the week are called: `this` week, or `earlier` (the days of the week that
 * fall in the previous month, on the Sunday the new month starts).
 */
type Part = 'this' | 'earlier';

/**
 * One part of a week, as `weekToSpend` cut it at the month's edge (`week`): each envelope against the part's share of
 * the plan, as Home's envelope cards, and what was logged in it. `day` is any day of the part, which also picks the
 * month whose budget it is measured against. The earlier part says which days it covers; this week's are the page's
 * date line.
 */
function WeekPart({
  children,
  plan,
  week,
  entries,
  accounts,
  day,
  part,
}: {
  plan: Plan;
  week: WeekToSpend;
  entries: Entry[];
  accounts: Account[];
  day: IsoDate;
  part: Part;
  /** Shown between the envelopes and what was logged (the check-in's add card). */
  children?: ReactNode;
}) {
  const envelopesId = useId();
  const loggedId = useId();
  const { t, lang, locale } = useT();
  const titles = part === 'this' ? t.checkIn.thisWeek : t.checkIn.earlierThisWeek;
  // Every envelope with a monthly amount is listed, even one that is used up and so has no share of the week; an
  // envelope at €0 and a category with no envelope only when something was spent on it this week.
  const rows = weekRows(plan, week.envelopes);
  // A swap is judged by the check-in's own measure: only a row over this week's share of the plan ("€12 over") gets
  // one. The month's early warning is Home's.
  const suggestions = weekSwaps(rows, day);
  const logged = entriesOfWeek(entries, week.weekStart, week.weekEnd);

  return (
    <>
      {/* A heading, then one tinted card per envelope, as Home's envelopes (16-11-2026). */}
      <section aria-labelledby={envelopesId} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={envelopesId} className="text-[22px] leading-tight font-extrabold break-words">
            {titles.envelopes}
          </h3>
          {part === 'earlier' && <DateLine>{weekLabel(week.weekStart, week.weekEnd, locale)}</DateLine>}
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{t.checkIn.noEnvelopes}</p>
        ) : (
          <ul aria-labelledby={envelopesId} className="flex flex-col gap-3">
            {rows.map((row) => {
              const name = categoryNameIn(t, row.categoryId);
              const suggestion = suggestions.get(row.categoryId);
              return (
                <EnvelopeCard
                  key={row.categoryId}
                  categoryId={row.categoryId}
                  name={name}
                  // An envelope with nothing left of its month has no share to fill: nothing of it is left, so full.
                  percent={row.usedUp ? 100 : percentUsed(row.weekShareMinor, row.spentThisWeekMinor)}
                  barLabel={titles.bar(name)}
                  line={weekLine(row, row.usedUp, lang)}
                >
                  {suggestion !== undefined && <SwapLine suggestion={suggestion} />}
                </EnvelopeCard>
              );
            })}
          </ul>
        )}
      </section>

      {children}

      <section aria-labelledby={loggedId} className={cardVariants()}>
        <CardHeading id={loggedId} icon={ReceiptTextIcon} tint={categoryTint('rent')}>
          {titles.logged}
        </CardHeading>
        {logged.length === 0 ? (
          <p className="text-muted-foreground">{titles.empty}</p>
        ) : (
          <ul aria-labelledby={loggedId} className="flex flex-col divide-y">
            {logged.map((entry) => (
              <EntryItem key={entry.id} entry={entry} accounts={accounts} />
            ))}
          </ul>
        )}
      </section>
    </>
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
      className="flex min-h-11 items-center gap-3 self-start rounded-md text-start font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-50"
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
 * describes both. Its own card, with a tile (16-11-2026).
 */
function AwayToggle({ plan, today }: { plan: Plan; today: IsoDate }) {
  const hintId = useId();
  const { t } = useT();
  const text = t.checkIn.away;
  const lastWeek = weekAwaitingRecord(plan, today);

  return (
    <div className={cn(cardVariants(), 'flex-row items-start gap-3')}>
      <RowTile icon={PlaneIcon} tint={categoryTint('travel')} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {lastWeek !== null && <AwaySwitch day={lastWeek.start} label={text.lastWeek} hintId={hintId} />}
        <AwaySwitch day={today} label={text.thisWeek} hintId={hintId} />
        <p id={hintId} className="text-sm text-muted-foreground">
          {text.hint}
        </p>
      </div>
    </div>
  );
}

/** The ways to be reminded of the check-in, in one card with a tile (16-11-2026). */
function ReminderCard() {
  const { t, lang } = useT();

  return (
    <div className={cn(cardVariants(), 'flex-row items-start gap-3')}>
      <RowTile icon={BellIcon} tint="var(--accent)" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* A plain link, not <Link>: this is a file, and the browser or the phone's calendar app takes it from here. In
            the button look, as every way on (16-11-2026: buttons, never text links). */}
        <a href={calendarFileOf(lang)} className={linkButtonClass()}>
          <CalendarPlusIcon aria-hidden="true" />
          {t.checkIn.reminder}
        </a>
        {/* The other way to be reminded (weekly reminder, chunk 4): the two point to each other, so nobody gets both.
            The sentence, then its button. */}
        {remindersInBuild() && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{t.checkIn.reminderOr}</p>
            <LinkButton href="/settings/reminder" icon={BellIcon}>
              {t.checkIn.reminderOrLink}
            </LinkButton>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIn({
  plan,
  planMonths,
  entries,
  accounts,
  today,
  week,
}: {
  plan: Plan;
  planMonths: PlanMonth[];
  entries: Entry[];
  accounts: Account[];
  today: IsoDate;
  /** This week's part, `weekToSpend` on today. */
  week: WeekToSpend;
}) {
  const addId = useId();
  const { t } = useT();
  // On the Sunday a month starts mid-week, the week's days in the previous month would otherwise never be
  // reviewed. They come first, measured against that month's budget, with its last day standing in for today.
  // A month before the setup month has no budget, so its tail is left out (the tail is a month's last days, so ending
  // before the setup day means it is in an earlier month).
  const tail = previousMonthTail(today);
  const earlierDay = tail !== null && tail.end >= plan.createdOn ? tail.end : null;
  // Last month's days against the plan last month had (plan history).
  const earlierPlan = earlierDay === null ? null : planForMonth(plan, planMonths, monthOf(earlierDay), today);
  // What the week's envelopes spent, the rows weekToSpend's total is worked out from.
  const spentMinor = week.envelopes.reduce((sum, envelope) => sum + envelope.spentThisWeekMinor, 0);

  return (
    <>
      {/* The key number first, on the tail's Sunday too; with no envelope to measure there is none. */}
      {weekRows(plan, week.envelopes).length > 0 && <WeekCard totalMinor={week.totalMinor} spentMinor={spentMinor} />}
      {earlierDay !== null && earlierPlan !== null && (
        <WeekPart
          plan={earlierPlan}
          week={weekToSpend(earlierPlan, entries, earlierDay)}
          entries={entries}
          accounts={accounts}
          day={earlierDay}
          part="earlier"
        />
      )}
      {/* What was forgotten is added right under the week's envelopes, before the list of what was logged (pain
          points, chunk 8). */}
      <WeekPart plan={plan} week={week} entries={entries} accounts={accounts} day={today} part="this">
        <section aria-labelledby={addId} className={cardVariants()}>
          <CardHeading id={addId} icon={NotebookPenIcon} tint={categoryTint('food')}>
            {t.checkIn.add.heading}
          </CardHeading>
          <QuickAddField />
          {/* Saving brings the person back here, to the check-in they were in. */}
          <LinkButton href="/entries/new?from=check-in" icon={PlusIcon}>
            {t.checkIn.add.earlier}
          </LinkButton>
        </section>
      </WeekPart>
      <AwayToggle plan={plan} today={today} />
      <ReminderCard />
    </>
  );
}

/**
 * The Sunday look back: the week in one number, each envelope against this week, a quick way to add what was
 * forgotten, and what was logged. It reads the whole database and updates by itself when an entry is saved. It holds
 * the page's heading, so the week's days can sit over it.
 */
export function CheckInView() {
  const { t, locale } = useT();
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const planMonths = useLiveQuery(() => db.planMonths.toArray(), []);

  let dates: string | null = null;
  let content: ReactNode = null;
  if (today !== null && plan !== 'loading' && entries !== undefined && accounts !== undefined && planMonths !== undefined) {
    if (plan === null) {
      content = (
        <EmptyCard
          icon={CalendarDaysIcon}
          title={t.common.noPlanYet}
          action={
            <LinkButton href="/setup" icon={ClipboardListIcon}>
              {t.common.toSetup}
            </LinkButton>
          }
        >
          {t.checkIn.noPlan}
        </EmptyCard>
      );
    } else {
      const week = weekToSpend(plan, entries, today);
      dates = weekLabel(week.weekStart, week.weekEnd, locale);
      content = (
        <CheckIn plan={plan} planMonths={planMonths} entries={entries} accounts={accounts} today={today} week={week} />
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The week's days over the heading, as Home's date line is over the greeting (16-11-2026). The heading stays
          first in the page and always there, so the focus a page change moves to it stays put while the data loads,
          and the days are read right after it. */}
      <div className="flex flex-col-reverse gap-1">
        <PageHeading id="checkIn" />
        {dates !== null && <DateLine>{dates}</DateLine>}
      </div>
      {content}
    </div>
  );
}
