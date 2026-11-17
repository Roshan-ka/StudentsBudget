import type { ReactNode } from 'react';
import { categoryTint } from '@/features/charts/colors';
import { RowTile, tintCardClass } from '@/features/home/row-card';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';

/**
 * One category of a setup step as its own card (Roshan, from the mockups, 13-11-2026: "each category divided"): tinted
 * in its colour, as Home's envelopes are, with its icon tile beside the field. Under them, across the card, whatever
 * belongs to the line: its source, its "Add it automatically". The tint holds text and secondary text at 4.5:1
 * (tokens.test.ts). Each step lists its cards in a `ul`.
 */
export function CategoryCard({
  categoryId,
  field,
  children,
}: {
  categoryId: string;
  /** The line's amount, as an `AmountField` with `layout="row"`. */
  field: ReactNode;
  children?: ReactNode;
}) {
  const Icon = CATEGORY_ICONS[categoryId] ?? OTHER_ICON;
  return (
    <li className={tintCardClass('gap-2')} style={{ backgroundColor: categoryTint(categoryId) }}>
      <div className="flex items-center gap-3">
        <RowTile icon={Icon} tint="var(--card)" />
        <div className="min-w-0 flex-1">{field}</div>
      </div>
      {children}
    </li>
  );
}
