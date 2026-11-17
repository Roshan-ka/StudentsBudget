'use client';

import { CheckIcon, CloudIcon, EyeOffIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLinkButton, LinkButton } from '@/components/link-button';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { hostOf } from '@/features/tips/source-line';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { formatDate, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  moderate,
  moderateComment,
  moderateDiscount,
  readCommentQueue,
  readDiscountQueue,
  readQueue,
  type CommentQueueAnswer,
  type DiscountQueueAnswer,
  type QueueAnswer,
} from './moderation';

/** What the moderator decides on: a post, a comment or a discount a student added. */
type Kind = 'posts' | 'comments' | 'discounts';

const DECIDE = { posts: moderate, comments: moderateComment, discounts: moderateDiscount } as const;

/**
 * A section's heading, with how many items wait in it at the end of its line (group 4 redesign, 17-11-2026). The
 * count sits outside the heading, so the section keeps its name; a screen reader hears it from the list itself.
 */
function SectionHeading({ id, count, children }: { id: string; count: number | null; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h3 id={id} className="text-xl leading-tight font-extrabold">
        {children}
      </h3>
      {count !== null && (
        <span
          aria-hidden="true"
          className="shrink-0 rounded-full border-[1.5px] border-outline bg-card px-2.5 py-0.5 text-xs font-semibold tabular-nums"
        >
          {count}
        </span>
      )}
    </div>
  );
}

/** How many items a queue holds, or null while it has no list (loading, failed). */
function countOf(queue: unknown): number | null {
  return Array.isArray(queue) ? queue.length : null;
}

/**
 * Settings → Moderation (the hacks feed, chunk 7; comments since community, chunk 3, discounts students added since
 * chunk 7): the posts, comments and discounts students reported, for the moderator, each in its own section. Hide
 * takes one out of every list; Keep shows it again and starts its report count afresh. Whatever stays hidden is deleted
 * 30 days after hiding by the daily purge (`purge_old_content`, data retention), and the page says so. The database
 * answers only the moderator, in a session that gave the authenticator code; anyone else is told why there is nothing
 * here.
 */
