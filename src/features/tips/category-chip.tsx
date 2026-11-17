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

/**
 * The same chip as one choice of a form's category (group 4 redesign, 17-11-2026, Add entry): a native radio laid over
 * the whole chip, transparent, so the chip is a label the browser groups by `name` (one tab stop, the arrow keys move
 * the choice, as the list it replaces did) and specs find it as a `radio` by its name. Chosen, it fills with the text
 * colour and gets the dark ring, as a pressed `CategoryChip` does; the focus ring is an outline, so the two never share
 * one property.
 */
export function CategoryRadioChip({
  name,
  categoryId,
  label,
  checked,
  onChoose,
}: {
  name: string;
  categoryId: string;
  label: string;
  checked: boolean;
  onChoose: () => void;
}) {
  const Icon = CATEGORY_ICONS[categoryId] ?? OTHER_ICON;
  return (
    <label
      // Chosen, the fill (the text colour) shows: a tint set here would cover it.
      style={checked ? undefined : { backgroundColor: categoryTint(categoryId) }}
      // Never wider than its row: at 200 % text a long name wraps inside the chip (reflow.spec).
      className="relative inline-flex max-w-full min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-outline px-4 py-2 text-center text-sm font-semibold text-balance text-foreground has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-checked:ring-2 has-checked:ring-foreground has-checked:ring-offset-1 has-checked:ring-offset-background has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
    >
      <input
        type="radio"
        name={name}
        value={categoryId}
        checked={checked}
        onChange={onChoose}
        className="absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
      />
      <Icon aria-hidden="true" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </label>
  );
}
