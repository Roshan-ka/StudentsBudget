'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getSupabase } from '@/lib/supabase/client';
import { syncNow } from '@/sync/engine';
import { applyLink, linkPhone, type LinkChoice, type LinkOutcome } from '@/sync/link';
import { supabaseStore } from '@/sync/store';
import { staleSummary } from '@/sync/upload';
import { accountWantsCode } from './code-check';
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
        const outcome = await linkPhone(store, userId, () => accountWantsCode(supabase.auth));
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
      await applyLink(store, plan, userId, choice);
      await syncNow(store, userId);
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
    return <p className="text-muted-foreground">Linking this phone to your account…</p>;
  }

  if (view.kind === 'linked') {
    return (
      <>
        {view.note !== null && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
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
          <p id={`${id}-question`} className="text-sm">
            {`This phone and your account both hold data. This phone: ${view.plan.phone}. Your account: ${view.plan.account}. Which should both keep?`}
          </p>
          <p className="text-sm text-muted-foreground">
            {stale !== null && `Keeping this phone's data deletes what only your account has: ${stale}. `}
            Using your account&apos;s data replaces everything on this phone. Want a copy first? Export a backup under
            Settings → Backup.
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Focused when the question opens, and described by it, so a screen reader reads the question out. */}
            <Button
              type="button"
              className="h-10 px-4"
              autoFocus
              aria-describedby={`${id}-question`}
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
          This phone holds another account&apos;s data, so it stays apart from this one. To use this account here, sign
          out and sign in with the other one, or delete everything on this phone first (Settings → Backup).
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
