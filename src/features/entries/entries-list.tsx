'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftRightIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ReceiptTextIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type Ref } from 'react';
import { LinkButton } from '@/components/link-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { CATEGORIES } from '@/data/categories';
import { db } from '@/db/db';
import { deleteEntry, entriesInRange } from '@/db/repo';
import type { Account, Entry } from '@/db/types';
import { categoryTint } from '@/features/charts/colors';
import { EmptyCard, RowTile, tintCardClass } from '@/features/home/row-card';
import { categoryNameIn } from '@/i18n/category-name';
import { dateFormat, dayLabel } from '@/i18n/format';
import { useT } from '@/i18n/use-t';
import { daysInMonth, firstOfMonth, monthOf, shiftMonth, type IsoMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { useFocusAfter, useFocusOnMount } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { CATEGORY_ICONS, OTHER_ICON } from './category-icons';
import { EntryForm } from './entry-form';
import { entryTitle } from './entry-title';
import { groupByDate, neighbourOf } from './list-order';
import { noYearDay } from './quick-add-date';
import { RecurringTag, isRecurring } from './recurring-tag';

const MONTH_PARAM = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** The focus key of the list itself, for the last entry of a month that is deleted. */
const LIST_KEY = 'entries-list';

/** Previous and Next: an outlined square of 44 px around its chevron. */
const MONTH_BUTTON = cn(buttonVariants({ variant: 'outline' }), 'size-11 shrink-0 px-0');

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

/** The list of `category` (or every category) in `month`, or in the current month with no month: as short as it goes. */
function filterHref(month: IsoMonth | null, category: string | null): string {
  const query = new URLSearchParams();
  if (month !== null) query.set('month', month);
  if (category !== null) query.set('category', category);
  const search = query.toString();
  return search === '' ? '/entries' : `/entries?${search}`;
}

function EntryRow({
  entry,
  accounts,
  onOpen,
  buttonRef,
}: {
  entry: Entry;
  accounts: Account[];
  onOpen: () => void;
  /** Takes the focus back when the row's panel closes, or when the entry before it is deleted. */
  buttonRef: Ref<HTMLButtonElement>;
}) {
  const { t, locale } = useT();
  const accountName = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.name ?? t.entries.list.unknownAccount;
  const currency = accounts.find((a) => a.id === entry.accountId)?.currency ?? 'EUR';

  const { title, label } = entryTitle(entry, t);
  // A transfer has no category: a neutral card with arrows both ways.
  const Icon = entry.type === 'transfer' ? ArrowLeftRightIcon : (CATEGORY_ICONS[entry.categoryId] ?? OTHER_ICON);
  // "Category · Account" under the title; the category is left out where the title already is it ("Rent", not
  // "Rent" over "Rent"). Each part is its own span, so a part can be found on its own.
  const details = [
    label,
    entry.type === 'transfer'
      ? `${accountName(entry.accountId)} → ${accountName(entry.toAccountId)}`
      : accountName(entry.accountId),
  ].filter((part) => part !== null);

  return (
    // Each entry its own small card in its category's tint (tokens.test.ts holds the text on every tint to 4.5:1).
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      className={tintCardClass(cn('min-h-14 w-full flex-row items-center text-start', entry.type === 'transfer' && 'bg-muted'))}
      style={entry.type === 'transfer' ? undefined : { backgroundColor: categoryTint(entry.categoryId) }}
    >
      <RowTile icon={Icon} tint="var(--card)" />
      <span className="min-w-0 flex-1">
        <span className="block">
          <span className="font-semibold break-words">{title}</span>
          {isRecurring(entry) && <RecurringTag className="ms-2 align-middle" />}
        </span>
        <span className="block text-sm break-words text-muted-foreground">
          {details.map((part, index) => (
            <span key={index}>
              {index > 0 && ' · '}
              <span>{part}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">
        {entry.type === 'income' ? '+' : ''}
        {formatMoney(entry.amountMinor, currency, { locale })}
      </span>
    </button>
  );
}

/**
 * The edit form for one entry, with Delete behind a yes-or-cancel question. It opens on its heading; the question
 * takes the focus when it shows, and Cancel gives it back to Delete. `onClose` and `onDeleted` move it on.
 */
function EditPanel({ entry, onClose, onDeleted }: { entry: Entry; onClose: () => void; onDeleted: () => void }) {
  const { t } = useT();
  const text = t.entries.edit;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const focus = useFocusAfter();

  async function remove() {
    setError(null);
    try {
      await deleteEntry(entry.id);
    } catch (deleteError) {
      console.error('StudentsBudget: could not delete the entry', deleteError);
      setError(text.deleteFailed);
      return;
    }
    onDeleted();
  }

  return (
    <section aria-label={text.heading} className={cn(cardVariants(), 'gap-4')}>
      {/* Inside a day's group, whose date is the h3. */}
      <h4 ref={headingRef} tabIndex={-1} className="text-xl leading-tight font-extrabold outline-none">
        {text.heading}
      </h4>
      <EntryForm entry={entry} onSaved={onClose} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {confirming ? (
        <div role="group" aria-label={text.deleteQuestion} className="flex flex-wrap items-center gap-2">
          <DeleteQuestion text={text.deleteQuestion} />
          <Button variant="destructive" className="px-4" onClick={() => void remove()}>
            {text.yes}
          </Button>
          <Button
            variant="outline"
            className="px-4"
            onClick={() => {
              focus.mark('delete');
              setConfirming(false);
            }}
          >
            {text.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="px-4" onClick={onClose}>
            {text.cancel}
          </Button>
          <Button ref={focus.refFor('delete')} variant="ghost" className="px-4" onClick={() => setConfirming(true)}>
            {text.delete}
          </Button>
        </div>
      )}
    </section>
  );
}

/** The yes-or-cancel question, which takes the focus as it shows, so a screen reader says it first. */
function DeleteQuestion({ text }: { text: string }) {
  const ref = useFocusOnMount<HTMLParagraphElement>();
  return (
    <p ref={ref} tabIndex={-1} className="me-auto font-semibold outline-none">
      {text}
    </p>
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
  // Where the focus goes as a panel closes or an entry goes: the row's own button, the next row, or the list.
  const focus = useFocusAfter();

  if (accounts === undefined || !loaded) return null;

  const entries = loaded.entries.filter((e) => category === null || (e.type !== 'transfer' && e.categoryId === category));
  const onThisMonth = loaded.month === loaded.thisMonth;

  // A deleted entry hands the focus to the one shown after it, else the one before, else the list itself.
  const neighbour = (id: string): string => neighbourOf(entries, id) ?? LIST_KEY;
  // A month gone by says how to log a day in it: quick add saves today unless the line names the day (breakpoints).
  const pastMonth = loaded.month < loaded.thisMonth;
  // Its example is the 3rd, with the year where "3.<month>" alone would read as another month's (final review).
  const exampleMonth = Number(loaded.month.slice(5, 7));
  const exampleYear =
    today !== null && noYearDay(3, exampleMonth, today) === `${loaded.month}-03` ? null : Number(loaded.month.slice(0, 4));

  return (
    <section
      ref={focus.refFor(LIST_KEY)}
      tabIndex={-1}
      aria-label={text.label}
      className="flex flex-col gap-3 outline-none"
    >
      {/* The month in the middle, between two outlined arrow buttons (Roshan's group 2 mockups, 16-11-2026). Their
          words are there for a screen reader only: it says "Previous" and "Next", the chevrons are decoration. */}
      <nav aria-label={text.monthNav} className="flex items-center justify-between gap-2">
        <Link href={listHref(shiftMonth(loaded.month, -1), category)} className={MONTH_BUTTON}>
          <ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
          <span className="sr-only">{text.previous}</span>
        </Link>
        <p className="min-w-0 text-center font-heading text-lg font-bold break-words">{labelOf(loaded.month, locale)}</p>
        <Link href={listHref(shiftMonth(loaded.month, 1), category)} className={MONTH_BUTTON}>
          <ChevronRightIcon aria-hidden="true" className="rtl:rotate-180" />
          <span className="sr-only">{text.next}</span>
        </Link>
      </nav>
      {/* A category kept from Charts is a chip that takes it off in the same month, and another month has its way back
          to this one, each on its own (18-11-2026: one "Clear" for both read as deleting the list). */}
      {(category !== null || !onThisMonth) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {category !== null && (
            <LinkButton
              href={filterHref(onThisMonth ? null : loaded.month, null)}
              icon={XIcon}
              aria-label={text.showAllCategories(categoryNameIn(t, category))}
            >
              {categoryNameIn(t, category)}
            </LinkButton>
          )}
          {!onThisMonth && (
            <LinkButton href={filterHref(null, category)} icon={CalendarIcon}>
              {text.thisMonth}
            </LinkButton>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyCard icon={ReceiptTextIcon} title={text.nothingYet}>
          {pastMonth ? text.otherMonthHint(exampleMonth, exampleYear) : text.nothingYetHint}
        </EmptyCard>
      ) : (
        groupByDate(entries).map((group) => (
          <div key={group.date} className="flex flex-col gap-1.5">
            <h3 className="font-sans text-sm font-semibold tracking-normal text-muted-foreground">
              {dayLabel(group.date, locale)}
            </h3>
            {/* Each entry is its own small card (EntryRow), under its day's heading. */}
            <ul className="flex flex-col gap-2">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  {editingId === entry.id ? (
                    <EditPanel
                      entry={entry}
                      onClose={() => {
                        focus.mark(entry.id);
                        setEditingId(null);
                      }}
                      onDeleted={() => {
                        focus.mark(neighbour(entry.id));
                        setEditingId(null);
                      }}
                    />
                  ) : (
                    <EntryRow
                      entry={entry}
                      accounts={accounts}
                      onOpen={() => setEditingId(entry.id)}
                      buttonRef={focus.refFor(entry.id)}
                    />
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
