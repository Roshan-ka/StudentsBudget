import { ChevronRightIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** The padding and line of Home's small cards: a tile, their words, and what they lead to at the end. */
export const ROW_CARD = 'min-h-14 flex-row items-center gap-3 px-4 py-3';

/**
 * A list item's card in its category's tint, for any element (review U1, Roshan's approval of the mockups,
 * 17-11-2026): Home's envelopes, the entries, the recaps' envelopes, Settings' fixed costs and income, setup's
 * categories and the start page's features share its one padding, with a `RowTile` on the card colour
 * (`tint="var(--card)"`). The tint itself goes in `style` (`categoryTint`).
 */
export function tintCardClass(className?: string): string {
  return cn(cardVariants({ variant: 'tint' }), 'gap-3 p-3.5', className);
}

/**
 * A Home card's icon on its tint (Roshan, from the mockups, 13-11-2026: "divide the check-in, badges and all accounts").
 * Decoration only, as the words beside it say what the card is; unless `label` names what the tile alone shows (an
 * account's kind on Settings → Accounts and transfers), which a screen reader then reads as an image.
 */
export function RowTile({ icon: Icon, tint, label }: { icon: LucideIcon; tint: string; label?: string }) {
  return (
    <span
      aria-hidden={label === undefined ? 'true' : undefined}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      className="flex size-10 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline"
      style={{ backgroundColor: tint }}
    >
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

/** One of Home's cards that leads somewhere (the check-in, a month's recap): its tile, its words and a chevron. */
export function RowCardLink({
  href,
  icon,
  tint,
  children,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(cardVariants(), ROW_CARD)}>
      <RowTile icon={icon} tint={tint} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
    </Link>
  );
}
