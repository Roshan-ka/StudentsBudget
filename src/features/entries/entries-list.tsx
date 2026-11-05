'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { CATEGORIES } from '@/data/categories';
import { db } from '@/db/db';
import { deleteEntry, entriesInRange } from '@/db/repo';
import type { Account, Entry } from '@/db/types';
import { categoryTint } from '@/features/charts/colors';
import { categoryNameIn } from '@/i18n/category-name';
import { dateFormat } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { daysInMonth, firstOfMonth, monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS, OTHER_ICON } from './category-icons';
import { EntryForm } from './entry-form';
import { entryTitle } from './entry-title';
import { RecurringTag, isRecurring } from './recurring-tag';

const MONTH_PARAM = /^\d{4}-(?:0[1-9]|1[0-2])$/;

const LINK_CLASS = 'inline-flex min-h-11 items-center text-primary underline underline-offset-4';

/** "Friday, 16 October". `parseISO` reads a date-only string as local midnight, so the day never shifts. */
function headingOf(date: IsoDate, locale: string): string {
  return dateFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(date));
}

/** "Oct 2026". */
function labelOf(month: IsoMonth, locale: string): string {
  return dateFormat(locale, { month: 'short', year: 'numeric' }).format(parseISO(firstOfMonth(month)));
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
  const { t, locale } = useT();
  const accountName = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.name ?? t.entries.list.unknownAccount;
  const currency = accounts.find((a) => a.id === entry.accountId)?.currency ?? 'EUR';

  const { title, label } = entryTitle(entry, t);
  // A transfer has no category: a neutral tile with arrows both ways.
  const Icon = entry.type === 'transfer' ? ArrowLeftRightIcon : (CATEGORY_ICONS[entry.categoryId] ?? OTHER_ICON);
  const details = [
    label,
    entry.type === 'transfer' ? `${accountName(entry.accountId)} → ${accountName(entry.toAccountId)}` : null,
  ].filter((part) => part !== null);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full items-center gap-3 py-2.5 text-start"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline bg-muted"
        style={entry.type === 'transfer' ? undefined : { backgroundColor: categoryTint(entry.categoryId) }}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">
          <span className="font-semibold break-words">{title}</span>
          {isRecurring(entry) && <RecurringTag className="ms-2 align-middle" />}
        </span>
        {details.length > 0 && <span className="block text-sm text-muted-foreground">{details.join(' · ')}</span>}
      </span>
      <span className="shrink-0 font-semibold tabular-nums">
        {entry.type === 'income' ? '+' : ''}
        {formatMoney(entry.amountMinor, currency, { locale })}
      </span>
    </button>
  );
}

/** The edit form for one entry, with Delete behind a yes-or-cancel question. */
function EditPanel({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { t } = useT();
  const text = t.entries.edit;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    try {
      await deleteEntry(entry.id);
    } catch (deleteError) {
      console.error('StudentsBudget: could not delete the entry', deleteError);
      setError(text.deleteFailed);
      return;
    }
    onClose();
  }

  return (
    <section aria-label={text.heading} className={cn(cardVariants(), 'my-2 gap-4')}>
      <h3 className="text-xl leading-tight font-extrabold">{text.heading}</h3>
      <EntryForm entry={entry} onSaved={onClose} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {confirming ? (
        <div role="group" aria-label={text.deleteQuestion} className="flex flex-wrap items-center gap-2">
          <p className="me-auto font-semibold">{text.deleteQuestion}</p>
          <Button variant="destructive" className="px-4" onClick={() => void remove()}>
            {text.yes}
          </Button>
          <Button variant="outline" className="px-4" onClick={() => setConfirming(false)}>
            {text.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="px-4" onClick={onClose}>
            {text.cancel}
          </Button>
          <Button variant="ghost" className="px-4" onClick={() => setConfirming(true)}>
            {text.delete}
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
  const { t, locale } = useT();
  const text = t.entries.list;
  const params = useSearchParams();
  const monthParam = params.get('month');
  const categoryParam = params.get('category');
  const month = monthParam !== null && MONTH_PARAM.test(monthParam) ? monthParam : null;
  const category = categoryParam !== null && CATEGORIES.some((c) => c.id === categoryParam) ? categoryParam : null;

  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  // The date follows the clock, so an installed app that is resumed after a month end shows the new month.
  // It is null until the browser runs this (never a date from the prerender).
  const today = useToday();
  const loaded = useLiveQuery(async () => {
    if (today === null) return null;
    const thisMonth = monthOf(today);
    const shown = month ?? thisMonth;
    return {
      month: shown,
      thisMonth,
      entries: await entriesInRange(firstOfMonth(shown), `${shown}-${daysInMonth(shown)}`),
    };
  }, [month, today]);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (accounts === undefined || !loaded) return null;

  const entries = loaded.entries.filter((e) => category === null || (e.type !== 'transfer' && e.categoryId === category));
  // Clear goes back to the current month with no category, so it is only worth showing when that is a change.
  const filtered = category !== null || loaded.month !== loaded.thisMonth;
  const summary = [category === null ? null : categoryNameIn(t, category), labelOf(loaded.month, locale)].filter(
    (p) => p !== null,
  );

  return (
    <section aria-label={text.label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm text-muted-foreground">
        <p className="flex flex-wrap items-center gap-x-2">
          <span>{summary.join(' · ')}</span>
          {filtered && (
            <>
              <span aria-hidden="true">{' · '}</span>
              <Link href="/entries" className={LINK_CLASS}>
                {text.clear}
              </Link>
            </>
          )}
        </p>
        <nav aria-label={text.monthNav} className="flex items-center gap-4">
          {/* The arrows are decoration: a screen reader says only "Previous" and "Next". */}
          <Link href={listHref(shiftMonth(loaded.month, -1), category)} className={LINK_CLASS}>
            <span aria-hidden="true">‹&nbsp;</span>
            {text.previous}
          </Link>
          <Link href={listHref(shiftMonth(loaded.month, 1), category)} className={LINK_CLASS}>
            {text.next}
            <span aria-hidden="true">&nbsp;›</span>
          </Link>
        </nav>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground">{text.nothingYet}</p>
      ) : (
        groupByDate(entries).map((group) => (
          <div key={group.date} className="flex flex-col gap-1.5">
            <h3 className="font-sans text-sm font-semibold tracking-normal text-muted-foreground">
              {headingOf(group.date, locale)}
            </h3>
            {/* One card per day; the rows inside it are divided by hairlines. */}
            <ul className={cn(cardVariants(), 'gap-0 divide-y py-0')}>
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
