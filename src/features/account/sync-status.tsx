'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCwIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import { getSupabase } from '@/lib/supabase/client';
import { syncNow, syncStatusText } from '@/sync/engine';
import { supabaseStore } from '@/sync/store';
import { accountWantsCode } from './code-check';

// Live sync (P2.2), the cut-down version: the person taps Sync now; nothing syncs on a timer. Shown only while this
// phone is linked to an account (`syncState.userId`).

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the phone is online; true on the server and in the first render, so the server render and hydration agree. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

const TICK = 30_000;

function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, TICK);
  return () => clearInterval(timer);
}

/**
 * The time in ms, moved on every half minute, so "Synced 2 min ago" stays true while the page is open. 0 on the
 * server and in the first render: a prerendered page may not read the clock (Cache Components).
 */
function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / TICK) * TICK,
    () => 0,
  );
}

/** This phone's sync status in words, or null while it isn't linked to an account (or the time isn't known yet). */
export function useSyncStatus(): string | null {
  const state = useLiveQuery(() => db.syncState.get('current'), []);
  const waiting = useLiveQuery(() => db.outbox.count(), [], 0);
  const online = useOnline();
  const now = useNow();
  if (!state?.userId || now === 0) return null;
  return syncStatusText({ lastSyncedAt: state.lastSyncedAt, problem: state.problem, waiting, online, now: new Date(now) });
}

/** How long signing out waits for its last sync, so a slow connection never holds the person up for long. */
const SIGN_OUT_SYNC_MS = 8_000;

/**
 * Before signing out: a last sync, so the account has this phone's latest changes, while the phone is linked to the
 * signed-in account and online. It waits at most a few seconds; whatever doesn't make it waits in the outbox for the
 * next sign-in. Never throws.
 */
export async function syncBeforeSignOut(): Promise<void> {
  const supabase = getSupabase();
  if (supabase === null || !navigator.onLine) return;
  try {
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (userId === undefined) return;
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, SIGN_OUT_SYNC_MS));
    await Promise.race([syncNow(supabaseStore(supabase), userId), timeout]);
  } catch (error) {
    console.error('StudentsBudget: the last sync before signing out', error);
  }
}

/** Settings → Your account → Sync: the status, and Sync now. Nothing while this phone isn't linked. */
export function SyncSection() {
  const id = useId();
  const status = useSyncStatus();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As the other account sections: a note goes when the person leaves the page.
  useEffect(() => () => setNote(null), []);

  async function sync() {
    if (inFlight.current) return;
    setNote(null);
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const userId = (await supabase.auth.getSession()).data.session?.user.id;
      if (userId === undefined) return;
      const result = await syncNow(supabaseStore(supabase), userId);
      if (result.kind === 'not-linked') setNote('This phone is linked to another account.');
      // Refused by the account: it may want this session's authenticator code (turned on from another phone). Then the
      // code step takes over, as with Save and Load.
      if (result.kind === 'problem') await accountWantsCode(supabase.auth);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (status === null) return null;
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h3 id={`${id}-heading`} className="text-lg font-semibold">
        Sync
      </h3>
      {/* Always rendered while linked, so a screen reader hears a new status. */}
      <p aria-live="polite" aria-atomic="true" className="text-muted-foreground">
        {note ?? status}
      </p>
      <Button type="button" variant="outline" className="h-10 self-start px-4" disabled={busy} onClick={() => void sync()}>
        <RefreshCwIcon aria-hidden="true" className={busy ? 'animate-spin' : undefined} />
        Sync now
      </Button>
    </section>
  );
}
