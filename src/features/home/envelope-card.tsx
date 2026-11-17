import type { ReactNode } from 'react';
import { categoryBarFill, categoryTint } from '@/features/charts/colors';
import { RowTile, tintCardClass } from './row-card';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';

/**
 * One envelope as its own block, tinted with its category's colour (tokens.test.ts holds its text to 4.5:1): its icon
 * tile, its name, a bar for how much of its plan is used, and the numbers under the bar, with room for a swap under
 * them. Home lists the month's envelopes in it (`EnvelopeList`), the check-in the week's (16-11-2026). It is an `li`:
 * the caller lists the cards in a `ul`.
 */
export function EnvelopeCard({
  categoryId,
  name,
  percent,
  barLabel,
  line,
  children,
}: {
  categoryId: string;
  /** The category's name in the phone's language. */
  name: string;
  /** How full the bar is, 0 to 100 (`percentUsed`). */
  percent: number;
  /**
   * The bar's name. Not the bare category name: a hidden page stays mounted, and the plan wizard's inputs are labelled
   * with it.
   */
  barLabel: string;
  /** The numbers, under the bar and as its value text. */
  line: string;
  /** Under the numbers: a swap to try. */
  children?: ReactNode;
}) {
  const Icon = CATEGORY_ICONS[categoryId] ?? OTHER_ICON;

  return (
    <li className={tintCardClass('flex-row')} style={{ backgroundColor: categoryTint(categoryId) }}>
      <RowTile icon={Icon} tint="var(--card)" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="min-w-0 font-semibold break-words">{name}</p>
        {/* The bar stops at full, so the real numbers are in its value text, and in the line under it. */}
        <div
          role="progressbar"
          aria-label={barLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={line}
          className="h-2.5 overflow-hidden rounded-full bg-track"
        >
          <div
            className="h-full rounded-full motion-safe:animate-bar-fill"
            style={{ width: `${percent}%`, backgroundColor: categoryBarFill(categoryId) }}
          />
        </div>
        {/* A screen reader gets these numbers from the bar's value text instead. */}
        <p aria-hidden="true" className="text-sm text-muted-foreground tabular-nums">
          {line}
        </p>
        {children}
      </div>
    </li>
  );
}
