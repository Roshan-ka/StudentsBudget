'use client';

import { Dialog } from '@base-ui/react/dialog';
import {
  ArrowBigUpIcon,
  CheckIcon,
  CloudIcon,
  FlagIcon,
  HistoryIcon,
  LanguagesIcon,
  PlusIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ExternalLinkButton, LinkButton, linkButtonClass } from '@/components/link-button';
import { noticeClass } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useAuth } from '@/features/account/use-auth';
import { categoryTint } from '@/features/charts/colors';
import { CATEGORY_ICONS, OTHER_ICON } from '@/features/entries/category-icons';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { CategoryChip } from '@/features/tips/category-chip';
import { categoryNameIn } from '@/i18n/category-name';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { formatDate, formatDateTime, todayIso } from '@/lib/dates';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  hackCategoryIds,
  linkHost,
  readFeed,
  readFeedCache,
  saveFeedCache,
  translateUrl,
  type HackPost,
} from './feed';
import { readCommentCounts } from './comments';
import { HackComments } from './hack-comments';
import { HackForm } from './hack-form';
import { postingNameText } from './posting-name';
import { deleteHack } from './posts';
import { nextVote, reportHack, voteHack, withVote, type VoteButton } from './votes';
import { useFocusAfter } from '@/lib/focus';

/** The list on screen: loaded on this visit, or the one this phone kept from an earlier one. */
/** The list on screen, and whose it is: another account's list never shows or is kept for this one. */
type Shown = { userId: string; posts: HackPost[]; loadedAt: string; fresh: boolean };

/**
 * Tips → Hacks (docs/superpowers/plans/2026-11-05-hacks-feed.md, chunk 4): students' money-saving posts, newest first,
 * for signed-in accounts. Loaded once per visit; when that fails (offline, or the account server can't be reached),
 * the list this phone last loaded for the account shows instead, saying when it was loaded.
 */
