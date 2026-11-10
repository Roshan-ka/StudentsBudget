import { db } from '@/db/db';
import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';
import { formatDateTime } from '@/lib/dates';
import { BUSY, withSyncLock, withSyncLockIfFree } from './lock';
import { heldBack, problemText, type SyncProblem } from './problem';
import { pull } from './pull';
import { push } from './push';
import { StoreError, type UserDataStore } from './store';
import { bringBackUsedAccounts } from './used-accounts';

/**
 * How a sync ended: done (rows sent, and rows taken from the account), or not run because this phone isn't linked to
 * the signed-in account or is offline, or stopped with a problem (a code, see problem.ts), which `syncState` keeps for
 * the status.
 */
export type SyncResult =
  | { kind: 'synced'; sent: number; received: number }
  | { kind: 'not-linked' }
  | { kind: 'offline' }
  | { kind: 'problem'; problem: SyncProblem };

/** An automatic sync's result: a sync's, or `busy` when another tab held the lock and it didn't run. */
export type AutoSyncResult = SyncResult | { kind: 'busy' };

/** This tab's sync, while one runs: a second call gets its result instead of starting another. */
let running: Promise<SyncResult> | null = null;

/** Who hears every finished sync of this tab, whoever started it (`onSyncDone`). */
const doneListeners = new Set<(result: SyncResult) => void>();

/**
 * Calls `listener` with the result of every sync this tab finishes, whether Sync now, setup's Save, sign-out or an
 * automatic run started it, so automatic sync counts a sync it didn't start (automatic sync, chunk 1). Returns the
 * way to stop listening.
 */
export function onSyncDone(listener: (result: SyncResult) => void): () => void {
  doneListeners.add(listener);
  return () => {
    doneListeners.delete(listener);
  };
}

function announce(run: Promise<SyncResult>): void {
  void run.then(
    (result) => {
      for (const listener of [...doneListeners]) listener(result);
    },
    () => {},
  );
}

/** `run` as this tab's sync until it ends; only its own end clears it, never a later sync's. */
function track(run: Promise<SyncResult>): Promise<SyncResult> {
  running = run;
  announce(run);
  void run
    .finally(() => {
      if (running === run) running = null;
    })
    .catch(() => {});
  return run;
}

/**
 * Syncs this phone with the account of `userId` (P2.2): its changes first (push), then the account's (pull), then the
 * accounts this phone deleted, which wait for the pull in case another phone booked on one meanwhile. One sync
 * at a time: a call while one runs gets that one's result, and another tab's sync is waited for (the lock). It runs
 * only while this phone is linked to that account and online, and records when it last synced, or what stopped it,
 * in `syncState`. Sync now, setup's Save, sign-out and the first sync after linking call it; automatic runs use
 * `syncIfFree`.
 */
export function syncNow(store: UserDataStore, userId: string): Promise<SyncResult> {
  return running ?? track(withSyncLock(() => sync(store, userId)));
}

/**
 * An automatic sync (automatic sync, chunk 1, docs/superpowers/plans/2026-11-10-automatic-sync.md): this tab's sync
 * when one runs, else one under the lock if no tab holds it, else `busy` at once, without waiting: the tab holding
 * the lock is syncing or linking anyway.
 */
export async function syncIfFree(store: UserDataStore, userId: string): Promise<AutoSyncResult> {
  if (running !== null) return running;
  const outcome = await withSyncLockIfFree(() => {
    // Never `syncNow` or `running` in here: a Sync now tapped while this asked for the lock is queued behind this very
    // lock, and waiting for it would never end. Such a Sync now simply runs after this one.
    const run = sync(store, userId);
    if (running === null) track(run);
    else announce(run);
    return run;
  });
  return outcome === BUSY ? { kind: 'busy' } : outcome;
}

