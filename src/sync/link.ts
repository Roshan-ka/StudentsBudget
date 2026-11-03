import { exportAll, replaceAll, type BackupData } from '@/db/bulk';
import { db } from '@/db/db';
import type { OutboxEntry } from '@/db/types';
import { planDownload } from './download';
import { withSyncLock } from './lock';
import { push } from './push';
import type { UserDataStore } from './store';
import { contentsOf, type Contents } from './summary';
import { dexieHome, dexieSync, SERVER_TABLES, serverRowsOf, type ServerTable } from './tables';
import { planUpload, type UploadPlan } from './upload';

/**
 * What linking this phone to the signed-in account will do (P2.2), worked out before anything is written. Linking
 * replaces P2.1's Save and Load: their logic decides who wins the first time, and from then on Sync now keeps both
 * sides alike.
 *
 * - `linked`: already linked to this account; nothing to do.
 * - `other-account`: linked to another account. Blocked, so no data is ever mixed between accounts.
 * - `link`: neither side has data.
 * - `upload`: only this phone has data; the account gets it.
 * - `download`: only the account has data; this phone gets it.
 * - `choose`: both have data. The person picks which to keep, told what each holds and what keeping the phone's
 *   would delete from the account.
 * - `unfinished` / `unreadable`: the account holds rows this phone can't take (a save that stopped halfway, or rows
 *   this app can't read, with what is wrong for the log), and this phone has nothing to put in their place. Nothing is
 *   linked.
 */
export type LinkPlan =
  | { kind: 'linked' }
  | { kind: 'other-account' }
  | { kind: 'link' }
  | { kind: 'upload'; upload: UploadPlan }
  | { kind: 'download'; data: BackupData; account: Contents }
  | { kind: 'choose'; upload: UploadPlan; data: BackupData; phone: Contents; account: Contents }
  | { kind: 'unfinished' }
  | { kind: 'unreadable'; problem: string };

/** Whether a snapshot holds anything the account would keep (the categories and ECB rates don't count). */
function hasData(d: BackupData): boolean {
  const rows = serverRowsOf(d);
  return SERVER_TABLES.some((table) => rows[table].length > 0);
}

/** Works out what linking this phone to the account of `userId` will do. Reads the account; writes nothing. */
export async function planLink(store: UserDataStore, userId: string): Promise<LinkPlan> {
  const state = await db.syncState.get('current');
  if (state?.userId === userId) return { kind: 'linked' };
  if (state?.userId) return { kind: 'other-account' };

  const phone = await exportAll();
  const phoneHasData = hasData(phone);
  const download = await planDownload(store, phone);
  if (download.kind === 'empty') return phoneHasData ? { kind: 'upload', upload: await planUpload(store, phone) } : { kind: 'link' };
  // Data this app can't read may be another phone's, from a newer version: never replaced, whatever this phone holds.
  if (download.kind === 'invalid') return { kind: 'unreadable', problem: download.problem };
  if (download.kind !== 'ready') {
    // A first upload that stopped before the plan: its rows are a part copy, so a phone with data replaces them; an
    // empty phone has nothing to offer instead.
    if (phoneHasData) return { kind: 'upload', upload: await planUpload(store, phone) };
    return { kind: 'unfinished' };
  }
  const account = contentsOf(download.data);
  if (!phoneHasData) return { kind: 'download', data: download.data, account };
  return { kind: 'choose', upload: await planUpload(store, phone), data: download.data, phone: contentsOf(phone), account };
}

/** Which side wins when both have data: this phone's (`phone`) or the account's (`account`). */
export type LinkChoice = 'phone' | 'account';

/** What moved when linking: this phone's data to the account, or the account's (what it holds) onto the phone. */
export type LinkNote = { kind: 'uploaded' } | { kind: 'loaded'; contents: Contents };

/** Why linking stopped on its own: the account's last save didn't finish, or it holds data this app can't read. */
export type LinkProblem = 'unfinished' | 'unreadable';

/**
 * How linking on the account page ended: linked (`fresh` when just now, with what moved, if anything), a choice for
 * the person, a phone blocked by another account's data, a problem, or `code`: the account wants this session's
 * authenticator code before it shows its rows, so the code step takes over. The page words the note and the problem.
 */
export type LinkOutcome =
  | { kind: 'linked'; fresh: boolean; note: LinkNote | null }
  | { kind: 'choose'; plan: Extract<LinkPlan, { kind: 'choose' }> }
  | { kind: 'other-account' }
  | { kind: 'problem'; problem: LinkProblem }
  | { kind: 'code' };

let linking: Promise<LinkOutcome> | null = null;

