'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TIPS } from '@/data/tips';
import { categoryName } from '@/features/entries/categories';
import { RangeSource } from '@/features/setup/steps/range-source';
import { sortTips, tipChipIds, tipTag } from './tips';

const SORTED = sortTips(TIPS);
const CHIPS = tipChipIds(TIPS);

/**
 * The Regensburg tips, all or one category at a time. The tips are static, so nothing here waits for the
 * database; the chosen category is kept only while the page stays mounted.
 */
export function TipsView() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const shown = categoryId === null ? SORTED : SORTED.filter((t) => t.categoryId === categoryId);

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

  // Folding More away while one of its categories is chosen would leave a filter with no pressed chip.
  const toggleMore = () => {
    if (showMore && categoryId !== null && CHIPS.more.includes(categoryId)) setCategoryId(null);
    setShowMore(!showMore);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Local ways students pay less. Each tip says where it comes from.</p>
      <div role="group" aria-label="Show tips for" className="flex flex-wrap gap-2">
        {chip(null, 'All')}
        {CHIPS.main.map((id) => chip(id, categoryName(id)))}
        {CHIPS.more.length > 0 && (
          <Button type="button" variant="secondary" className="h-10 px-3" aria-expanded={showMore} onClick={toggleMore}>
            More
          </Button>
        )}
        {showMore && CHIPS.more.map((id) => chip(id, categoryName(id)))}
      </div>
      <ul aria-label="Tips" className="flex flex-col gap-3">
        {shown.map((tip) => (
          <li key={tip.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{tip.title}</h3>
              <p className="text-sm text-muted-foreground">{tip.body}</p>
            </div>
            <span className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {tipTag(tip)}
            </span>
            <RangeSource range={tip} />
          </li>
        ))}
      </ul>
    </div>
  );
}
