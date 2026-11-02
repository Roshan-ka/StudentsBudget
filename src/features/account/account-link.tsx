'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getSupabase } from '@/lib/supabase/client';
import { syncNow } from '@/sync/engine';
import { linkPhone, linkWithChoice, type LinkChoice, type LinkOutcome } from '@/sync/link';
import { supabaseStore } from '@/sync/store';
import { staleSummary } from '@/sync/upload';
import { wantsCodeBeforeLinking } from './code-check';
import { SyncSection } from './sync-status';

// Linking (P2.2 chunk 7), which replaces P2.1's Save and Load: on the account page, signed in, the phone links to the
// account. An empty side is filled from the other on its own; a phone and an account that both hold data wait for the
// person's choice. Once linked, the Sync section shows how sync stands, with Sync now.

type View = { kind: 'checking' } | Exclude<LinkOutcome, { kind: 'code' }>;

const COULD_NOT_LINK = "Couldn't link this phone to your account. Check your connection and try again.";

/** The signed-in session's user id, or undefined when there is none. */
async function sessionUserId(): Promise<string | undefined> {
  return (await getSupabase()?.auth.getSession())?.data.session?.user.id;
}

/** Settings → Your account, signed in: links this phone to the account, then shows the Sync section. */
export function AccountLink() {
  const id = useId();
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
        setView(outcome);
        // Just linked: one sync, so the status starts from "Synced just now". Nothing syncs on its own after that.
        if (outcome.kind === 'linked' && outcome.fresh) await syncNow(store, userId);
      } catch (error) {
        console.error('StudentsBudget: could not link this phone', error);
        if (current) {
          setView({
            kind: 'problem',
            problem: navigator.onLine ? COULD_NOT_LINK : "You're offline. Linking this phone needs a connection.",
          });
        }
      }
    })();
    return () => {
      current = false;
    };
  }, [attempt]);

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
      const store = supabaseStore(supabase);
      await linkWithChoice(store, plan, userId, choice);
      await syncNow(store, userId);
      followFocus.current = true;
      setView({
        kind: 'linked',
        fresh: true,
        note: choice === 'phone' ? "Your account now holds this phone's data." : `Loaded from your account: ${plan.account}.`,
      });
    } catch (error) {
      console.error('StudentsBudget: could not link this phone', error);
      setView({ kind: 'problem', problem: COULD_NOT_LINK });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (view.kind === 'checking') {
    return (
      <p ref={checkingRef} tabIndex={-1} className="text-muted-foreground outline-none">
        Linking this phone to your account…
      </p>
    );
  }

  if (view.kind === 'linked') {
    return (
      <>
        {view.note !== null && (
          <p ref={noteRef} tabIndex={-1} aria-live="polite" className="text-sm text-muted-foreground outline-none">
            {view.note}
          </p>
        )}
        <SyncSection />
      </>
    );
  }

  if (view.kind === 'choose') {
    const stale = staleSummary(view.plan.upload);
    return (
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
        <h3 id={`${id}-heading`} className="text-lg font-semibold">
          Link this phone
        </h3>
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-4 py-3">
          <p ref={questionRef} tabIndex={-1} className="text-sm outline-none">
            {`This phone and your account both hold data. This phone: ${view.plan.phone}. Your account: ${view.plan.account}. Which should both keep?`}
          </p>
          <p className="text-sm text-muted-foreground">
            {stale !== null &&
              `Keeping this phone's data deletes what only your account has (${stale}) from your account, and from your other phones when they next sync. `}
            Using your account&apos;s data replaces everything on this phone. Want a copy first? Export a backup under
            Settings → Backup.
          </p>
          {/* Neither side is the default: both buttons look alike. */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              disabled={busy}
              onClick={() => void choose(view.plan, 'phone')}
            >
              Keep this phone&apos;s data
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4"
              disabled={busy}
              onClick={() => void choose(view.plan, 'account')}
            >
              Use my account&apos;s data
            </Button>
          </div>
          {/* While the choice is carried out: the data moving, then the first sync. */}
          <p role="status" className="text-sm text-muted-foreground">
            {busy ? 'Linking this phone…' : ''}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Link this phone
      </h3>
      {view.kind === 'other-account' ? (
        <p role="alert" className="text-sm">
          This phone holds another account&apos;s data, so it stays apart from this one. To sync it, sign out and sign in
          with that account. To use this account here instead, delete everything on this phone (Settings → Backup); changes
          not synced yet are lost.
        </p>
      ) : (
        <>
          <p role="alert" className="text-sm">
            {view.problem}
          </p>
          <Button type="button" variant="outline" className="h-10 self-start px-4" onClick={linkAgain}>
            Try again
          </Button>
        </>
      )}
    </section>
  );
}
