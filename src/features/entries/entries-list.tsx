'use client';

import { addMonths, format, parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CATEGORIES } from '@/data/categories';
import { db } from '@/db/db';
import { deleteEntry, entriesInRange } from '@/db/repo';
import type { Account, Entry } from '@/db/types';
import { daysInMonth, firstOfMonth, monthOf, todayIso, type IsoDate, type IsoMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { categoryName } from './categories';
import { EntryForm } from './entry-form';

const MONTH_PARAM = /^\d{4}-(?:0[1-9]|1[0-2])$/;

const LINK_CLASS = 'inline-flex min-h-10 items-center text-primary underline-offset-4 hover:underline';

const dayHeading = new Intl.DateTimeFormat('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
const monthLabel = new Intl.DateTimeFormat('en-IE', { month: 'short', year: 'numeric' });

/** "Friday, 16 October". `parseISO` reads a date-only string as local midnight, so the day never shifts. */
function headingOf(date: IsoDate): string {
  return dayHeading.format(parseISO(date));
}

function labelOf(month: IsoMonth): string {
  return monthLabel.format(parseISO(firstOfMonth(month)));
}

/** The month `by` months after `month` (before, when negative): "2026-12" and 1 give "2027-01". */
function shiftMonth(month: IsoMonth, by: number): IsoMonth {
  return format(addMonths(parseISO(firstOfMonth(month)), by), 'yyyy-MM');
}

/** The list for one month, keeping the category filter when there is one. */
function listHref(month: IsoMonth, category: string | null): string {
  const query = new URLSearchParams({ month });
  if (category !== null) query.set('category', category);
  return `/entries?${query.toString()}`;
}

/** Newest day first; within a day the entry saved last comes first. */
function groupByDate(entries: Entry[]): { date: IsoDate; entries: Entry[] }[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const groups: { date: IsoDate; entries: Entry[] }[] = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    if (last?.date === entry.date) last.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
  }
  return groups;
}

function EntryRow({ entry, accounts, onOpen }: { entry: Entry; accounts: Account[]; onOpen: () => void }) {
  const accountName = (accountId: string) => accounts.find((a) => a.id === accountId)?.name ?? 'Unknown account';
  const currency = accounts.find((a) => a.id === entry.accountId)?.currency ?? 'EUR';

  const label = entry.type === 'transfer' ? 'Transfer' : categoryName(entry.categoryId);
  const title = entry.note || label;
  const details = [
    entry.note ? label : null,
    entry.type === 'transfer' ? `${accountName(entry.accountId)} → ${accountName(entry.toAccountId)}` : null,
  ].filter((part) => part !== null);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block font-medium break-words">{title}</span>
        {details.length > 0 && <span className="block text-sm text-muted-foreground">{details.join(' · ')}</span>}
      </span>
      <span className="shrink-0 font-medium tabular-nums">
        {entry.type === 'income' ? '+' : ''}
        {formatMoney(entry.amountMinor, currency)}
      </span>
    </button>
  );
}

/** The edit form for one entry, with Delete behind a yes-or-cancel question. */
function EditPanel({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    try {
      await deleteEntry(entry.id);
    } catch (deleteError) {
      console.error('StudentsBudget: could not delete the entry', deleteError);
      setError('Could not delete the entry.');
      return;
    }
    onClose();
  }

  return (
    <section aria-label="Edit entry" className="my-2 flex flex-col gap-4 rounded-lg border p-4">
      <h3 className="text-lg font-semibold">Edit entry</h3>
      <EntryForm entry={entry} onSaved={onClose} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {confirming ? (
        <div role="group" aria-label="Delete this entry?" className="flex flex-wrap items-center gap-2">
          <p className="mr-auto font-medium">Delete this entry?</p>
          <Button variant="destructive" className="h-10 px-4" onClick={() => void remove()}>
            Yes
          </Button>
          <Button variant="outline" className="h-10 px-4" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 px-4" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" className="h-10 px-4" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * The entries of one month, newest day first. `?month=2026-10` picks the month (the current one without it)
 * and `?category=eating-out` keeps one category. Tapping an entry opens its edit form in place.
 * Reads the search params, so it has to render inside <Suspense>.
 */
export function EntriesList() {
  const params = useSearchParams();
  const monthParam = params.get('month');
  const categoryParam = params.get('category');
  const month = monthParam !== null && MONTH_PARAM.test(monthParam) ? monthParam : null;
  const category = categoryParam !== null && CATEGORIES.some((c) => c.id === categoryParam) ? categoryParam : null;

  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  // The current month is read inside the query, not while rendering.
  const loaded = useLiveQuery(async () => {
    const thisMonth = monthOf(todayIso());
    const shown = month ?? thisMonth;
    return {
      month: shown,
      thisMonth,
      entries: await entriesInRange(firstOfMonth(shown), `${shown}-${daysInMonth(shown)}`),
    };
  }, [month]);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (accounts === undefined || loaded === undefined) return null;

  const entries = loaded.entries.filter((e) => category === null || (e.type !== 'transfer' && e.categoryId === category));
  // Clear goes back to the current month with no category, so it is only worth showing when that is a change.
  const filtered = category !== null || loaded.month !== loaded.thisMonth;
  const summary = [category === null ? null : categoryName(category), labelOf(loaded.month)].filter((p) => p !== null);

  return (
    <section aria-label="Entries" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm text-muted-foreground">
        <p className="flex flex-wrap items-center gap-x-2">
          <span>{summary.join(' · ')}</span>
          {filtered && (
            <>
              <span aria-hidden="true">{' · '}</span>
              <Link href="/entries" className={LINK_CLASS}>
                Clear
              </Link>
            </>
          )}
        </p>
        <nav aria-label="Month" className="flex items-center gap-4">
          <Link href={listHref(shiftMonth(loaded.month, -1), category)} className={LINK_CLASS}>
            ‹ Previous
          </Link>
          <Link href={listHref(shiftMonth(loaded.month, 1), category)} className={LINK_CLASS}>
            Next ›
          </Link>
        </nav>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground">Nothing logged here yet.</p>
      ) : (
        groupByDate(entries).map((group) => (
          <div key={group.date} className="flex flex-col">
            <h3 className="text-sm font-medium text-muted-foreground">{headingOf(group.date)}</h3>
            <ul className="flex flex-col divide-y">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  {editingId === entry.id ? (
                    <EditPanel entry={entry} onClose={() => setEditingId(null)} />
                  ) : (
                    <EntryRow entry={entry} accounts={accounts} onOpen={() => setEditingId(entry.id)} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
