import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';

/**
 * A discount's tags, in the list and on the map's card: its category on its tint, with its icon, and for a student's
 * discount "Added by a student". The category's name is the text (4.5:1 on every tint); the icon only decorates.
 */
export function DiscountTags({ categoryId, student, t }: { categoryId: string; student: boolean; t: Messages }) {
  const Icon = CATEGORY_ICONS[categoryId] ?? OTHER_ICON;
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: categoryTint(categoryId) }}
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {categoryNameIn(t, categoryId)}
      </span>
      {/* Nobody checked it before it showed, so it never reads like the app's own sourced list. */}
      {student && (
        <span className="inline-flex w-fit items-center rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold">
          {t.tips.studentDiscounts.tag}
        </span>
      )}
    </div>
  );
}