/**
 * Links this phone to the account of `userId` as far as it can on its own, one run at a time (a call while one runs
 * gets that one's outcome): an empty side is filled from the other, and only a phone and an account that both hold
 * data wait for the person's choice. An account that looks empty may only hide its rows until this session gives
 * its authenticator code (`wantsCode`, which refreshes the session): then nothing is written.
 */
export function linkPhone(store: UserDataStore, userId: string, wantsCode: () => Promise<boolean>): Promise<LinkOutcome> {
  linking ??= withSyncLock(() => linkWhatItCan(store, userId, wantsCode)).finally(() => {
    linking = null;
  });
  return linking;
}

async function linkWhatItCan(store: UserDataStore, userId: string, wantsCode: () => Promise<boolean>): Promise<LinkOutcome> {
  const plan = await planLink(store, userId);
  switch (plan.kind) {
    case 'linked':
      return { kind: 'linked', fresh: false, note: null };
    case 'other-account':
      return { kind: 'other-account' };
    case 'choose':
      return { kind: 'choose', plan };
    case 'unfinished':
      return { kind: 'problem', problem: 'unfinished' };
    case 'unreadable':
      console.error('StudentsBudget: the account holds data the app cannot load:', plan.problem);
      return { kind: 'problem', problem: 'unreadable' };
  }
  if (plan.kind !== 'download' && (await wantsCode())) return { kind: 'code' };
  await applyLink(store, plan, userId);
  if (plan.kind === 'upload') return { kind: 'linked', fresh: true, note: { kind: 'uploaded' } };
  if (plan.kind === 'download') return { kind: 'linked', fresh: true, note: { kind: 'loaded', contents: plan.account } };
  return { kind: 'linked', fresh: true, note: null };
}

/**
 * Carries out a plan from `planLink` and links the phone: the sync state names the account, with the cursor at 0, so
 * the change tracking starts and the next sync pulls everything once. `choice` is needed for `choose` only. A phone
 * linked to this account already changes nothing (a second tap on a choice shown before, another tab that linked).
 *
 * - The phone's data (`upload`, or `choose` with `phone`) goes as the phone is now, not as it was planned: the link
 *   and a queued send of every row it has, and a delete of each row only the account had, are one transaction, then a
 *   push sends them. A push that stops halfway leaves the rest queued for the next sync.
 * - The account's data (`download`, or `choose` with `account`) replaces the phone's before the link, so the load is
 *   not recorded as this phone's change.
 */
export async function applyLink(
  store: UserDataStore,
  plan: Extract<LinkPlan, { kind: 'link' | 'upload' | 'download' | 'choose' }>,
  userId: string,
  choice?: LinkChoice,
): Promise<void> {
  if ((await db.syncState.get('current'))?.userId === userId) return;
  if (plan.kind === 'upload' || (plan.kind === 'choose' && choice === 'phone')) {
    await linkAndQueue(plan.upload.stale, userId);
    await push(store);
    return;
  }
  if (plan.kind === 'download' || (plan.kind === 'choose' && choice === 'account')) await replaceAll(plan.data);
  else if (plan.kind === 'choose') throw new Error('Linking needs a choice: keep the phone’s data or the account’s.');
  await db.syncState.put({ id: 'current', userId, cursor: 0, lastSyncedAt: null, problem: null });
}

/** `applyLink` with the person's choice (`choose`), under the sync lock, so no other tab syncs or links meanwhile. */
export function linkWithChoice(
  store: UserDataStore,
  plan: Extract<LinkPlan, { kind: 'choose' }>,
  userId: string,
  choice: LinkChoice,
): Promise<void> {
  return withSyncLock(() => applyLink(store, plan, userId, choice));
}

/** Links the phone, and in the same transaction queues every row it has and a delete of each `stale` id. */
async function linkAndQueue(stale: Record<ServerTable, string[]>, userId: string): Promise<void> {
  const homes = SERVER_TABLES.map((table) => ({ table, home: dexieHome(table) }));
  await db.transaction('rw', [...homes.map(({ home }) => db.table(home.dexie)), db.outbox, db.syncState], async () => {
    const seq = Date.now();
    const queue: OutboxEntry[] = [];
    for (const { table, home } of homes) {
      const sync = dexieSync(home.dexie);
      if (sync === null) continue;
      const here = (await db.table(home.dexie).toCollection().primaryKeys()).map(sync.idOf);
      const ids = new Set([...here.filter((id): id is string => id !== null), ...stale[table]]);
      for (const id of ids) queue.push({ table, id, seq });
    }
    await db.outbox.bulkPut(queue);
    await db.syncState.put({ id: 'current', userId, cursor: 0, lastSyncedAt: null, problem: null });
  });
}
