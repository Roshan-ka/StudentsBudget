'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { db } from '@/db/db';
import { formatDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { badgeHistory, badgesFrom, goldWeeks, semesterWeeksFor, type Badge } from './badges';
import { DatedText } from './dated-text';

const TIER: Record<NonNullable<Badge['tier']>, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

/** "Bronze · earned 15-11-2026", "Earned 08-11-2026" or "Not earned yet". */
function status(b: Badge): string {
  if (b.earnedOn === null) return 'Not earned yet';
  return b.tier === null ? `Earned ${formatDate(b.earnedOn)}` : `${TIER[b.tier]} · earned ${formatDate(b.earnedOn)}`;
}

/** What earns each badge, in full: the rules are published, not hidden. */
function rule(id: Badge['id'], semesterWeeks: number): string {
  switch (id) {
    case 'under-budget-week': {
      // A short semester still needs 13 weeks for gold (`goldWeeks`), which is then no whole semester.
      const gold = goldWeeks(semesterWeeks);
      return (
        'Counts a week in which you log envelope spending yourself and spend no more than its share of your envelopes: ' +
        'what was left of them at the start of the week, split over the weeks left in the month. ' +
        `Bronze at 4 weeks, silver at 12, gold at ${gold}${gold === semesterWeeks ? ': a whole semester' : ''}.`
      );
    }
    case 'logging-streak':
      return 'Weeks in a row in which you log envelope spending yourself. Earned at 4 weeks.';
    case 'ramen-royalty':
      return 'Earned by a full week that costs less in groceries than every week before it.';
    case 'latte-survivor':
      return (
        'Earned by a month with at most half the eating out of your first full month that had some. ' +
        'Only months in which you log envelope spending yourself count.'
      );
  }
}

/**
 * All four badges with their tier, progress and the day each was earned. They come from the weeks that are over,
 * which the app saves once each, and from the entries; nothing here waits for anything else.
 */
export function BadgesView() {
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const results = useLiveQuery(() => db.weekResults.toArray(), []);
  // The profile's semester sets gold Under-Budget Week; waited for, so gold never shows the default first.
  const profile = useLiveQuery(() => db.profile.get('current').then((p) => p ?? null), [], 'loading' as const);

  if (today === null || plan === 'loading' || entries === undefined || results === undefined) return null;
  if (profile === 'loading') return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        Set up your plan to start earning badges.{' '}
        <Link href="/setup" className="text-primary underline-offset-4 hover:underline">
          Start setup
        </Link>
      </p>
    );
  }

  const semesterWeeks = semesterWeeksFor(profile);
  const badges = badgesFrom(results, semesterWeeks, badgeHistory(plan, entries, results, today));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Each week is saved from the Wednesday after it ends, the next time you open the app, so spending you log for it
        on Monday or Tuesday still counts. Your badges come from those weeks and your entries. A week you mark as away
        in the check-in keeps your streak as it is and doesn&apos;t count towards Under-Budget Week or Ramen Royalty.
      </p>
      <ul aria-label="Your badges" className="flex flex-col gap-3">
        {badges.map((b) => (
          <li key={b.id} className="flex flex-col gap-1 rounded-lg border px-4 py-3">
            <h3 className="font-medium">{b.title}</h3>
            <p className="text-sm font-medium">
              <DatedText text={status(b)} />
            </p>
            <p className="text-sm break-words">
              <DatedText text={b.progress} />
            </p>
            <p className="text-sm text-muted-foreground">{rule(b.id, semesterWeeks)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
