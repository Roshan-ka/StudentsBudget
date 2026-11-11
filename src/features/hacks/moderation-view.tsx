'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useAuth } from '@/features/account/use-auth';
import { hostOf } from '@/features/setup/steps/range-source';
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

const linkClass = 'self-start text-sm font-semibold text-primary underline-offset-4 hover:underline';

/**
 * Settings → Moderation (the hacks feed, chunk 7; comments since community, chunk 3, discounts students added since
 * chunk 7): the posts, comments and discounts students reported, for the moderator, each in its own section. Hide
 * takes one out of every list; Keep shows it again and starts its report count afresh. The database answers only the
 * moderator, in a session that gave the authenticator code; anyone else is told why there is nothing here.
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
          <Link href="/settings/account" className={linkClass}>
            {t.tips.hacks.toAccount}
          </Link>
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
        <Link href="/settings/account" className={linkClass}>
          {t.tips.hacks.toAccount}
        </Link>
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
        <div className="flex flex-wrap gap-2">
          {!item.hiddenByHand && (
            <Button type="button" className="px-4" disabled={busy} onClick={() => void decide(kind, item.id, 'hide')}>
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
        <h3 id="moderation-posts" className="text-xl leading-tight font-extrabold">
          {text.postsHeading}
        </h3>
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
            {answer.map((item) => (
              <li key={item.id} className={cn(cardVariants(), 'gap-2')}>
                <p className="text-xs text-muted-foreground">
                  {categoryNameIn(t, item.categoryId)} · {t.tips.hacks.cities[item.city]} ·{' '}
                  {formatDate(todayIso(new Date(item.createdAt)))}
                </p>
                <p lang={item.lang} className="break-words whitespace-pre-line">
                  {item.body}
                </p>
                <p className="text-sm font-semibold break-words">
                  {item.username === null ? t.tips.hacks.noName : `@${item.username}`}
                </p>
                {decision('posts', item)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="moderation-comments" className="flex flex-col gap-3">
        <h3 id="moderation-comments" className="text-xl leading-tight font-extrabold">
          {text.commentsHeading}
        </h3>
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
        <h3 id="moderation-discounts" className="text-xl leading-tight font-extrabold">
          {text.discountsHeading}
        </h3>
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
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit text-sm break-all text-primary underline underline-offset-4"
                >
                  {hostOf(item.link)}
                </a>
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
