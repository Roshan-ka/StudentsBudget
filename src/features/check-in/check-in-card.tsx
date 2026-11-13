import { CalendarCheckIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { cardVariants } from '@/components/ui/card';
import { RowCardLink } from '@/features/home/row-card';
import { useT } from '@/i18n/use-t';
import { isSunday, type IsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * The way into the weekly check-in, on home. Always there: on a weekday one quiet line (pain points, chunk 2), and on
 * Sunday, the day of the check-in, the yellow accent card that says in words that it is time. The date is passed in,
 * so nothing here reads the clock.
 */
export function CheckInCard({ today }: { today: IsoDate }) {
  const { t } = useT();
  const text = t.checkIn.card;

  if (!isSunday(today)) {
    return (
      <RowCardLink href="/check-in" icon={CalendarCheckIcon} tint="var(--accent)">
        <span className="font-semibold">{text.title}</span>{' '}
        <span className="text-sm text-muted-foreground">{text.other}</span>
      </RowCardLink>
    );
  }

  return (
    <Link
      href="/check-in"
      className={cn(cardVariants({ variant: 'accent' }), 'min-h-12 flex-row items-center gap-3 px-4 py-3')}
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md border-[1.5px] border-outline bg-card/80"
      >
        <CalendarCheckIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{text.title}</span>
        <span className="text-sm text-foreground">{text.sunday}</span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
    </Link>
  );
}
