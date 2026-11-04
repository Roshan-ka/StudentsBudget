'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCwIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import { accountSyncStatus, syncNow, syncResultText, syncStatusText } from '@/sync/engine';
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

/**
 * This phone's sync status in words, in the phone's language, or null while it isn't linked to an account (or the
 * time isn't known yet). Given the signed-in user's id, a phone linked to another account says so instead of that
 * account's status.
 */
export function useSyncStatus(userId?: string): string | null {
  const { lang } = useT();
  const state = useLiveQuery(() => db.syncState.get('current'), []);
  const waiting = useLiveQuery(() => db.outbox.count(), [], 0);
  const online = useOnline();
  const now = useNow();
  if (!state?.userId || now === 0) return null;
  const input = { lastSyncedAt: state.lastSyncedAt, problem: state.problem, waiting, online, now: new Date(now) };
  return userId === undefined ? syncStatusText(input, lang) : accountSyncStatus(state.userId, userId, input, lang);
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
  const { t, lang } = useT();
  const status = useSyncStatus();
  const [note, setNote] = useState<string | null>(null);
  // How the last tap ended, for screen readers only (`syncResultText`).
  const [announced, setAnnounced] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  // As the other account sections: a note goes when the person leaves the page.
  useEffect(
    () => () => {
      setNote(null);
      setAnnounced('');
    },
    [],
  );

  async function sync() {
    if (inFlight.current) return;
    setNote(null);
    // Emptied first, so the same words twice in a row are announced twice.
    setAnnounced('');
    const supabase = getSupabase();
    if (supabase === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const userId = (await supabase.auth.getSession()).data.session?.user.id;
      if (userId === undefined) return;
      const result = await syncNow(supabaseStore(supabase), userId);
      setAnnounced(syncResultText(result, lang));
      if (result.kind === 'not-linked') setNote(t.sync.status.otherAccount);
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
        {t.sync.section.heading}
      </h3>
      {/* Not a live region: "Synced 2 min ago" moves on every half minute, and would be read out each time. */}
      <p className="text-muted-foreground">{note ?? status}</p>
      <Button type="button" variant="outline" className="self-start px-4" disabled={busy} onClick={() => void sync()}>
        <RefreshCwIcon aria-hidden="true" className={busy ? 'motion-safe:animate-spin' : undefined} />
        {t.sync.section.syncNow}
      </Button>
      {/* Always rendered, so each tap's result is read out once. */}
      <p role="status" className="sr-only">
        {announced}
      </p>
    </section>
  );
}
