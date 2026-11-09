'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import { syncNow } from '@/sync/engine';
import { linkPhone, linkWithChoice, type LinkChoice, type LinkNote, type LinkOutcome, type LinkProblem } from '@/sync/link';
import { supabaseStore } from '@/sync/store';
import { contentsText } from '@/sync/summary';
import { staleSummary } from '@/sync/upload';
import { wantsCodeBeforeLinking } from './code-check';
import { SyncSection } from './sync-status';

// Linking (P2.2 chunk 7), which replaces P2.1's Save and Load: on the account page, signed in, the phone links to the
// account. An empty side is filled from the other on its own; a phone and an account that both hold data wait for the
// person's choice. Once linked, the Sync section shows how sync stands, with Sync now.

/** Why linking stopped: link.ts's own reasons, or this page's (`failed`: anything thrown; `offline`). */
type PageProblem = LinkProblem | 'failed' | 'offline';

type View =
  | { kind: 'checking' }
  | Exclude<LinkOutcome, { kind: 'code' } | { kind: 'problem' }>
  | { kind: 'problem'; problem: PageProblem };

/** What moved, in words: "Your account now holds this phone's data." or "Loaded from your account: …". */
function noteText(note: LinkNote, t: Messages, lang: Language): string {
  return note.kind === 'uploaded' ? t.sync.link.uploaded : t.sync.link.loaded(contentsText(note.contents, lang));
}

/** The signed-in session's user id, or undefined when there is none. */
async function sessionUserId(): Promise<string | undefined> {
  return (await getSupabase()?.auth.getSession())?.data.session?.user.id;
}

/**
 * Settings → Your account, signed in: links this phone to the account, then shows the Sync section. `onLinked` runs
 * once the phone is linked (the start page goes on from there to Home, or to setup for an empty account).
 */
export function AccountLink({ onLinked }: { onLinked?: () => void } = {}) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.sync.link;
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Counts "Try again" taps: each one links once more.
  const [attempt, setAttempt] = useState(0);
  // The choice's question takes the focus, as Restore's does: a screen reader reads it out, and Enter picks no side.
  const questionRef = useRef<HTMLParagraphElement>(null);
  // After a tap that takes its own button away (a choice, Try again), the focus follows what shows next instead of
  // falling back to the top of the page: "Linking…", then the line on what moved. An alert is read out by itself.
  const followFocus = useRef(false);
  const checkingRef = useRef<HTMLParagraphElement>(null);
  // The user the view on screen was worked out for: a choice is carried out only for that user, never for whoever
  // signed in since in another tab (review, 09-11-2026).
  const viewUser = useRef<string | null>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (view.kind === 'choose') questionRef.current?.focus();
    if (!followFocus.current) return;
    if (view.kind === 'checking') {
      checkingRef.current?.focus();
      return;
    }
    if (view.kind === 'linked') noteRef.current?.focus();
    followFocus.current = false;
  }, [view.kind]);

  // Runs when the page shows, and again when it shows after being hidden: signing in, or another account's sign-in
  // elsewhere in this browser, may have changed what there is to link.
  useEffect(() => {
    let current = true;
    const supabase = getSupabase();
    if (supabase === null) return;
    void (async () => {
      try {
        const userId = await sessionUserId();
        if (userId === undefined) return;
        const store = supabaseStore(supabase);
        // A session that can't be checked stops the link (the catch below says so), rather than link to what may only
        // be an account hiding its rows.
        const outcome = await linkPhone(store, userId, () => wantsCodeBeforeLinking(supabase.auth));
        // The account wants this session's authenticator code first: useAuth shows the code step instead of this page.
        if (!current || outcome.kind === 'code') return;
        viewUser.current = userId;
        setView(outcome);
        // Just linked: one sync, so the status starts from "Synced just now". Nothing syncs on its own after that.
        if (outcome.kind === 'linked' && outcome.fresh) await syncNow(store, userId);
      } catch (error) {
        console.error('StudentsBudget: could not link this phone', error);
        if (current) setView({ kind: 'problem', problem: navigator.onLine ? 'failed' : 'offline' });
      }
    })();
    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (view.kind === 'linked') onLinked?.();
  }, [view.kind, onLinked]);

  function linkAgain() {
    followFocus.current = true;
    setView({ kind: 'checking' });
    setAttempt((count) => count + 1);
  }

  /** Links with the person's choice, when both the phone and the account hold data. */
  async function choose(plan: Extract<View, { kind: 'choose' }>['plan'], choice: LinkChoice) {
    if (inFlight.current) return;
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const userId = await sessionUserId();
      if (userId === undefined) return;
      // Someone else signed in since this choice was worked out: it is worked out again for them.
      if (userId !== viewUser.current) {
        linkAgain();
        return;
      }
      const store = supabaseStore(supabase);
      await linkWithChoice(store, plan, userId, choice);
      await syncNow(store, userId);
      followFocus.current = true;
      setView({
        kind: 'linked',
        fresh: true,
        note: choice === 'phone' ? { kind: 'uploaded' } : { kind: 'loaded', contents: plan.account },
      });
    } catch (error) {
      console.error('StudentsBudget: could not link this phone', error);
      setView({ kind: 'problem', problem: 'failed' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (view.kind === 'checking') {
    return (
      <p ref={checkingRef} tabIndex={-1} className="text-muted-foreground outline-none">
        {text.checking}
      </p>
    );
  }

  if (view.kind === 'linked') {
    return (
      <>
        {view.note !== null && (
          <p ref={noteRef} tabIndex={-1} aria-live="polite" className="text-sm text-muted-foreground outline-none">
            {noteText(view.note, t, lang)}
          </p>
        )}
        <SyncSection />
      </>
    );
  }

  if (view.kind === 'choose') {
    const stale = staleSummary(view.plan.upload, lang);
    const warnings = [stale !== null ? text.staleWarning(stale) : null, text.replaceWarning];
    return (
      <section aria-labelledby={`${id}-heading`} className={cardVariants()}>
        <h3 id={`${id}-heading`} className="text-xl leading-tight font-extrabold">
          {text.heading}
        </h3>
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p ref={questionRef} tabIndex={-1} className="text-sm outline-none">
            {text.question(contentsText(view.plan.phone, lang), contentsText(view.plan.account, lang))}
          </p>
          <p className="text-sm text-muted-foreground">{warnings.filter((w) => w !== null).join(' ')}</p>
          {/* Neither side is the default: both buttons look alike. */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="px-4"
              disabled={busy}
              onClick={() => void choose(view.plan, 'phone')}
            >
              {text.keepPhone}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="px-4"
              disabled={busy}
              onClick={() => void choose(view.plan, 'account')}
            >
              {text.useAccount}
            </Button>
          </div>
          {/* While the choice is carried out: the data moving, then the first sync. */}
          <p role="status" className="text-sm text-muted-foreground">
            {busy ? text.linking : null}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-heading`} className={cardVariants()}>
      <h3 id={`${id}-heading`} className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      {view.kind === 'other-account' ? (
        <p role="alert" className="text-sm">
          {text.otherAccount}
        </p>
      ) : (
        <>
          <p role="alert" className="text-sm">
            {text.problems[view.problem]}
          </p>
          <Button type="button" variant="outline" className="self-start px-4" onClick={linkAgain}>
            {text.tryAgain}
          </Button>
        </>
      )}
    </section>
  );
}
