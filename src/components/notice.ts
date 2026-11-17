import { cn } from '@/lib/utils';

/**
 * A notice box: a short note set apart from the page, on the muted background, or the accent for one that wants the
 * eye (review U7, 17-11-2026: it was written by hand in 18 places). `className` adds the box's own layout and text.
 */
export function noticeClass(tone: 'muted' | 'accent' = 'muted', className?: string): string {
  return cn('rounded-lg px-4 py-3', tone === 'accent' ? 'bg-accent' : 'bg-muted', className);
}
