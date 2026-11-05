'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate, formatDateTime, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { hackCategoryIds, linkHost, readFeed, readFeedCache, saveFeedCache, type HackPost } from './feed';
import { postingNameText } from './posting-name';

/** The list on screen: loaded on this visit, or the one this phone kept from an earlier one. */
type Shown = { posts: HackPost[]; loadedAt: string; fresh: boolean };

/**
 * Tips → Hacks (docs/superpowers/plans/2026-11-05-hacks-feed.md, chunk 4): students' money-saving posts, newest first,
 * for signed-in accounts. Loaded once per visit; when that fails (offline, or the account server can't be reached),
 * the list this phone last loaded for the account shows instead, saying when it was loaded.
 */
export function HacksView() {
  const { t } = useT();
  const text = t.tips.hacks;
  const auth = useAuth();
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Counts "Try again" taps: each one loads the list once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let current = true;
    void (async () => {
      const kept = readFeedCache(userId);
      if (current && kept !== null) setShown({ ...kept, fresh: false });
      const supabase = getSupabase();
      const posts = supabase !== null && navigator.onLine ? await readFeed(supabase) : null;
      if (!current) return;
      if (posts === null) {
        setFailed(true);
        return;
      }
      const loadedAt = new Date().toISOString();
      saveFeedCache(userId, posts, loadedAt);
      setShown({ posts, loadedAt, fresh: true });
      setFailed(false);
    })();
    return () => {
      current = false;
    };
  }, [userId, attempt]);

  if (auth.status === 'off') return <p className="text-sm text-muted-foreground">{text.off}</p>;
  if (auth.status === 'loading') return <p className="text-sm text-muted-foreground">{text.loading}</p>;
  if (userId === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{text.intro}</p>
        <p className="text-sm">{text.signedOut}</p>
        <Link href="/settings/account" className="self-start text-sm font-semibold text-primary underline-offset-4 hover:underline">
          {text.toAccount}
        </Link>
      </div>
    );
  }

  // Another account's list never shows, even for the moment before the effect runs again.
  const posts = shown?.posts ?? null;
  const chips = posts === null ? [] : hackCategoryIds(posts);
  // A chosen category whose posts have all gone shows everything again.
  const chosen = categoryId !== null && chips.includes(categoryId) ? categoryId : null;
  const listed = posts === null ? [] : chosen === null ? posts : posts.filter((post) => post.categoryId === chosen);

  const chip = (id: string | null, label: string) => (
    <Button
      key={id ?? 'all'}
      type="button"
      variant="chip"
      aria-pressed={chosen === id}
      onClick={() => setCategoryId(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {posts === null && !failed && <p className="text-sm text-muted-foreground">{text.loading}</p>}
      {failed && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm">
            {text.loadFailed}
          </p>
          <Button type="button" variant="outline" className="self-start px-4" onClick={() => setAttempt((n) => n + 1)}>
            {text.tryAgain}
          </Button>
        </div>
      )}
      {shown !== null && !shown.fresh && (
        <p className="text-sm text-muted-foreground">{text.lastLoaded(formatDateTime(shown.loadedAt))}</p>
      )}
      {posts !== null && posts.length === 0 && <p className="text-sm text-muted-foreground">{text.empty}</p>}
      {chips.length > 1 && (
        <div role="group" aria-label={text.postsFor} className="flex flex-wrap gap-2">
          {chip(null, t.tips.all)}
          {chips.map((id) => chip(id, categoryNameIn(t, id)))}
        </div>
      )}
      {listed.length > 0 && (
        <ul aria-label={text.posts} className="flex flex-col gap-3">
          {listed.map((post) => (
            <HackCard key={post.id} post={post} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One post: its category and place, the text in its own language, the link, who wrote it and the votes so far. */
function HackCard({ post, t }: { post: HackPost; t: Messages }) {
  const text = t.tips.hacks;
  const Icon = CATEGORY_ICONS[post.categoryId] ?? OTHER_ICON;
  return (
    <li className={cn(cardVariants(), 'gap-2')}>
      <div className="flex flex-wrap items-center gap-2">
        {/* The category's tint and icon, as on a tip; its name is the text. */}
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-outline px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: categoryTint(post.categoryId) }}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {categoryNameIn(t, post.categoryId)}
        </span>
        <span className="text-xs text-muted-foreground">
          {text.cities[post.city]} · {formatDate(todayIso(new Date(post.createdAt)))}
        </span>
      </div>
      {/* A student's own words, in the language they wrote them in. */}
      <p lang={post.lang} className="break-words whitespace-pre-line">
        {post.body}
      </p>
      {post.link !== null && (
        <a
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm font-semibold break-all text-primary underline-offset-4 hover:underline"
        >
          {linkHost(post.link)}
        </a>
      )}
      <p className="text-sm font-semibold break-words">
        {post.author === null ? text.noName : postingNameText(post.author, t.auth.postingName)}
        {post.mine && <span className="font-normal text-muted-foreground"> · {text.yours}</span>}
      </p>
      <p className="text-sm text-muted-foreground">{text.counts(post.ups, post.worked, post.outdated)}</p>
    </li>
  );
}