export function ModerationView() {
  const { t } = useT();
  const text = t.tips.hacks.moderation;
  const auth = useAuth();
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  // The queue as read for whom: an answer read for another account never shows.
  const [read, setRead] = useState<{
    userId: string;
    answer: QueueAnswer;
    comments: CommentQueueAnswer;
    discounts: DiscountQueueAnswer;
  } | null>(null);
  // Counts "Try again" taps and decisions: each one reads the queue once more.
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    const supabase = getSupabase();
    if (supabase === null) return;
    let current = true;
    void Promise.all([readQueue(supabase), readCommentQueue(supabase), readDiscountQueue(supabase)]).then(
      ([answer, comments, discounts]) => {
        if (current) setRead({ userId, answer, comments, discounts });
      },
    );
    return () => {
      current = false;
    };
  }, [userId, attempt]);

  if (auth.status === 'loading') return <p className="text-sm text-muted-foreground">{text.loading}</p>;
  if (userId === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{text.signedOut}</p>
        {auth.status !== 'off' && (
          <LinkButton href="/settings/account" icon={CloudIcon}>
            {t.common.toAccount}
          </LinkButton>
        )}
      </div>
    );
  }

  const answer = read !== null && read.userId === userId ? read.answer : null;
  const comments = read !== null && read.userId === userId ? read.comments : null;
  const discounts = read !== null && read.userId === userId ? read.discounts : null;
  if (answer === null) return <p className="text-sm text-muted-foreground">{text.loading}</p>;
  if (answer === 'not-moderator') return <p className="text-sm">{text.notModerator}</p>;
  if (answer === 'needs-code') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{text.needsCode}</p>
        <LinkButton href="/settings/account" icon={CloudIcon}>
          {t.common.toAccount}
        </LinkButton>
      </div>
    );
  }

  async function decide(kind: Kind, id: string, action: 'hide' | 'keep') {
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    const result = await DECIDE[kind](supabase, id, action);
    setBusy(false);
    if (result === 'needs-code' && userId !== null) {
      setRead({ userId, answer: 'needs-code', comments: 'needs-code', discounts: 'needs-code' });
      return;
    }
    setStatus(result === 'done' ? (action === 'hide' ? text.hidden : text.kept) : text.failed);
    if (result === 'done') setAttempt((n) => n + 1);
  }

  /** Every item's last lines: its reports and state, then Hide (unless hidden by hand) and Keep. */
  function decision(
    kind: Kind,
    item: { id: string; reports: number; hiddenByHand: boolean; hiddenByReports: boolean },
  ) {
    return (
      <>
        <p className="text-sm">
          {text.reports(item.reports)} ·{' '}
          {item.hiddenByHand ? text.states.hand : item.hiddenByReports ? text.states.reports : text.states.visible}
        </p>
        {/* Both outlined, side by side (group 4 redesign): neither decision is the default. */}
        <div className="flex flex-wrap gap-2">
          {!item.hiddenByHand && (
            <Button
              type="button"
              variant="outline"
              className="px-4"
              disabled={busy}
              onClick={() => void decide(kind, item.id, 'hide')}
            >
              <EyeOffIcon aria-hidden="true" />
              {text.hide}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="px-4"
            disabled={busy}
            onClick={() => void decide(kind, item.id, 'keep')}
          >
            <CheckIcon aria-hidden="true" />
            {text.keep}
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      <section aria-labelledby="moderation-posts" className="flex flex-col gap-3">
        <SectionHeading id="moderation-posts" count={countOf(answer)}>
          {text.postsHeading}
        </SectionHeading>
        {answer === 'failed' && (
          <div className="flex flex-col gap-2">
            <p role="alert" className="text-sm">
              {text.loadFailed}
            </p>
            <Button type="button" variant="outline" className="self-start px-4" onClick={() => setAttempt((n) => n + 1)}>
              {text.tryAgain}
            </Button>
          </div>
        )}
        {Array.isArray(answer) && answer.length === 0 && <p className="text-sm text-muted-foreground">{text.empty}</p>}
        {Array.isArray(answer) && answer.length > 0 && (
          <ul aria-label={text.queue} className="flex flex-col gap-3">
            {answer.map((item) => {
              const Icon = CATEGORY_ICONS[item.categoryId] ?? OTHER_ICON;
              return (
                // On its category's tint, with the category's tag, as the post is in the feed (group 4 redesign).
                <li
                  key={item.id}
                  className={cn(cardVariants(), 'gap-2')}
                  style={{ backgroundColor: categoryTint(item.categoryId) }}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-outline bg-card px-2.5 py-0.5 text-xs font-semibold">
                      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                      {categoryNameIn(t, item.categoryId)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.tips.hacks.cities[item.city]} · {formatDate(todayIso(new Date(item.createdAt)))}
                    </span>
                  </div>
                  <p lang={item.lang} className="break-words whitespace-pre-line">
                    {item.body}
                  </p>
                  <p className="text-sm font-semibold break-words">
                    {item.username === null ? t.tips.hacks.noName : `@${item.username}`}
                  </p>
                  {decision('posts', item)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="moderation-comments" className="flex flex-col gap-3">
        <SectionHeading id="moderation-comments" count={countOf(comments)}>
          {text.commentsHeading}
        </SectionHeading>
        {comments === 'failed' && (
          <p role="alert" className="text-sm">
            {text.commentsLoadFailed}
          </p>
        )}
        {Array.isArray(comments) && comments.length === 0 && (
          <p className="text-sm text-muted-foreground">{text.commentsEmpty}</p>
        )}
        {Array.isArray(comments) && comments.length > 0 && (
          <ul aria-label={text.commentsQueue} className="flex flex-col gap-3">
            {comments.map((item) => (
              <li key={item.id} className={cn(cardVariants(), 'gap-2')}>
                <p className="text-xs text-muted-foreground">{formatDate(todayIso(new Date(item.createdAt)))}</p>
                <p lang={item.lang} className="break-words whitespace-pre-line">
                  {item.body}
                </p>
                <p className="text-sm font-semibold break-words">
                  {item.username === null ? t.tips.hacks.noName : `@${item.username}`}
                </p>
                {decision('comments', item)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="moderation-discounts" className="flex flex-col gap-3">
        <SectionHeading id="moderation-discounts" count={countOf(discounts)}>
          {text.discountsHeading}
        </SectionHeading>
        {discounts === 'failed' && (
          <p role="alert" className="text-sm">
            {text.discountsLoadFailed}
          </p>
        )}
        {Array.isArray(discounts) && discounts.length === 0 && (
          <p className="text-sm text-muted-foreground">{text.discountsEmpty}</p>
        )}
        {Array.isArray(discounts) && discounts.length > 0 && (
          <ul aria-label={text.discountsQueue} className="flex flex-col gap-3">
            {discounts.map((item) => (
              <li key={item.id} className={cn(cardVariants(), 'gap-2')}>
                <p className="text-xs text-muted-foreground">{formatDate(todayIso(new Date(item.createdAt)))}</p>
                <div lang={item.lang} className="flex flex-col gap-1">
                  <p className="font-semibold break-words">{item.place}</p>
                  <p className="break-words">{item.offer}</p>
                  {item.conditions !== '' && <p className="text-sm break-words text-muted-foreground">{item.conditions}</p>}
                </div>
                {/* The page the student gave, to check the offer against. */}
                <ExternalLinkButton href={item.link} className="break-all">
                  {hostOf(item.link)}
                </ExternalLinkButton>
                <p className="text-sm font-semibold break-words">
                  {item.username === null ? t.tips.hacks.noName : `@${item.username}`}
                </p>
                {decision('discounts', item)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
