'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import { describedBy } from '@/lib/described-by';
import { formatDate, todayIso } from '@/lib/dates';
import { useFocusAfter } from '@/lib/focus';
import { getSupabase } from '@/lib/supabase/client';
import {
  checkComment,
  COMMENT_MAX,
  deleteComment,
  postComment,
  readComments,
  reportComment,
  type HackComment,
} from './comments';
import { translateUrl } from './feed';
import { postingNameText } from './posting-name';

/**
 * A post's comments (docs/superpowers/plans/2026-11-11-community.md, chunk 2): "Comments (n)" opens them, oldest first,
 * with a short form under them. They load when opened, and again after a comment, a delete or a report. The first
 * comment on a phone waits for the `post` note, and the first report for the `hackVotes` note, as on a post.
 */
export function HackComments({
  postId,
  count,
  t,
  lang,
  onCount,
}: {
  postId: string;
  count: number;
  t: Messages;
  lang: Language;
  /** The count as this phone now knows it, after a comment, a delete or a report. */
  onCount: (count: number) => void;
}) {
  const id = useId();
  const text = t.tips.hacks.comments;
  const [open, setOpen] = useState(false);
  // Null while loading; 'failed' when it couldn't.
  const [comments, setComments] = useState<HackComment[] | 'failed' | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [postNote, setPostNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function load() {
    setComments(null);
    const supabase = getSupabase();
    const loaded = supabase !== null && navigator.onLine ? await readComments(supabase, postId) : null;
    setComments(loaded ?? 'failed');
    if (loaded !== null) onCount(loaded.length);
  }

  function toggle() {
    if (!open) void load();
    setOpen(!open);
    setStatus('');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  /** `noteAccepted` comes from the note's Continue, so blocked storage can't loop the note. */
  async function submit(noteAccepted = false) {
    if (inFlight.current) return;
    setError(null);
    setStatus('');
    const checked = checkComment(draft);
    if (!checked.ok) return setError(text.errors[checked.problem]);
    if (!navigator.onLine) return setError(text.errors.offline);
    const supabase = getSupabase();
    if (supabase === null) return;
    if (!noteAccepted && !noteSeen('post')) return setPostNote(true);
    setPostNote(false);

    inFlight.current = true;
    setBusy(true);
    try {
      const result = await postComment(supabase, postId, checked.body, lang);
      if (result === 'posted') {
        setDraft('');
        setStatus(text.posted);
        await load();
        return;
      }
      if (result === 'needs-username') return setError(text.nameFirst);
      const said = {
        'daily-limit': text.errors.dailyLimit,
        gone: text.errors.gone,
        invalid: text.errors.invalid,
        failed: text.errors.failed,
      };
      setError(said[result]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** After a delete or a report: what a screen reader hears, and the list as it now is. */
  async function changed(said: string) {
    setStatus(said);
    await load();
  }

  const listId = `${id}-comments`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        className="self-start px-3"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
      >
        {text.toggle(count)}
      </Button>
      <div id={listId} hidden={!open} className="flex flex-col gap-3 border-s-2 border-outline ps-3">
        {open && comments === null && <p className="text-sm text-muted-foreground">{text.loading}</p>}
        {open && comments === 'failed' && <p className="text-sm text-muted-foreground">{text.loadFailed}</p>}
        {open && Array.isArray(comments) && comments.length === 0 && (
          <p className="text-sm text-muted-foreground">{text.none}</p>
        )}
        {open && Array.isArray(comments) && comments.length > 0 && (
          <ul aria-label={text.list} className="flex flex-col gap-3">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} t={t} lang={lang} onChanged={changed} />
            ))}
          </ul>
        )}
        {open && (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
            <Label htmlFor={`${id}-body`}>{text.body}</Label>
            <Textarea
              id={`${id}-body`}
              lang={lang}
              rows={2}
              maxLength={COMMENT_MAX + 50}
              aria-invalid={error !== null || undefined}
              aria-describedby={describedBy(`${id}-hint`, error !== null && errorId)}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <p id={`${id}-hint`} className="text-sm text-muted-foreground">
              {text.bodyHint}
            </p>
            {error !== null && (
              <p id={errorId} role="alert" className="text-sm font-medium">
                {error}
              </p>
            )}
            {postNote ? (
              <PrivacyNote
                id="post"
                label={t.common.privacy.label}
                text={t.common.privacy.post}
                continueLabel={t.common.privacy.continue}
                cancelLabel={t.common.privacy.cancel}
                onContinue={() => void submit(true)}
                onCancel={() => setPostNote(false)}
              />
            ) : (
              <Button type="submit" variant="outline" className="self-start px-4" disabled={busy}>
                {text.post}
              </Button>
            )}
          </form>
        )}
        {status !== '' && <StatusLine className="text-sm">{status}</StatusLine>}
      </div>
    </div>
  );
}

