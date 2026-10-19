import { cn } from 'cn';
import type { Entry } from '@/db/types';

/** Whether a schedule posted this entry. Transfers are never scheduled. */
export function isRecurring(entry: Entry): boolean {
  return entry.type !== 'transfer' && entry.recurring !== undefined;
}

/** The small tag next to the title of an entry a schedule posted. */
export function RecurringTag({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground', className)}>
      Recurring
    </span>
  );
}