export function HacksView() {
  const { t, lang } = useT();
  const text = t.tips.hacks;
  const auth = useAuth();
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Counts "Try again" taps, posts and deletes: each one loads the list once more.
  const [attempt, setAttempt] = useState(0);
  // The post form (chunk 5) in its sheet (16-11-2026), and what a screen reader hears after a post or a delete.
  const [writing, setWriting] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('');
  // How many comments each post has (community, chunk 2), read once per visit with the list.
  const [commentCounts, setCommentCounts] = useState<ReadonlyMap<string, number>>(new Map());

  useEffect(() => {
    if (userId === null) return;
    let current = true;
    void (async () => {
      const kept = readFeedCache(userId);
      // The kept copy only stands in while nothing of this account is on screen: after a post, a delete or Try again,
      // the list as it now is stays until the new one comes, rather than an older copy marked "last loaded" (review,
      // 09-11-2026: a deleted post came back with its Delete button).
      if (current && kept !== null) {
        setShown((now) => (now !== null && now.userId === userId ? now : { ...kept, userId, fresh: false }));
      }
      const supabase = getSupabase();
      const posts = supabase !== null && navigator.onLine ? await readFeed(supabase) : null;
      if (!current) return;
      if (posts === null) {
        setFailed(true);
        return;
      }
      const loadedAt = new Date().toISOString();
      saveFeedCache(userId, posts, loadedAt);
      setShown({ userId, posts, loadedAt, fresh: true });
      setFailed(false);
      // Without the counts the posts still show, each with a plain "Comments".
      const counts = supabase === null ? null : await readCommentCounts(supabase);
      if (current) setCommentCounts(counts ?? new Map());
    })();
    return () => {
      current = false;
    };
  }, [userId, attempt]);

  // While the floating "Post a hack" shows, a focused control scrolls clear of it too (`data-floating-action`, layout).
  // A hidden page's effects clean up, so the mark goes with the page.
  useEffect(() => {
    if (userId === null) return;
    const root = document.documentElement;
    root.dataset.floatingAction = '';
    return () => {
      delete root.dataset.floatingAction;
    };
  }, [userId]);

  // A vote or a report changes the list on screen: the phone keeps that list as it now is.
  useEffect(() => {
    if (shown !== null && shown.userId === userId && shown.fresh) saveFeedCache(shown.userId, shown.posts, shown.loadedAt);
  }, [userId, shown]);

  if (auth.status === 'off') return <p className="text-sm text-muted-foreground">{text.off}</p>;
  if (auth.status === 'loading') return <p className="text-sm text-muted-foreground">{text.loading}</p>;
  if (userId === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{text.intro}</p>
        <p className="text-sm">{text.signedOut}</p>
        <LinkButton href="/settings/account" icon={CloudIcon}>
          {t.common.toAccount}
        </LinkButton>
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
    // Gone at once, here and in the kept copy, whether or not the reload below works.
    update((posts) => posts.filter((post) => post.id !== id));
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
  const mine = shown !== null && shown.userId === userId ? shown : null;
  const posts = mine?.posts ?? null;
  const chips = posts === null ? [] : hackCategoryIds(posts);
  // A chosen category whose posts have all gone shows everything again.
  const chosen = categoryId !== null && chips.includes(categoryId) ? categoryId : null;
  const listed = posts === null ? [] : chosen === null ? posts : posts.filter((post) => post.categoryId === chosen);

  const chip = (id: string | null, label: string) => (
    <CategoryChip
      key={id ?? 'all'}
      categoryId={id}
      label={label}
      pressed={chosen === id}
      onPress={() => setCategoryId(id)}
    />
  );

  return (
    // The end of the list scrolls clear of the floating button (pb-20, on top of main's own padding).
    <div className="flex flex-col gap-4 pb-20">
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      {/* "Post a hack" floats at the bottom (Roshan, 16-11-2026), in the start corner at Ask's bubble's height: the
          bubble keeps the end corner, and the pill's width stops short of it in every language. Inside the Hacks
          panel, so a hidden tab or a hidden page hides it with them. It opens the form as a sheet, as the bubble opens
          Ask; the sheet opens on the text field and gives the focus back to the pill when it closes. */}
      <Dialog.Root
        open={writing}
        onOpenChange={(open) => {
          if (open) setStatus('');
          setWriting(open);
        }}
      >
        <Dialog.Trigger
          ref={pill}
          className="fixed start-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex min-h-14 max-w-[calc(100%-7rem)] items-center gap-2 rounded-full border-[1.5px] border-outline bg-primary px-5 py-2 text-start text-base font-semibold text-primary-foreground shadow-offset outline-none focus-visible:ring-3 focus-visible:ring-ring active:shadow-offset-pressed motion-safe:active:translate-x-0.5 motion-safe:active:translate-y-0.5"
        >
          <PlusIcon aria-hidden="true" className="size-5 shrink-0" />
          {text.form.open}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
          <Dialog.Popup
            ref={sheet}
            initialFocus={() => sheet.current?.querySelector<HTMLElement>('textarea') ?? true}
            finalFocus={pill}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[calc(var(--radius)+0.25rem)] border-[1.5px] border-b-0 border-outline bg-background text-foreground outline-none transition-[translate,opacity] duration-200 max-sm:data-[ending-style]:translate-y-full max-sm:data-[starting-style]:translate-y-full motion-reduce:transition-none sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:mx-auto sm:w-[min(32rem,calc(100%-2rem))] sm:-translate-y-1/2 sm:rounded-[calc(var(--radius)+0.25rem)] sm:border-b-[1.5px] sm:data-[ending-style]:opacity-0 sm:data-[starting-style]:opacity-0"
          >
            <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Dialog.Title className="font-heading text-2xl leading-tight font-extrabold">{text.form.heading}</Dialog.Title>
              <HackForm userId={userId} onPosted={posted} onCancel={() => setWriting(false)} />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
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
      {mine !== null && !mine.fresh && (
        <p className="text-sm text-muted-foreground">{text.lastLoaded(formatDateTime(mine.loadedAt))}</p>
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
            <HackCard
              key={post.id}
              post={post}
              t={t}
              lang={lang}
              onDelete={remove}
              onVote={vote}
              onReport={report}
              commentCount={commentCounts.get(post.id) ?? 0}
              onCommentCount={(count) => setCommentCounts((now) => new Map(now).set(post.id, count))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** What a tap under someone else's post does, waiting for the note on votes the first time on a phone. */
type CardAction = { kind: 'vote'; button: VoteButton } | { kind: 'report' };

/** The two verdicts, each with its icon beside its word. */
const VERDICTS: readonly { button: Exclude<VoteButton, 'up'>; Icon: LucideIcon }[] = [
  { button: 'worked', Icon: CheckIcon },
  { button: 'outdated', Icon: HistoryIcon },
];

/**
 * One post: its category and place, the text in its own language, the link, who wrote it and the votes so far. The
 * author's own post can be deleted, after a question; anyone else's can be voted on (chunk 6) or reported, after a
 * question. The first vote or report on a phone waits for its data-protection note.
 */
function HackCard({
  post,
  t,
  lang,
  onDelete,
  onVote,
  onReport,
  commentCount,
  onCommentCount,
}: {
  post: HackPost;
  t: Messages;
  lang: Language;
  onDelete: (id: string) => Promise<boolean>;
  onVote: (post: HackPost, button: VoteButton) => Promise<string | null>;
  onReport: (post: HackPost) => Promise<string | null>;
  commentCount: number;
  onCommentCount: (count: number) => void;
}) {
  const text = t.tips.hacks;
  const Icon = CATEGORY_ICONS[post.categoryId] ?? OTHER_ICON;
  // A post in another language than the phone's has Translate (chunk 8); its first use waits for its note.
  const translation = post.lang === lang ? null : translateUrl(post.body, lang);
  // Report, Delete and Translate say which post, for a screen reader that lists them (accessibility, chunk 8).
  const posted = formatDate(todayIso(new Date(post.createdAt)));
  const which = post.mine ? text.whichMine(posted) : text.which(post.author ? `@${post.author.username}` : null, posted);
  const [translateNote, setTranslateNote] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askingReport, setAskingReport] = useState(false);
  // Cancel and Keep give the focus back to Report and Delete (accessibility, chunk 5).
  const focus = useFocusAfter();
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

  const author = post.author === null ? text.noName : postingNameText(post.author, t.auth.postingName);

  // The actions in one row of outlined buttons (group 3 redesign, 16-11-2026): Upvote with its count, Worked for me,
  // Outdated, the comments with theirs (`HackComments`), then Report, Delete and Translate. Each keeps its name, and
  // Upvote's count is in its name too ("Upvote (3)"), as the comments' is.
  const before: ReactNode = !post.mine && (
    <div role="group" aria-label={text.vote.group(which)} className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="chip"
        aria-label={text.vote.upCount(post.ups)}
        aria-pressed={post.myUp}
        disabled={busy}
        onClick={() => tap({ kind: 'vote', button: 'up' })}
      >
        <ArrowBigUpIcon aria-hidden="true" className="size-5" />
        {post.ups > 0 && post.ups}
      </Button>
      {VERDICTS.map(({ button, Icon: VerdictIcon }) => (
        <Button
          key={button}
          type="button"
          variant="chip"
          aria-pressed={post.myVerdict === button}
          disabled={busy}
          onClick={() => tap({ kind: 'vote', button })}
        >
          <VerdictIcon aria-hidden="true" />
          {text.vote[button]}
        </Button>
      ))}
    </div>
  );
  const after: ReactNode = (
    <>
      {!post.mine && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          ref={focus.refFor('report')}
          aria-label={text.named(text.report, which)}
          onClick={() => {
            setProblem(null);
            setAskingReport(true);
          }}
        >
          <FlagIcon aria-hidden="true" />
          {text.report}
        </Button>
      )}
      {post.mine && !asking && (
        <Button
          ref={focus.refFor('delete')}
          type="button"
          variant="outline"
          aria-label={text.named(text.delete, which)}
          onClick={() => {
            setProblem(null);
            setAsking(true);
          }}
        >
          <Trash2Icon aria-hidden="true" />
          {text.delete}
        </Button>
      )}
      {translation !== null && (
        <a
          href={translation}
          target="_blank"
          rel="noopener noreferrer"
          // An outlined button that says what it does (16-11-2026: buttons, never text links).
          className={linkButtonClass()}
          onClick={(event) => {
            if (noteSeen('translate')) return;
            event.preventDefault();
            setTranslateNote(true);
          }}
          aria-label={text.named(text.translate, which)}
        >
          <LanguagesIcon aria-hidden="true" />
          {text.translate}
        </a>
      )}
    </>
  );

  return (
    // On its category's tint, as a tip is (group 3 redesign); its text keeps 4.5:1 there (`tokens.test.ts`).
    <li className={cn(cardVariants(), 'gap-2')} style={{ backgroundColor: categoryTint(post.categoryId) }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* The category's icon and name on the card colour; its name is the text. */}
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-outline bg-card px-2.5 py-0.5 text-xs font-semibold">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {categoryNameIn(t, post.categoryId)}
        </span>
        {/* Who and when on the tag's line: the name, "Your post" on one's own, the place and the day. */}
        <span className="text-xs break-words text-muted-foreground">
          <span className="font-semibold text-foreground">{author}</span>
          {post.mine && ` · ${text.yours}`} · {text.cities[post.city]} · {posted}
        </span>
      </div>
      {/* A student's own words, in the language they wrote them in. */}
      <p lang={post.lang} className="break-words whitespace-pre-line">
        {post.body}
      </p>
      {post.link !== null && (
        <ExternalLinkButton href={post.link} className="break-all">
          {linkHost(post.link)}
        </ExternalLinkButton>
      )}
      <p className="text-sm text-muted-foreground">{text.counts(post.ups, post.worked, post.outdated)}</p>
      <HackComments
        postId={post.id}
        post={which}
        count={commentCount}
        t={t}
        lang={lang}
        onCount={onCommentCount}
        before={before}
        after={after}
      >
        {translation !== null && translateNote && (
          <PrivacyNote
            id="translate"
            label={t.common.privacy.label}
            text={t.common.privacy.translate}
            continueLabel={t.common.privacy.continue}
            cancelLabel={t.common.privacy.cancel}
            onContinue={() => {
              setTranslateNote(false);
              // From the same tap, so the browser lets the tab open.
              window.open(translation, '_blank', 'noopener,noreferrer');
            }}
            onCancel={() => setTranslateNote(false)}
          />
        )}
        {askingReport && (
          <div className={noticeClass('muted', 'flex flex-col gap-3')}>
            <p className="text-sm">{text.reportQuestion}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="px-4" autoFocus disabled={busy} onClick={() => tap({ kind: 'report' })}>
                {text.report}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="px-4"
                disabled={busy}
                onClick={() => {
                  focus.mark('report');
                  setAskingReport(false);
                }}
              >
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
        {asking && (
          <div className={noticeClass('muted', 'flex flex-col gap-3')}>
            <p className="text-sm">{text.deleteQuestion}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="px-4" autoFocus disabled={busy} onClick={() => void confirmDelete()}>
                {text.delete}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="px-4"
                disabled={busy}
                onClick={() => {
                  focus.mark('delete');
                  setAsking(false);
                }}
              >
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
      </HackComments>
    </li>
  );
}
