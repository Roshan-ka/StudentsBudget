'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate, formatDateTime, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { hackCategoryIds, linkHost, readFeed, readFeedCache, saveFeedCache, type HackPost } from './feed';
import { HackForm } from './hack-form';
import { postingNameText } from './posting-name';
import { deleteHack } from './posts';
import { nextVote, reportHack, voteHack, withVote, type VoteButton } from './votes';

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
  // Counts "Try again" taps, posts and deletes: each one loads the list once more.
  const [attempt, setAttempt] = useState(0);
  // The post form (chunk 5), and what a screen reader hears after a post or a delete.
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState('');

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

  // A vote or a report changes the list on screen: the phone keeps that list as it now is.
  useEffect(() => {
    if (userId !== null && shown !== null && shown.fresh) saveFeedCache(userId, shown.posts, shown.loadedAt);
  }, [userId, shown]);

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

  function posted() {
    setWriting(false);
    setStatus(text.form.posted);
    setAttempt((n) => n + 1);
  }

  /** Deletes one of the account's own posts; true once it is gone. */
  async function remove(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase === null || (await deleteHack(supabase, id)) !== 'deleted') return false;
    setStatus(text.deleted);
    setAttempt((n) => n + 1);
    return true;
  }

  /** Changes the posts on screen, from the newest list (two quick taps never undo each other). */
  function update(change: (posts: HackPost[]) => HackPost[]) {
    setShown((current) => (current === null ? current : { ...current, posts: change(current.posts) }));
  }

  /** A post that was deleted or hidden meanwhile, or that this account reported, leaves the list. */
  function drop(id: string, said: string) {
    update((posts) => posts.filter((post) => post.id !== id));
    setStatus(said);
  }

  /** Saves a tap on a vote button: null once saved, else what to say under the post. */
  async function vote(post: HackPost, button: VoteButton): Promise<string | null> {
    const supabase = getSupabase();
    if (supabase === null) return text.voteFailed;
    const next = nextVote(post, button);
    const result = await voteHack(supabase, post.id, next);
    if (result === 'failed') return text.voteFailed;
    if (result === 'gone') drop(post.id, text.gone);
    else update((posts) => posts.map((shownPost) => (shownPost.id === post.id ? withVote(shownPost, next) : shownPost)));
    return null;
  }

  /** Reports a post, which leaves this account's list at once: null once done, else what to say under the post. */
  async function report(post: HackPost): Promise<string | null> {
    const supabase = getSupabase();
    if (supabase === null) return text.reportFailed;
    const result = await reportHack(supabase, post.id);
    if (result === 'failed') return text.reportFailed;
    drop(post.id, result === 'reported' ? text.reported : text.gone);
    return null;
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
      {writing ? (
        <HackForm userId={userId} onPosted={posted} onCancel={() => setWriting(false)} />
      ) : (
        <Button
          type="button"
          className="self-start px-4"
          onClick={() => {
            setStatus('');
            setWriting(true);
          }}
        >
          {text.form.open}
        </Button>
      )}
      {/* Always rendered, so a screen reader is already listening when the text appears. */}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
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
            <HackCard key={post.id} post={post} t={t} onDelete={remove} onVote={vote} onReport={report} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** What a tap under someone else's post does, waiting for the note on votes the first time on a phone. */
type CardAction = { kind: 'vote'; button: VoteButton } | { kind: 'report' };

const VOTE_BUTTONS: readonly VoteButton[] = ['up', 'worked', 'outdated'];

/**
 * One post: its category and place, the text in its own language, the link, who wrote it and the votes so far. The
 * author's own post can be deleted, after a question; anyone else's can be voted on (chunk 6) or reported, after a
 * question. The first vote or report on a phone waits for its data-protection note.
 */
function HackCard({
  post,
  t,
  onDelete,
  onVote,
  onReport,
}: {
  post: HackPost;
  t: Messages;
  onDelete: (id: string) => Promise<boolean>;
  onVote: (post: HackPost, button: VoteButton) => Promise<string | null>;
  onReport: (post: HackPost) => Promise<string | null>;
}) {
  const text = t.tips.hacks;
  const Icon = CATEGORY_ICONS[post.categoryId] ?? OTHER_ICON;
  const [asking, setAsking] = useState(false);
  const [askingReport, setAskingReport] = useState(false);
  const [pending, setPending] = useState<CardAction | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    const gone = await onDelete(post.id);
    setBusy(false);
    if (!gone) setProblem(text.deleteFailed);
    setAsking(false);
  }

  async function act(action: CardAction) {
    setPending(null);
    setAskingReport(false);
    setProblem(null);
    setBusy(true);
    const said = action.kind === 'vote' ? await onVote(post, action.button) : await onReport(post);
    setBusy(false);
    setProblem(said);
  }

  function tap(action: CardAction) {
    if (noteSeen('hackVotes')) void act(action);
    else setPending(action);
  }

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
      {!post.mine && (
        <div role="group" aria-label={text.vote.group} className="flex flex-wrap gap-2">
          {VOTE_BUTTONS.map((button) => (
            <Button
              key={button}
              type="button"
              variant="chip"
              aria-pressed={button === 'up' ? post.myUp : post.myVerdict === button}
              disabled={busy}
              onClick={() => tap({ kind: 'vote', button })}
            >
              {text.vote[button]}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="px-3"
            disabled={busy}
            onClick={() => {
              setProblem(null);
              setAskingReport(true);
            }}
          >
            {text.report}
          </Button>
        </div>
      )}
      {askingReport && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p className="text-sm">{text.reportQuestion}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="px-4" autoFocus disabled={busy} onClick={() => tap({ kind: 'report' })}>
              {text.report}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={() => setAskingReport(false)}>
              {text.reportCancel}
            </Button>
          </div>
        </div>
      )}
      {pending !== null && (
        <PrivacyNote
          id="hackVotes"
          label={t.common.privacy.label}
          text={t.common.privacy.hackVotes}
          continueLabel={t.common.privacy.continue}
          cancelLabel={t.common.privacy.cancel}
          onContinue={() => void act(pending)}
          onCancel={() => setPending(null)}
        />
      )}
      {post.mine && !asking && (
        <Button
          type="button"
          variant="outline"
          className="self-start px-4"
          onClick={() => {
            setProblem(null);
            setAsking(true);
          }}
        >
          {text.delete}
        </Button>
      )}
      {asking && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p className="text-sm">{text.deleteQuestion}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="px-4" autoFocus disabled={busy} onClick={() => void confirmDelete()}>
              {text.delete}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={() => setAsking(false)}>
              {text.keep}
            </Button>
          </div>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
    </li>
  );
}
