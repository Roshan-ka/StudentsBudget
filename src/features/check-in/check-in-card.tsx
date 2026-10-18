import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { isSunday, type IsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * The way into the weekly check-in, on home. Always there; on Sunday, the day of the check-in, it is
 * highlighted and says it is time. The date is passed in, so nothing here reads the clock.
 */
export function CheckInCard({ today }: { today: IsoDate }) {
  const sunday = isSunday(today);

  return (
    <Link
      href="/check-in"
      className={cn(
        'flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-3',
        sunday && 'border-primary bg-primary/10',
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">Weekly check-in</span>
        <span className={cn('text-sm', sunday ? 'text-foreground' : 'text-muted-foreground')}>
          {sunday ? "It's Sunday — time for your weekly check-in." : 'Your weekly check-in is on Sunday.'}
        </span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
