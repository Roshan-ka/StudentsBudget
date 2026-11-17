import { CategoryPill, PILL_CLASS } from '@/features/tips/category-pill';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';

/**
 * A discount's tags, in the list and on the map's card: its category as a pill on the card colour, with its icon, and
 * for a student's discount "Added by a student". The category's name is the text; the icon only decorates.
 */
export function DiscountTags({ categoryId, student, t }: { categoryId: string; student: boolean; t: Messages }) {
  return (
    <div className="flex flex-wrap gap-2">
      <CategoryPill categoryId={categoryId}>{categoryNameIn(t, categoryId)}</CategoryPill>
      {/* Nobody checked it before it showed, so it never reads like the app's own sourced list. */}
      {student && <span className={PILL_CLASS}>{t.tips.studentDiscounts.tag}</span>}
    </div>
  );
}
