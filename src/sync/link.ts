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
