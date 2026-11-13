import { ChevronRightIcon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** The padding and line of Home's small cards: a tile, their words, and what they lead to at the end. */
export const ROW_CARD = 'min-h-14 flex-row items-center gap-3 px-4 py-3';

/**
 * A Home card's icon on its tint (Roshan, from the mockups, 13-11-2026: "divide the check-in, badges and all accounts").
 * Decoration only: the words beside it say what the card is.
 */
export function RowTile({ icon: Icon, tint }: { icon: LucideIcon; tint: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline"
      style={{ backgroundColor: tint }}
    >
      <Icon className="size-5" />
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
