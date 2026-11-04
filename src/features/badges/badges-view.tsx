'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { AwardIcon } from 'lucide-react';
import Link from 'next/link';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { badgeHistory, badgesFrom, goldWeeks, semesterWeeksFor, type Badge } from './badges';
import { DatedText } from './dated-text';

/** "Bronze · earned 15.11.2026", "Earned 08.11.2026" or "Not earned yet". */
function status(b: Badge, t: Messages): string {
  const text = t.badges;
  if (b.earnedOn === null) return text.notEarned;
  const date = formatDate(b.earnedOn);
  return b.tier === null ? text.earned(date) : text.tierEarned(text.tiers[b.tier], date);
}

/** What earns each badge, in full: the rules are published, not hidden. */
function rule(id: Badge['id'], semesterWeeks: number, t: Messages): string {
  const text = t.badges.rules;
  switch (id) {
    case 'under-budget-week': {
      // A short semester still needs 13 weeks for gold (`goldWeeks`), which is then no whole semester.
      const gold = goldWeeks(semesterWeeks);
      return text.underBudget(gold, gold === semesterWeeks);
    }
    case 'logging-streak':
      return text.streak;
    case 'ramen-royalty':
      return text.ramen;
    case 'latte-survivor':
      return text.latte;
  }
}

/**
 * All four badges with their tier, progress and the day each was earned. They come from the weeks that are over,
 * which the app saves once each, and from the entries; nothing here waits for anything else.
 */
export function BadgesView() {
  const { t, lang } = useT();
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
        {t.badges.noPlan}{' '}
        <Link href="/setup" className="text-primary underline-offset-4 hover:underline">
          {t.badges.startSetup}
        </Link>
      </p>
    );
  }

  const semesterWeeks = semesterWeeksFor(profile);
  const badges = badgesFrom(results, semesterWeeks, badgeHistory(plan, entries, results, today), lang);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.badges.intro}</p>
      <ul aria-label={t.badges.listLabel} className="flex flex-col gap-3">
        {badges.map((b) => (
          <li key={b.id} className={cn(cardVariants(), 'flex-row items-start gap-3')}>
            {/* A round sticker, yellow once earned: decoration, as the status line says it in words. */}
            <span
              aria-hidden="true"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-outline',
                b.earnedOn === null ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground',
              )}
            >
              <AwardIcon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="text-lg leading-tight font-extrabold break-words">{b.title}</h3>
              <p className="text-sm font-semibold">
                <DatedText text={status(b, t)} />
              </p>
              <p className="text-sm break-words">
                <DatedText text={b.progress} />
              </p>
              <p className="text-sm text-muted-foreground">{rule(b.id, semesterWeeks, t)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
