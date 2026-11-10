import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { liveQuery } from 'dexie';
import { db } from '@/db/db';
import { getSupabase } from '@/lib/supabase/client';
import { initialSchedule, type OutboxShape } from '@/sync/auto-schedule';
import { createAutoRunner, heldOf, outcomeOf, type AutoRunner, type RunDone, type VisitReason, type VisitResult } from '@/sync/auto-runner';
import { onSyncDone, syncIfFree } from '@/sync/engine';
import { supabaseStore, type UserDataStore } from '@/sync/store';
import { authStateOf } from './auth-state';
import { accountWantsCode } from './code-check';

// Automatic sync in the browser (automatic sync, chunk 3, docs/superpowers/plans/2026-11-10-automatic-sync.md): the
// runner (auto-runner.ts) wired to the page (visible, hidden, online, offline), the outbox and the link (Dexie
// liveQuery), the session (supabase-js) and every finished sync (`onSyncDone`). AppInit starts it (chunk 4) and asks it
// about each visit (chunk 5). One per tab: `startAutoSync` again stops the one before.

/** The outbox's shape: how many rows wait, and the newest `seq`. */
export async function outboxShape(): Promise<OutboxShape> {
  const rows = await db.outbox.toArray();
  return { count: rows.length, newest: rows.reduce((newest, row) => Math.max(newest, row.seq), 0) };
}

export type RunOnceDeps = {
  session: () => Promise<Session | null>;
  store: () => UserDataStore;
  refresh: Pick<SupabaseClient['auth'], 'refreshSession'>;
  /** The first failure in a row: only then is the account asked whether it now wants the code. */
  firstFailure: () => boolean;
};

/**
 * One automatic sync: as the session stands (signed out, or the code owed, runs nothing), then `syncIfFree`. A first
 * failure may be the account wanting this session's code, turned on from another phone: the session is refreshed, and
 * useAuth then shows the code step, as after a refused Sync now.
 */
export async function runOnce(deps: RunOnceDeps): Promise<RunDone> {
  const state = authStateOf(await deps.session());
  if (state.status !== 'signed-in') {
    const outcome = state.status === 'second-step' ? 'second-step' : 'signed-out';
    return { outcome, outbox: await outboxShape(), held: 0 };
  }
  const result = await syncIfFree(deps.store(), state.userId);
  let outcome = outcomeOf(result);
  if (outcome === 'failed' && deps.firstFailure() && (await accountWantsCode(deps.refresh))) outcome = 'second-step';
  return { outcome, outbox: await outboxShape(), held: heldOf(result) };
}

let current: AutoRunner | null = null;

/** Starts this tab's automatic sync; the returned function stops it. Nothing without the Supabase settings. */
export function startAutoSync(): () => void {
  current?.stop();
  const supabase = getSupabase();
  if (supabase === null) return () => {};

  let failures = 0;
  let ownRun = false;
  const runner = createAutoRunner({
    now: () => Date.now(),
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
    initial: initialSchedule(document.visibilityState === 'visible', navigator.onLine),
    run: async () => {
      ownRun = true;
      try {
        const done = await runOnce({
          session: async () => (await supabase.auth.getSession()).data.session,
          store: () => supabaseStore(supabase),
          refresh: supabase.auth,
          firstFailure: () => failures === 0,
        });
        failures = done.outcome === 'failed' ? failures + 1 : 0;
        return done;
      } finally {
        ownRun = false;
      }
    },
  });
  current = runner;

  const onVisibility = () => runner.dispatch({ type: document.visibilityState === 'visible' ? 'visible' : 'hidden' });
  const onOnline = () => runner.dispatch({ type: 'online' });
  const onOffline = () => runner.dispatch({ type: 'offline' });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // After the sign-out wipe deletes the database, a query fails: nothing is left to sync then.
  const quiet = () => {};
  const outbox = liveQuery(outboxShape).subscribe((shape) => runner.dispatch({ type: 'outbox', outbox: shape }), quiet);
  const link = liveQuery(() => db.syncState.get('current')).subscribe(
    (state) => runner.dispatch({ type: 'link', userId: state?.userId ?? null }),
    quiet,
  );
  // Only the state is passed on: supabase-js must not be called from inside its own callback.
  const auth = supabase.auth.onAuthStateChange((_event, session) => {
    const state = authStateOf(session);
    runner.dispatch({ type: 'auth', status: state.status, userId: state.status === 'signed-in' ? state.userId : null });
  });
  // A sync it didn't start (Sync now, setup's Save) counts too.
  const stopHearing = onSyncDone((result) => {
    if (ownRun) return;
    failures = 0;
    void outboxShape().then(
      (shape) => runner.heard({ outcome: outcomeOf(result), outbox: shape, held: heldOf(result) }),
      quiet,
    );
  });

  return () => {
    runner.stop();
    if (current === runner) current = null;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    outbox.unsubscribe();
    link.unsubscribe();
    auth.data.subscription.unsubscribe();
    stopHearing();
  };
}

/** How this visit stands for the start order and the week gate (chunk 5); 'unlinked' with no automatic sync running. */
export function visitAutoSync(reason: VisitReason): Promise<VisitResult> {
  return current?.visit(reason) ?? Promise.resolve('unlinked');
}

/** Holds automatic runs while sign-out asks about changes not yet in the account; `resumeAutoSync` lets them go on. */
export function pauseAutoSync(): void {
  current?.dispatch({ type: 'pause' });
}

export function resumeAutoSync(): void {
  current?.dispatch({ type: 'resume' });
}
