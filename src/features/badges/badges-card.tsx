import { AwardIcon } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/use-t';
import type { Badge } from './badges';

/** The badge to work on next: the first not earned yet, or Under-Budget Week's next tier once all are earned. */
function nextBadge(badges: Badge[]): Badge | null {
  return (
    badges.find((b) => b.earnedOn === null) ??
    badges.find((b) => b.id === 'under-budget-week' && b.tier !== 'gold') ??
    null
  );
}

/**
 * The badges on home, as one quiet line (pain points, chunk 2): how many are earned, the next one, and the way to all
 * of them, where each badge's progress is. Nothing here reads data.
 */
export function BadgesCard({ badges }: { badges: Badge[] }) {
  const { t } = useT();
  const text = t.badges.card;
  const earned = badges.filter((b) => b.earnedOn !== null).length;
  const next = nextBadge(badges);

  return (
    <section aria-labelledby="badges-card-heading" className="flex min-h-11 flex-wrap items-center gap-x-3 text-sm">
      <AwardIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <h2 id="badges-card-heading" className="inline font-sans text-sm font-semibold tracking-normal">
          {text.heading}
        </h2>
        <span aria-hidden="true"> · </span>
        <span>{text.earnedOf(earned, badges.length)}</span>
        {next !== null && (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              {' · '}
            </span>
            <span className="text-muted-foreground">{text.next(next.title)}</span>
          </>
        )}
      </div>
      <Link href="/badges" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">
        {text.seeAll}
      </Link>
    </section>
  );
}