async function sync(store: UserDataStore, userId: string): Promise<SyncResult> {
  const state = await db.syncState.get('current');
  if (state?.userId !== userId) return { kind: 'not-linked' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
  try {
    const pushed = await push(store, { holdAccountDeletes: true });
    const pulled = await pull(store);
    if (pulled.kind === 'invalid') return await stopped(pulled.problem);
    // An account deleted here that a pulled entry now uses comes back from the account; the other deletes go below.
    await bringBackUsedAccounts(store);
    // A pull can queue a row to go back (an account another phone deleted while this one still uses it), and the
    // account deletes held above still wait: sent now. The rows push held back stay queued, so only more than those
    // means something is left to send.
    const again = (await db.outbox.count()) > pushed.held ? await push(store) : null;
    const held = again?.held ?? pushed.held;
    // Synced, but a change this app's own checks refuse stays on the phone: said, so it isn't lost unnoticed.
    const problem = held > 0 ? heldBack(held) : null;
    await db.syncState.update('current', { lastSyncedAt: new Date().toISOString(), problem });
    if (problem !== null) return { kind: 'problem', problem };
    const sent = pushed.sent + pushed.deleted + (again ? again.sent + again.deleted : 0);
    return { kind: 'synced', sent, received: pulled.applied };
  } catch (error) {
    console.error('StudentsBudget: sync', error);
    return stopped(syncErrorProblem(error));
  }
}

async function stopped(problem: SyncProblem): Promise<SyncResult> {
  await db.syncState.update('current', { problem });
  return { kind: 'problem', problem };
}

/** What stopped a sync that didn't finish. Whatever it was, this phone's changes are kept for the next one. */
export function syncErrorProblem(error: unknown): SyncProblem {
  return error instanceof StoreError && error.status === 401 ? 'signed-out' : 'failed';
}

/**
 * What the status line needs: the sync state, how many changes wait, whether the phone is online, and the time.
 * `problem` is as stored: a code, or a sentence an earlier version stored.
 */
export type SyncStatusInput = {
  lastSyncedAt: string | null;
  problem: string | null;
  waiting: number;
  online: boolean;
  now: Date;
};

/**
 * The status line under Sync now, in `lang`: "Synced just now.", "Synced 2 min ago. 3 changes waiting.", "Offline: 1
 * change waits on this phone.", "Not synced yet.", or the problem that stopped the last sync.
 */
export function syncStatusText(
  { lastSyncedAt, problem, waiting, online, now }: SyncStatusInput,
  lang: Language = 'en',
): string {
  const text = MESSAGES[lang].sync.status;
  if (!online) return waiting === 0 ? text.offline : text.offlineWaiting(waiting);
  if (problem !== null) return problemText(problem, lang);
  const state = lastSyncedAt === null ? text.notYet : text.synced(ago(lastSyncedAt, now, lang));
  return text.line(state, waiting);
}

/**
 * The sync status for the signed-in user `userId`, in `lang`: null while the phone isn't linked (`linkedTo` is the
 * account it is linked to), and a line saying so when it is linked to another account, whose status isn't this user's.
 */
export function accountSyncStatus(
  linkedTo: string | null | undefined,
  userId: string,
  input: SyncStatusInput,
  lang: Language = 'en',
): string | null {
  if (!linkedTo) return null;
  return linkedTo === userId ? syncStatusText(input, lang) : MESSAGES[lang].sync.status.otherAccount;
}

/**
 * What a screen reader hears once after Sync now, in `lang`: how the tap ended. The status line isn't announced (its
 * clock moves every half minute), and these words never match it, so the two can be told apart.
 */
export function syncResultText(result: SyncResult, lang: Language = 'en'): string {
  const text = MESSAGES[lang].sync.result;
  switch (result.kind) {
    case 'synced':
      return text.finished;
    case 'offline':
      return text.offline;
    case 'not-linked':
      return text.otherAccount;
    case 'problem':
      return text.problem(problemText(result.problem, lang));
  }
}

/** "just now", "2 min ago", or the day and time for anything an hour old or more. */
function ago(iso: string, now: Date, lang: Language): string {
  const text = MESSAGES[lang].sync.status;
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(minutes)) return text.before;
  if (minutes < 1) return text.justNow;
  if (minutes < 60) return text.minutesAgo(minutes);
  return text.at(formatDateTime(iso));
}
