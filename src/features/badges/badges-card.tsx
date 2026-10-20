import Link from 'next/link';
import type { Badge } from './badges';
import { DatedText } from './dated-text';

/** The badge to work on next: the first not earned yet, or Under-Budget Week's next tier once all are earned. */
function nextBadge(badges: Badge[]): Badge | null {
  return (
    badges.find((b) => b.earnedOn === null) ??
    badges.find((b) => b.id === 'under-budget-week' && b.tier !== 'gold') ??
    null
  );
}

/** The badges on home: how many are earned, the next one, and the way to all of them. Nothing here reads data. */
export function BadgesCard({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earnedOn !== null).length;
  const next = nextBadge(badges);

  return (
    // No bottom padding: the link is 44 px tall (a finger needs that), and its own height is the space below the text.
    <section
      aria-labelledby="badges-card-heading"
      className="flex flex-col items-start gap-0.5 rounded-lg border px-4 pt-3"
    >
      <h2 id="badges-card-heading" className="font-medium">
        Badges
      </h2>
      <p className="text-sm">{`${earned} of ${badges.length} earned`}</p>
      {next !== null && (
        <>
          <p className="text-sm text-muted-foreground">{`Next: ${next.title}`}</p>
          <p className="text-sm break-words text-muted-foreground">
            <DatedText text={next.progress} />
          </p>
        </>
      )}
      <Link
        href="/badges"
        className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
      >
        See all badges
      </Link>
    </section>
  );
}
