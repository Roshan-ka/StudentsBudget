'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Discount } from '@/data/discounts';
import { db } from '@/db/db';
import type { DiscountVote } from '@/db/types';
import { categoryName } from '@/features/entries/categories';
import { RangeSource } from '@/features/setup/steps/range-source';
import { formatDate, todayIso } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { bundledDiscounts, discountCategoryIds, sortByFreshness, type DiscountSource } from './discounts';

const VOTES: { vote: DiscountVote['vote']; label: string }[] = [
  { vote: 'works', label: 'Still works' },
  { vote: 'outdated', label: "Doesn't work anymore" },
];

/** What a screen reader hears after a vote: the list re-sorts, so it also says which way the discount went. */
function announcement(d: Discount, vote: DiscountVote['vote']): string {
  return vote === 'works'
    ? `${d.place}: saved as still working. It moves up the list.`
    : `${d.place}: saved as not working. It moves down the list.`;
}

/**
 * The Regensburg student discounts, freshest first. "Still works" and "Doesn't work anymore" are saved on this
 * phone, dated today; tapping again replaces the answer. The list comes from `source` (bundled now, a server
 * later; keep the same one for the view's lifetime), the votes from the database, and the chosen category is kept
 * only while the page stays mounted.
 */
export function DiscountsView({ source = bundledDiscounts }: { source?: DiscountSource }) {
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const votes = useLiveQuery(() => db.discountVotes.toArray(), []);
  const [discounts, setDiscounts] = useState<Discount[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  /** The answer just given, shown under its discount. */
  const [notice, setNotice] = useState<{ discountId: string; text: string } | null>(null);
  const [heard, setHeard] = useState('');
  const items = useRef(new Map<string, HTMLLIElement>());
  /** A discount just voted on: it moves in the list, and focus goes with it. */
  const follow = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    source.list().then(
      (list) => {
        if (!current) return;
        setDiscounts(list);
        setFailed(false);
      },
      (error: unknown) => {
        console.error('StudentsBudget: could not load the discounts', error);
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [source]);

  // A page the app leaves stays mounted but hidden: what was just said about a vote is old news when it comes back.
  useEffect(
    () => () => {
      follow.current = null;
      setNotice(null);
      setHeard('');
    },
    [],
  );

  // Runs once the new vote has re-sorted the list: the voted discount keeps the focus, wherever it moved.
  useEffect(() => {
    const id = follow.current;
    if (id === null) return;
    follow.current = null;
    items.current.get(id)?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
  }, [votes]);

  if (failed && discounts === null) {
    return <p className="text-sm text-muted-foreground">The discounts could not be loaded. Try again later.</p>;
  }
  if (today === null || discounts === null || votes === undefined) return null;

  const rows = sortByFreshness(discounts, votes, today);
  const shown = categoryId === null ? rows : rows.filter((row) => row.discount.categoryId === categoryId);

  function choose(d: Discount, vote: DiscountVote['vote']) {
    follow.current = d.id;
    // Today at the moment of the tap, not of the last render.
    db.discountVotes.put({ discountId: d.id, vote, on: todayIso() }).then(
      () => {
        setNotice({ discountId: d.id, text: 'Saved on this phone.' });
        setHeard(announcement(d, vote));
      },
      (error: unknown) => {
        follow.current = null;
        console.error('StudentsBudget: could not save the discount vote', error);
        setNotice({ discountId: d.id, text: 'Could not save your answer. Try again.' });
        setHeard(`${d.place}: could not save your answer. Try again.`);
      },
    );
  }

  const chip = (id: string | null, label: string) => (
    <Button
      key={id ?? 'all'}
      type="button"
      variant={categoryId === id ? 'default' : 'outline'}
      aria-pressed={categoryId === id}
      className="h-10 px-3"
      onClick={() => setCategoryId(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Student discounts in Regensburg. Each one says where it is stated. Tell the app whether one still works: your
        answers stay on this phone. Ones you confirm move up; ones you mark as not working, or that haven&rsquo;t been
        confirmed for 8 weeks, move down.
      </p>
      <div role="group" aria-label="Show discounts for" className="flex flex-wrap gap-2">
        {chip(null, 'All')}
        {discountCategoryIds(discounts).map((id) => chip(id, categoryName(id)))}
      </div>
      {/* Always there and filled later, so screen readers announce each change. */}
      <p role="status" className="sr-only">
        {heard}
      </p>
      <ul aria-label="Discounts" className="flex flex-col gap-3">
        {shown.map(({ discount: d, vote, freshness: f }) => {
          const placeId = `discount-${d.id}-place`;
          return (
            <li
              key={d.id}
              ref={(el) => {
                if (el) items.current.set(d.id, el);
                return () => {
                  items.current.delete(d.id);
                };
              }}
              className="flex flex-col gap-2 rounded-lg border px-4 py-3"
            >
              <div className="flex flex-col gap-1">
                <h3 id={placeId} className="font-medium break-words">
                  {d.place}
                </h3>
                <p className="text-sm font-medium break-words">{d.offer}</p>
                <p className="text-sm break-words text-muted-foreground">{d.conditions}</p>
                <p className="text-sm break-words text-muted-foreground">{d.address}</p>
              </div>
              <span className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {categoryName(d.categoryId)}
              </span>
              <div className="flex flex-col gap-0.5 text-sm">
                {f.outdated && vote ? (
                  <p className="font-medium">You marked this as not working on {formatDate(vote.on)}</p>
                ) : (
                  <>
                    {f.mayBeOutdated && <p className="font-medium">May be outdated</p>}
                    <p className="text-muted-foreground">Last confirmed {formatDate(f.lastConfirmed)}</p>
                  </>
                )}
              </div>
              <RangeSource range={d} />
              <div role="group" aria-label={`${d.place}: does it still work?`} className="mt-1 flex flex-wrap gap-2">
                {VOTES.map((option) => (
                  <Button
                    key={option.vote}
                    type="button"
                    variant={vote?.vote === option.vote ? 'default' : 'outline'}
                    aria-pressed={vote?.vote === option.vote}
                    aria-describedby={placeId}
                    className="h-10 px-3"
                    onClick={() => choose(d, option.vote)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {notice?.discountId === d.id && <p className="text-xs text-muted-foreground">{notice.text}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
