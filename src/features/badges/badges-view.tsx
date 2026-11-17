'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { AwardIcon, ClipboardListIcon, CoffeeIcon, FlameIcon, SoupIcon, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import { FoldSummary, LinkButton } from '@/components/link-button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { categoryTint } from '@/features/charts/colors';
import { percentUsed } from '@/features/home/percent-used';
import { EmptyCard, RowTile } from '@/features/home/row-card';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import { badgeHistory, badgesFrom, goldWeeks, semesterWeeksFor, type Badge } from './badges';
import { DatedText } from './dated-text';

/**
 * Each badge's tile: its icon, on a category's tint for its colour (Group 3 mockups, 16-11-2026), as Home's tiles take
 * theirs (`row-card.tsx`). Under-Budget Week keeps the violet of Home's Badges card.
 */
const TILES: Record<Badge['id'], { icon: LucideIcon; category: string }> = {
  'under-budget-week': { icon: AwardIcon, category: 'going-out' },
  'logging-streak': { icon: FlameIcon, category: 'food' },
  'ramen-royalty': { icon: SoupIcon, category: 'eating-out' },
  'latte-survivor': { icon: CoffeeIcon, category: 'rent' },
};

/**
 * A bar on the Badges page: the track, filled in the primary colour (tokens.test.ts holds it to 3:1 on the track over
 * the card and over the accent). It is named by the words beside it (`labelledBy`), and its value text says them in
 * full, so those words are hidden from a screen reader where they stand.
 */
function Meter({ percent, labelledBy, valueText }: { percent: number; labelledBy: string; valueText: string }) {
  return (
    <div
      role="progressbar"
      aria-labelledby={labelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      className="h-2.5 overflow-hidden rounded-full bg-track"
    >
      <div className="h-full rounded-full bg-primary motion-safe:animate-bar-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

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
  const id = useId();
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
      <EmptyCard
        icon={AwardIcon}
        title={t.common.noPlanYet}
        action={
          <LinkButton href="/setup" icon={ClipboardListIcon}>
            {t.common.toSetup}
          </LinkButton>
        }
      >
        {t.badges.noPlan}
      </EmptyCard>
    );
  }

  const semesterWeeks = semesterWeeksFor(profile);
  const badges = badgesFrom(results, semesterWeeks, badgeHistory(plan, entries, results, today), lang);
  const earned = badges.filter((b) => b.earnedOn !== null).length;
  const earnedText = t.badges.card.earnedOf(earned, badges.length);

  return (
    <div className="flex flex-col gap-4">
      {/* The yellow accent card at the top (Group 3 mockups, 16-11-2026): how many are earned, and its bar. */}
      <div className={cn(cardVariants({ variant: 'accent' }), 'gap-2')}>
        <p id={`${id}-earned`} aria-hidden="true" className="font-semibold">
          {earnedText}
        </p>
        <Meter percent={percentUsed(badges.length, earned)} labelledBy={`${id}-earned`} valueText={earnedText} />
      </div>
      <ul aria-label={t.badges.listLabel} className="flex flex-col gap-3">
        {badges.map((b) => {
          const tile = TILES[b.id];
          const headingId = `${id}-${b.id}`;
          return (
            <li key={b.id} className={cn(cardVariants(), 'gap-2.5')}>
              <div className="flex items-start gap-3">
                <RowTile icon={tile.icon} tint={categoryTint(tile.category)} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h3 id={headingId} className="text-lg leading-tight font-extrabold break-words">
                    {b.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <DatedText text={status(b, t)} />
                  </p>
                </div>
              </div>
              {/* Where the badge counts towards a next step: the bar, named by the badge, with the line under it as its
                  value text. */}
              {b.meter !== null && (
                <Meter
                  percent={percentUsed(b.meter.goal, b.meter.done)}
                  labelledBy={headingId}
                  valueText={b.progress}
                />
              )}
              <p aria-hidden={b.meter === null ? undefined : 'true'} className="text-sm break-words">
                <DatedText text={b.progress} />
              </p>
            </li>
          );
        })}
      </ul>
      {/* The rules are published, not hidden, but read once: one fold for all of them (pain points, chunk 8), opened
          by an outlined button with a chevron (16-11-2026). */}
      <details className="text-sm">
        <FoldSummary>{t.badges.howItWorks}</FoldSummary>
        <div className="flex flex-col gap-3 pt-3 pb-2">
          <p className="text-muted-foreground">{t.badges.intro}</p>
          <ul className="flex flex-col gap-2">
            {badges.map((b) => (
              <li key={b.id} className="flex flex-col">
                <span className="font-semibold">{b.title}</span>
                <span className="text-muted-foreground">{rule(b.id, semesterWeeks, t)}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
