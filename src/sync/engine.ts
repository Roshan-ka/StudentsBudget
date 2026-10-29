import { db } from '@/db/db';
import { formatDateTime } from '@/lib/dates';
import { pull } from './pull';
import { push } from './push';
import { StoreError, type UserDataStore } from './store';
import { count } from './summary';

/**
 * How a sync ended: done (rows sent, and rows taken from the account), or not run because this phone isn't linked to
 * the signed-in account or is offline, or stopped with a problem in words, which `syncState` keeps for the status.
 */
export type SyncResult =
  | { kind: 'synced'; sent: number; received: number }
  | { kind: 'not-linked' }
  | { kind: 'offline' }
  | { kind: 'problem'; problem: string };

let running: Promise<SyncResult> | null = null;

/**
 * Syncs this phone with the account of `userId` (P2.2): its changes first (push), then the account's (pull). One sync
 * at a time: a call while one runs gets that one's result. It runs only while this phone is linked to that account
 * and online, and records when it last synced, or what stopped it, in `syncState`. Nothing calls it on a timer yet:
 * the person taps Sync now.
 */
export function syncNow(store: UserDataStore, userId: string): Promise<SyncResult> {
  running ??= sync(store, userId).finally(() => {
    running = null;
  });
  return running;
}

async function sync(store: UserDataStore, userId: string): Promise<SyncResult> {
  const state = await db.syncState.get('current');
  if (state?.userId !== userId) return { kind: 'not-linked' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
  try {
    const pushed = await push(store);
    const pulled = await pull(store);
    if (pulled.kind === 'invalid') return await stopped(pulled.problem);
    await db.syncState.update('current', { lastSyncedAt: new Date().toISOString(), problem: null });
    return { kind: 'synced', sent: pushed.sent + pushed.deleted, received: pulled.applied };
  } catch (error) {
    console.error('StudentsBudget: sync', error);
    return stopped(syncErrorMessage(error));
  }
}

async function stopped(problem: string): Promise<SyncResult> {
  await db.syncState.update('current', { problem });
  return { kind: 'problem', problem };
}

/** Calm text for a sync that didn't finish. Whatever stopped it, this phone's changes are kept for the next one. */
export function syncErrorMessage(error: unknown): string {
  if (error instanceof StoreError && error.status === 401) {
    return 'Your sign-in has run out. Sign out and in again; your changes wait on this phone.';
  }
  return "Couldn't sync just now. Your changes wait on this phone; try again.";
}

/** What the status line needs: the sync state, how many changes wait, whether the phone is online, and the time. */
export type SyncStatusInput = {
  lastSyncedAt: string | null;
  problem: string | null;
  waiting: number;
  online: boolean;
  now: Date;
};

/**
 * The status line under Sync now: "Synced just now.", "Synced 2 min ago. 3 changes waiting.", "Offline: 1 change waits
 * on this phone.", "Not synced yet.", or the problem that stopped the last sync.
 */
export function syncStatusText({ lastSyncedAt, problem, waiting, online, now }: SyncStatusInput): string {
  const changes = count(waiting, 'change', 'changes');
  if (!online) {
    if (waiting === 0) return 'Offline. Changes made now wait on this phone.';
    return `Offline: ${changes} ${waiting === 1 ? 'waits' : 'wait'} on this phone.`;
  }
  if (problem !== null) return problem;
  const when = lastSyncedAt === null ? 'Not synced yet' : `Synced ${ago(lastSyncedAt, now)}`;
  return waiting === 0 ? `${when}.` : `${when}. ${changes} waiting.`;
}

/** "just now", "2 min ago", or the day and time for anything an hour old or more. */
function ago(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(minutes)) return 'before';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `on ${formatDateTime(iso)}`;
}
