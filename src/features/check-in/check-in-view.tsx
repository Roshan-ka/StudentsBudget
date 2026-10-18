'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useId } from 'react';
import { db } from '@/db/db';
import type { Account, Entry, Plan } from '@/db/types';
import { categoryName } from '@/features/entries/categories';
import { QuickAddField } from '@/features/entries/quick-add-field';
import { safeToSpend } from '@/lib/budget';
import type { IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { weekLabel } from '@/lib/week-label';
import { weekLine } from './week-line';

const LINK_CLASS = 'inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline';

const weekday = new Intl.DateTimeFormat('en-IE', { weekday: 'short' });
const dayOfMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric' });

/** "Fri 16". `parseISO` reads a date-only string as local midnight, so the day never shifts. */
function dayLabel(date: IsoDate): string {
  const day = parseISO(date);
  return `${weekday.format(day)} ${dayOfMonth.format(day)}`;
}

/** The entries dated from `start` to `end`, newest day first; within a day the entry saved last comes first. */
function entriesOfWeek(entries: Entry[], start: IsoDate, end: IsoDate): Entry[] {
  return entries
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function EntryItem({ entry, accounts }: { entry: Entry; accounts: Account[] }) {
  const currency = accounts.find((a) => a.id === entry.accountId)?.currency ?? 'EUR';
  const label = entry.type === 'transfer' ? 'Transfer' : categoryName(entry.categoryId);
  const details = [entry.note ? label : null, dayLabel(entry.date)].filter((part) => part !== null);

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block font-medium break-words">{entry.note || label}</span>
        <span className="block text-sm text-muted-foreground">{details.join(' · ')}</span>
      </span>
      <span className="shrink-0 font-medium tabular-nums">
        {entry.type === 'income' ? '+' : ''}
        {formatMoney(entry.amountMinor, currency)}
      </span>
    </li>
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
  const planId = useId();
  const weekId = useId();
  const addId = useId();
  const week = safeToSpend(plan, entries, today);
  // Envelopes planned at €0 and not used this week would only add empty rows.
  const rows = week.envelopes.filter((e) => e.weekShareMinor > 0 || e.spentThisWeekMinor > 0);
  const thisWeek = entriesOfWeek(entries, week.weekStart, week.weekEnd);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{weekLabel(week.weekStart, week.weekEnd)}</p>

      <section aria-labelledby={planId} className="flex flex-col gap-3">
        <h3 id={planId} className="text-lg font-semibold">
          This week against your plan
        </h3>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">No envelopes are planned for this week.</p>
        ) : (
          <ul aria-labelledby={planId} className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.categoryId} className="flex flex-col gap-0.5">
                <p className="font-medium break-words">{categoryName(row.categoryId)}</p>
                <p className="text-sm tabular-nums">{weekLine(row)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={weekId} className="flex flex-col gap-2">
        <h3 id={weekId} className="text-lg font-semibold">
          This week
        </h3>
        {thisWeek.length === 0 ? (
          <p className="text-muted-foreground">Nothing logged this week yet.</p>
        ) : (
          <ul aria-labelledby={weekId} className="flex flex-col divide-y">
            {thisWeek.map((entry) => (
              <EntryItem key={entry.id} entry={entry} accounts={accounts} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={addId} className="flex flex-col gap-3">
        <h3 id={addId} className="text-lg font-semibold">
          Forgot something? Add it here
        </h3>
        <QuickAddField />
        <Link href="/entries/new" className={`${LINK_CLASS} self-start`}>
          Add something from an earlier day
        </Link>
      </section>

      {/* A plain link, not <Link>: this is a file, and the browser or the phone's calendar app takes it from here. */}
      <a href="/weekly-check-in.ics" className={`${LINK_CLASS} self-start`}>
        Add weekly reminder to calendar
      </a>
    </div>
  );
}

/**
 * The Sunday look back: this week against the plan, what was logged, and a quick way to add what was
 * forgotten. It reads the whole database and updates by itself when an entry is saved.
 */
export function CheckInView() {
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);

  if (today === null || plan === 'loading' || entries === undefined || accounts === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        Set up your plan to check in on your week.{' '}
        <Link href="/setup" className={LINK_CLASS}>
          Start setup
        </Link>
      </p>
    );
  }
  return <CheckIn plan={plan} entries={entries} accounts={accounts} today={today} />;
}
