import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The look of a card in Sign-in and security (passkeys, two-step sign-in). */
export const SECURITY_CARD = 'flex flex-col gap-3 rounded-xl border p-4';

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
  children,
}: {
  id: string;
  icon: ReactNode;
  status?: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-primary [&_svg]:size-5">
        {icon}
      </span>
      <h4 id={id} className="font-semibold">
        {children}
      </h4>
      {status !== undefined && (
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted',
          )}
        >
          {status}
        </span>
      )}
    </div>
  );
}
