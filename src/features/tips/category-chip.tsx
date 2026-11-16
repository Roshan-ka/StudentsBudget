'use client';

import { Button } from '@/components/ui/button';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';

/**
 * A filter chip of the Tips and Discounts lists (group 2 redesign, 16-11-2026): a category's chip sits on its tint with
 * its icon before the name; "All" (`categoryId` null) stays on the card colour. Pressed, it fills with the text colour
 * as every chip does, and a dark ring around it says so too, so the choice never rests on colour alone. The name is the
 * text (4.5:1 on every tint, `tokens.test.ts`); the icon only decorates.
 */
export function CategoryChip({
  categoryId,
  label,
  pressed,
  onPress,
}: {
  categoryId: string | null;
  label: string;
  pressed: boolean;
  onPress: () => void;
}) {
  const Icon = categoryId === null ? null : (CATEGORY_ICONS[categoryId] ?? OTHER_ICON);
  return (
    <Button
      type="button"
      variant="chip"
      aria-pressed={pressed}
      onClick={onPress}
      // Pressed, the chip's own fill (the text colour) shows: a tint set here would cover it.
      style={categoryId === null || pressed ? undefined : { backgroundColor: categoryTint(categoryId) }}
      className="aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1 aria-pressed:ring-offset-background"
    >
      {Icon !== null && <Icon aria-hidden="true" />}
      {label}
    </Button>
  );
}
