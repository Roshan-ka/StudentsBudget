import { exportAll, replaceAll, type BackupData } from '@/db/bulk';
import { db } from '@/db/db';
import { downloadContents, planDownload } from './download';
import type { UserDataStore } from './store';
import { contentsOf } from './summary';
import { SERVER_TABLES, serverRowsOf } from './tables';
import { applyUpload, planUpload, type UploadPlan } from './upload';

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
 *   this app can't read), and this phone has nothing to put in their place. Nothing is linked.
 */
export type LinkPlan =
  | { kind: 'linked' }
  | { kind: 'other-account' }
  | { kind: 'link' }
  | { kind: 'upload'; upload: UploadPlan }
  | { kind: 'download'; data: BackupData; account: string }
  | { kind: 'choose'; upload: UploadPlan; data: BackupData; phone: string; account: string }
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
  if (download.kind !== 'ready') {
    // Nothing on the account to load. A phone with data replaces it; an empty phone has nothing to offer instead.
    if (phoneHasData) return { kind: 'upload', upload: await planUpload(store, phone) };
    return download.kind === 'unfinished' ? { kind: 'unfinished' } : { kind: 'unreadable', problem: download.problem };
  }
  const account = downloadContents(download.data);
  if (!phoneHasData) return { kind: 'download', data: download.data, account };
  return {
    kind: 'choose',
    upload: await planUpload(store, phone),
    data: download.data,
    phone: contentsOf(phone.accounts.length, phone.entries.length, phone.plan !== null),
    account,
  };
}

/** Which side wins when both have data: this phone's (`phone`) or the account's (`account`). */
export type LinkChoice = 'phone' | 'account';

/**
 * How linking on the account page ended: linked (`fresh` when just now, with a line on what moved, if anything), a choice for the person, a
 * phone blocked by another account's data, a problem in words, or `code`: the account wants this session's
 * authenticator code before it shows its rows, so the code step takes over.
 */
export type LinkOutcome =
  | { kind: 'linked'; fresh: boolean; note: string | null }
  | { kind: 'choose'; plan: Extract<LinkPlan, { kind: 'choose' }> }
  | { kind: 'other-account' }
  | { kind: 'problem'; problem: string }
  | { kind: 'code' };

const UNFINISHED =
  "Your account's last save didn't finish, and this phone has no data to put in its place, so it isn't linked yet.";
const UNREADABLE = "Your account holds data this app can't read, so this phone isn't linked. An app update may help.";

let linking: Promise<LinkOutcome> | null = null;

/**
 * Links this phone to the account of `userId` as far as it can on its own, one run at a time (a call while one runs
 * gets that one's outcome): an empty side is filled from the other, and only a phone and an account that both hold
 * data wait for the person's choice. An account that looks empty may only hide its rows until this session gives
 * its authenticator code (`wantsCode`, which refreshes the session): then nothing is written.
 */
export function linkPhone(store: UserDataStore, userId: string, wantsCode: () => Promise<boolean>): Promise<LinkOutcome> {
  linking ??= linkWhatItCan(store, userId, wantsCode).finally(() => {
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
      return { kind: 'problem', problem: UNFINISHED };
    case 'unreadable':
      console.error('StudentsBudget: the account holds data the app cannot load:', plan.problem);
      return { kind: 'problem', problem: UNREADABLE };
  }
  if (plan.kind !== 'download' && (await wantsCode())) return { kind: 'code' };
  await applyLink(store, plan, userId);
  if (plan.kind === 'upload') return { kind: 'linked', fresh: true, note: "Your account now holds this phone's data." };
  if (plan.kind === 'download') return { kind: 'linked', fresh: true, note: `Loaded from your account: ${plan.account}.` };
  return { kind: 'linked', fresh: true, note: null };
}

/**
 * Carries out a plan from `planLink`, then links the phone: the sync state names the account, with the cursor at 0, so
 * the change tracking starts and the next sync pulls everything once. The data moves before the link, so neither an
 * upload nor a load is recorded as this phone's changes. `choice` is needed for `choose` only.
 */
export async function applyLink(
  store: UserDataStore,
  plan: Extract<LinkPlan, { kind: 'link' | 'upload' | 'download' | 'choose' }>,
  userId: string,
  choice?: LinkChoice,
): Promise<void> {
  if (plan.kind === 'upload' || (plan.kind === 'choose' && choice === 'phone')) await applyUpload(store, plan.upload);
  else if (plan.kind === 'download' || (plan.kind === 'choose' && choice === 'account')) await replaceAll(plan.data);
  else if (plan.kind === 'choose') throw new Error('Linking needs a choice: keep the phone’s data or the account’s.');
  await db.syncState.put({ id: 'current', userId, cursor: 0, lastSyncedAt: null, problem: null });
}
