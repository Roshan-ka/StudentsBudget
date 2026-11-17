import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { RowTile } from '@/features/home/row-card';
import { cn } from '@/lib/utils';

/** The look of a card in Sign-in and security (password, passkeys, two-step sign-in, deleting the account). */
export const SECURITY_CARD = cardVariants();

/**
 * A card's heading on Your account: its tinted tile, its name, and a short status at the end ("On", "1 passkey"), in
 * the app's colour when `active` (group 4 redesign, 17-11-2026: each section a card with a tinted tile, as Home's
 * cards have them). The status sits outside the heading, so the card's name (its region's name) stays the same.
 */
export function CardHeading({
  id,
  icon,
  tint,
  status,
  active = false,
  level = 4,
  children,
}: {
  id: string;
  icon: LucideIcon;
  /** The tile's fill: a category's tint (`categoryTint`), or `var(--muted)` for the neutral one. */
  tint: string;
  status?: string;
  active?: boolean;
  /** 4 inside Sign-in and security; 3 for a card of its own on the page (Your name on posts, Delete my account). */
  level?: 3 | 4;
  children: ReactNode;
}) {
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <div className="flex items-center gap-3">
      <RowTile icon={icon} tint={tint} />
      <Heading
        id={id}
        className={cn(
          'min-w-0 leading-tight break-words',
          level === 3 ? 'text-lg font-extrabold' : 'font-semibold',
        )}
      >
        {children}
      </Heading>
      {status !== undefined && (
        <span
          className={cn(
            'ms-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted',
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
}
