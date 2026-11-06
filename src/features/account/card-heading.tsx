import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** The look of a card in Sign-in and security (password, passkeys, two-step sign-in, deleting the account). */
export const SECURITY_CARD = cardVariants();

/**
 * A card's heading in Sign-in and security: its icon, its name, and a short status at the end ("On", "1 passkey"),
 * in the app's colour when `active`. The status sits outside the heading, so the card's name (its region's name)
 * stays the same.
 */
export function CardHeading({
  id,
  icon,
  status,
  active = false,
  level = 4,
  children,
}: {
  id: string;
  icon: ReactNode;
  status?: string;
  active?: boolean;
  /** 4 inside Sign-in and security; 3 for a card that sits beside it (Delete my account). */
  level?: 3 | 4;
  children: ReactNode;
}) {
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-primary [&_svg]:size-5">
        {icon}
      </span>
      <Heading id={id} className="font-semibold">
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
