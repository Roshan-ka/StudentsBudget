'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import {
  checkDraft,
  draftOf,
  EMPTY_DRAFT,
  postingNameText,
  readPostingName,
  savePostingName,
  type PostingName,
  type PostingNameDraft,
} from './posting-name';
import { PostingNameFields } from './posting-name-fields';

/**
 * Your account → "Your name on posts": the @username, label and batch other students see next to this account's
 * posts, read from the account and changed here. An account made before sign-up asked for them (or whose name was
 * taken meanwhile) has none yet, and picks one here or before its first post.
 */
export function PostingNameCard({ userId }: { userId: string }) {
  const id = useId();
  const { t } = useT();
  const text = t.auth.postingName;
  const [name, setName] = useState<PostingName | null | 'loading' | 'failed'>('loading');
  const [draft, setDraft] = useState<PostingNameDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Said out loud by a screen reader when it changes.
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // The form just closed: its button takes the focus, since the one that had it is gone.
  const focusButton = useRef(false);

  // Read when the page shows, and again when it shows after being hidden: another phone may have changed it.
  useEffect(() => {
    let current = true;
    const supabase = getSupabase();
    if (supabase === null) return;
    void readPostingName(supabase).then((read) => {
      if (current) setName(read);
    });
    return () => {
      current = false;
      setDraft(null);
      setError(null);
      setStatus('');
    };
  }, [userId]);

  function open() {
    setStatus('');
    setError(null);
    setDraft(typeof name === 'object' && name !== null ? draftOf(name) : EMPTY_DRAFT);
  }

  function close() {
    focusButton.current = true;
    setDraft(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null || inFlight.current) return;
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setError(text.errors[checked.problem]);
      return;
    }
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await savePostingName(supabase, userId, checked.name);
      if (saved !== 'saved') {
        setError(saved === 'taken' ? text.errors.taken : text.errors.saveFailed);
        return;
      }
      setName(checked.name);
      close();
      setStatus(text.saved);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const focusIfClosed = (element: HTMLButtonElement | null) => {
    if (element !== null && focusButton.current) {
      focusButton.current = false;
      element.focus();
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className={cardVariants()}>
      <h3 id={`${id}-heading`} className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      <p className="text-sm text-muted-foreground">{text.intro}</p>

      {name === 'loading' && <p className="text-sm text-muted-foreground">{text.loading}</p>}
      {name === 'failed' && <p className="text-sm text-muted-foreground">{text.loadFailed}</p>}
      {draft === null && name === null && <p className="text-sm">{text.none}</p>}
      {draft === null && typeof name === 'object' && name !== null && (
        <p className="font-semibold break-words">{postingNameText(name, text)}</p>
      )}

      {draft !== null ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <PostingNameFields draft={draft} onChange={setDraft} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="px-4" disabled={busy}>
              {text.save}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={close}>
              {text.cancel}
            </Button>
          </div>
        </form>
      ) : (
        (name === null || (typeof name === 'object' && name !== null)) && (
          <Button ref={focusIfClosed} type="button" variant="outline" className="self-start px-4" onClick={open}>
            {name === null ? text.pick : text.change}
          </Button>
        )
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
    </section>
  );
}
