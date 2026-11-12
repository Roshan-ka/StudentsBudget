'use client';

import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { DiscountTags } from '../discount-tags';

/**
 * A discount as the map's card shows it, worded by the view: translated where it can be, its freshness as the list
 * says it.
 */
export type CardEntry = {
  id: string;
  place: string;
  offer: string;
  address: string;
  categoryId: string;
  student: boolean;
  /** The language its own words are in: a translation's, English where there is none, a student's as written. */
  lang: string | undefined;
  /** "Last confirmed …", with "May be outdated" before it, or "Marked as not working on …". */
  freshness: readonly string[];
};

const headingId = (id: string) => `map-card-${id}-place`;

/**
 * The card at the bottom of the map (discount map, chunk 5; the look Roshan approved from chunk 2's mockups): the
 * chosen spot's discounts, each with its tags, place, offer, address and freshness, and "Show in the list", which
 * lands on it in the list. A summary, not the list's card, so its ids and the votes' focus don't clash with the list's. Close or
 * Escape hands the focus back to the pin (the map does that); `headingRef` takes the focus when a tap opened it.
 */
export function DiscountCard({
  entries,
  label,
  headingRef,
  onClose,
  onShowInList,
}: {
  entries: readonly CardEntry[];
  /** The card's name when it holds several discounts: its pin's. One discount names it by its heading. */
  label: string;
  headingRef: (element: HTMLElement | null) => void;
  onClose: () => void;
  onShowInList: (id: string) => void;
}) {
  const { t } = useT();
  const text = t.tips.discountMap;
  const single = entries.length === 1;
  return (
    <section
      aria-labelledby={single ? headingId(entries[0].id) : undefined}
      aria-label={single ? undefined : label}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
      className={cn(cardVariants(), 'min-h-0 gap-3 overflow-y-auto p-3')}
    >
      {entries.map((entry, index) => (
        <div key={entry.id} className={cn('flex flex-col gap-2', index > 0 && 'border-t-[1.5px] border-outline pt-3')}>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <DiscountTags categoryId={entry.categoryId} student={entry.student} t={t} />
            </div>
            {index === 0 && (
              <Button
                type="button"
                variant="outline"
                aria-label={text.close}
                className="size-11 shrink-0 rounded-full px-0"
                onClick={onClose}
              >
                <XIcon aria-hidden="true" className="size-5" />
              </Button>
            )}
          </div>
          <div lang={entry.lang} className="flex flex-col gap-1">
            <h3
              ref={index === 0 ? headingRef : undefined}
              id={headingId(entry.id)}
              tabIndex={-1}
              className="text-xl leading-snug font-extrabold break-words"
            >
              {entry.place}
            </h3>
            <p className="text-sm font-semibold break-words">{entry.offer}</p>
            {entry.address !== '' && <p className="text-sm break-words text-muted-foreground">{entry.address}</p>}
          </div>
          <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
            {entry.freshness.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            aria-describedby={headingId(entry.id)}
            onClick={() => onShowInList(entry.id)}
          >
            {text.showInList}
          </Button>
        </div>
      ))}
    </section>
  );
}
