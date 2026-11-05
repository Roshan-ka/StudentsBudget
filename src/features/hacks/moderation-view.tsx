'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useAuth } from '@/features/account/use-auth';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { formatDate, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { moderate, readQueue, type QueueAnswer, type QueueItem } from './moderation';

const linkClass = 'self-start text-sm font-semibold text-primary underline-offset-4 hover:underline';

/**
 * Settings → Moderation (the hacks feed, chunk 7): the posts students reported, for the moderator. Hide takes a post
 * out of every feed; Keep shows it again and starts its report count afresh. The database answers only the
 * moderator, in a session that gave the authenticator code; anyone else is told why there is nothing here.
 */
export function ModerationView() {
  const { t } = useT();
  const text = t.tips.hacks.moderation;
  const auth = useAuth();
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  // The queue as read for whom: an answer read for another account never shows.
  const [read, setRead] = useState<{ userId: string; answer: QueueAnswer } | null>(null);
  // Counts "Try again" taps and decisions: each one reads the queue once more.
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    const supabase = getSupabase();
    if (supabase === null) return;
    let current = true;
    void readQueue(supabase).then((answer) => {
      if (current) setRead({ userId, answer });
    });
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

  async function decide(item: QueueItem, action: 'hide' | 'keep') {
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    const result = await moderate(supabase, item.id, action);
    setBusy(false);
    if (result === 'needs-code' && userId !== null) {
      setRead({ userId, answer: 'needs-code' });
      return;
    }
    setStatus(result === 'done' ? (action === 'hide' ? text.hidden : text.kept) : text.failed);
    if (result === 'done') setAttempt((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
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
              <p className="text-sm">
                {text.reports(item.reports)} ·{' '}
                {item.hiddenByHand ? text.states.hand : item.hiddenByReports ? text.states.reports : text.states.visible}
              </p>
              <div className="flex flex-wrap gap-2">
                {!item.hiddenByHand && (
                  <Button type="button" className="px-4" disabled={busy} onClick={() => void decide(item, 'hide')}>
                    {text.hide}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="px-4"
                  disabled={busy}
                  onClick={() => void decide(item, 'keep')}
                >
                  {text.keep}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
