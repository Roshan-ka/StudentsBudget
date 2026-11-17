import type { ReactNode } from 'react';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';

/**
 * A tag pill on the card colour (Roshan, 17-11-2026, review U7): every item's category tag looks the same on Tips,
 * Discounts, Hacks and Moderation, and stands out on the item's tinted card, where a pill in the card's own tint
 * disappeared. Tags without a category (a checklist item's "who", "Added by a student") take the same pill.
 */
export const PILL_CLASS =
  'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border-[1.5px] border-outline bg-card px-2.5 py-0.5 text-xs font-semibold';

/** An item's category as a pill: its icon, then its name, which is the text. */
export function CategoryPill({ categoryId, children }: { categoryId: string; children: ReactNode }) {
  const Icon = CATEGORY_ICONS[categoryId] ?? OTHER_ICON;
  return (
    <span className={PILL_CLASS}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}