/** One comment: who wrote it and when, its text in its own language, and Translate, Report or Delete. */
function CommentItem({
  comment,
  t,
  lang,
  onChanged,
}: {
  comment: HackComment;
  t: Messages;
  lang: Language;
  onChanged: (said: string) => Promise<void>;
}) {
  const hacks = t.tips.hacks;
  const text = hacks.comments;
  const written = formatDate(todayIso(new Date(comment.createdAt)));
  // Report, Delete and Translate say which comment, for a screen reader that lists them (accessibility, chunk 8).
  const which = comment.mine
    ? text.whichMine(written)
    : text.which(comment.author ? `@${comment.author.username}` : null, written);
  const translation = comment.lang === lang ? null : translateUrl(comment.body, lang);
  const focus = useFocusAfter();
  const [asking, setAsking] = useState<'delete' | 'report' | null>(null);
  const [reportNote, setReportNote] = useState(false);
  const [translateNote, setTranslateNote] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    const result = await deleteComment(supabase, comment.id);
    setBusy(false);
    setAsking(null);
    if (result === 'deleted') await onChanged(text.deleted);
    else setProblem(text.deleteFailed);
  }

  async function confirmReport() {
    setReportNote(false);
    const supabase = getSupabase();
    if (supabase === null) return;
    setBusy(true);
    const result = await reportComment(supabase, comment.id);
    setBusy(false);
    setAsking(null);
    if (result === 'failed') setProblem(text.reportFailed);
    else await onChanged(result === 'gone' ? text.errors.gone : text.reported);
  }

  function tapReport() {
    if (noteSeen('hackVotes')) void confirmReport();
    else setReportNote(true);
  }

  function cancel(key: 'delete' | 'report') {
    focus.mark(key);
    setAsking(null);
    setReportNote(false);
  }

  return (
    <li className="flex flex-col gap-1">
      <p className="text-sm font-semibold break-words">
        {comment.author === null ? hacks.noName : postingNameText(comment.author, t.auth.postingName)}
        <span className="font-normal text-muted-foreground">
          {' '}
          · {written}
          {comment.mine && ` · ${text.yours}`}
        </span>
      </p>
      {/* A student's own words, in the language they wrote them in. */}
      <p lang={comment.lang} className="text-sm break-words whitespace-pre-line">
        {comment.body}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {translation !== null && (
          <a
            href={translation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={(event) => {
              if (noteSeen('translate')) return;
              event.preventDefault();
              setTranslateNote(true);
            }}
            aria-label={hacks.named(hacks.translate, which)}
          >
            {hacks.translate}
          </a>
        )}
        {asking === null && (
          <Button
            ref={focus.refFor(comment.mine ? 'delete' : 'report')}
            type="button"
            variant="ghost"
            className="px-3"
            disabled={busy}
            aria-label={hacks.named(comment.mine ? hacks.delete : hacks.report, which)}
            onClick={() => {
              setProblem(null);
              setAsking(comment.mine ? 'delete' : 'report');
            }}
          >
            {comment.mine ? hacks.delete : hacks.report}
          </Button>
        )}
      </div>
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
      {asking !== null && !reportNote && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p className="text-sm">{asking === 'delete' ? text.deleteQuestion : text.reportQuestion}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="px-4"
              autoFocus
              disabled={busy}
              onClick={() => (asking === 'delete' ? void confirmDelete() : tapReport())}
            >
              {asking === 'delete' ? hacks.delete : hacks.report}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={() => cancel(asking)}>
              {asking === 'delete' ? hacks.keep : hacks.reportCancel}
            </Button>
          </div>
        </div>
      )}
      {reportNote && (
        <PrivacyNote
          id="hackVotes"
          label={t.common.privacy.label}
          text={t.common.privacy.hackVotes}
          continueLabel={t.common.privacy.continue}
          cancelLabel={t.common.privacy.cancel}
          onContinue={() => void confirmReport()}
          onCancel={() => cancel('report')}
        />
      )}
      {problem !== null && (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      )}
    </li>
  );
}
