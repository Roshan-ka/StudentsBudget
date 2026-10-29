import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAll, replaceAll } from '@/db/bulk';
import { db } from '@/db/db';
import { saveEntry } from '@/db/repo';
import { applyLink, linkPhone, planLink } from './link';
import { push } from './push';
import { expense, fakeStore, liveIds, snapshot } from './test-helpers';
import { applyUpload, planUpload } from './upload';

// Linking over fake-indexeddb (with the real tracking middleware) and the fake store.

const USER = 'user-1';

/** The outbox as "table:id", sorted. */
async function queued(): Promise<string[]> {
  return (await db.outbox.toArray()).map((entry) => `${entry.table}:${entry.id}`).sort();
}

async function linkedTo(): Promise<string | null | undefined> {
  return (await db.syncState.get('current'))?.userId;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('planLink', () => {
  it('does nothing when already linked to this account, and blocks another account', async () => {
    const { store } = fakeStore();
    await db.syncState.put({ id: 'current', userId: USER, cursor: 0, lastSyncedAt: null, problem: null });
    expect(await planLink(store, USER)).toEqual({ kind: 'linked' });
    expect(await planLink(store, 'someone-else')).toEqual({ kind: 'other-account' });
  });

  it('links an empty phone to an empty account, and starts recording changes', async () => {
    const { store } = fakeStore();
    const plan = await planLink(store, USER);
    expect(plan).toEqual({ kind: 'link' });
    await applyLink(store, plan as { kind: 'link' }, USER);
    expect(await linkedTo()).toBe(USER);
    await db.accounts.put(snapshot().accounts[0]);
    expect(await queued()).toEqual(['accounts:local']);
  });

  it('uploads a phone’s data to an empty account, without queueing it again', async () => {
    const { store, tables } = fakeStore();
    await replaceAll(snapshot());
    const plan = await planLink(store, USER);
    expect(plan.kind).toBe('upload');
    if (plan.kind !== 'upload') return;
    await applyLink(store, plan, USER);
    expect(liveIds(tables.entries)).toEqual(['e1', 'e2', 'rec:s1:2026-10-01']);
    expect(liveIds(tables.plans)).toEqual(['current']);
    expect(await linkedTo()).toBe(USER);
    expect(await queued()).toEqual([]);
  });

  it('loads the account’s data onto an empty phone, without queueing it to send back', async () => {
    const { store } = fakeStore();
    const d = snapshot();
    // Saved from another phone, as P2.1's Save wrote it.
    await applyUpload(store, await planUpload(store, d));

    const plan = await planLink(store, USER);
    expect(plan.kind).toBe('download');
    if (plan.kind !== 'download') return;
    expect(plan.account).toBe('2 accounts, 3 entries and your plan');
    await applyLink(store, plan, USER);
    expect((await db.entries.toArray()).map((e) => e.id).sort()).toEqual(['e1', 'e2', 'rec:s1:2026-10-01']);
    expect(await db.plan.get('current')).toEqual(d.plan);
    expect(await linkedTo()).toBe(USER);
    expect(await queued()).toEqual([]);
  });

  it('lets the person choose when both have data, saying what each holds', async () => {
    const { store, tables } = fakeStore({
      accounts: { other: { ...snapshot().accounts[0], id: 'other' } },
      entries: { x1: { ...expense('x1'), accountId: 'other' } },
      plans: { current: snapshot().plan },
    });
    await replaceAll(snapshot());
    const plan = await planLink(store, USER);
    expect(plan.kind).toBe('choose');
    if (plan.kind !== 'choose') return;
    expect(plan.phone).toBe('2 accounts, 3 entries and your plan');
    expect(plan.account).toBe('1 account, 1 entry and your plan');

    // Keeping the phone's data makes the account match the phone: what only the account had goes.
    await applyLink(store, plan, USER, 'phone');
    expect(liveIds(tables.entries)).toEqual(['e1', 'e2', 'rec:s1:2026-10-01']);
    expect(tables.entries.get('x1')).toBeNull();
    expect(liveIds(tables.accounts)).toEqual(['home', 'local']);
    expect(await linkedTo()).toBe(USER);
  });

  it('can keep the account’s data instead, replacing the phone’s', async () => {
    const { store } = fakeStore({
      accounts: { other: { ...snapshot().accounts[0], id: 'other' } },
      entries: { x1: { ...expense('x1'), accountId: 'other' } },
      plans: { current: snapshot().plan },
    });
    await replaceAll(snapshot());
    const plan = await planLink(store, USER);
    if (plan.kind !== 'choose') throw new Error(`expected choose, got ${plan.kind}`);
    await applyLink(store, plan, USER, 'account');
    expect((await db.entries.toArray()).map((e) => e.id)).toEqual(['x1']);
    expect((await db.accounts.toArray()).map((a) => a.id)).toEqual(['other']);
    expect(await queued()).toEqual([]);
  });

  it('refuses to guess when both have data and no choice was made', async () => {
    const { store } = fakeStore({ plans: { current: snapshot().plan } });
    await replaceAll(snapshot());
    const plan = await planLink(store, USER);
    if (plan.kind !== 'choose') throw new Error(`expected choose, got ${plan.kind}`);
    await expect(applyLink(store, plan, USER)).rejects.toThrow('Linking needs a choice');
    expect(await linkedTo()).toBeUndefined();
  });

  it('won’t link an empty phone to an account it can’t take, but a phone with data replaces it', async () => {
    // A save that stopped before the plan was written.
    const half = fakeStore({ entries: { e1: expense('e1') } });
    expect(await planLink(half.store, USER)).toEqual({ kind: 'unfinished' });
    // A row this app can't read.
    const odd = fakeStore({ plans: { current: snapshot().plan }, entries: { e1: { nonsense: true } } });
    expect(await planLink(odd.store, USER)).toEqual({ kind: 'unreadable', problem: "a row of entries isn't the app's data" });

    await replaceAll(snapshot());
    expect((await planLink(half.store, USER)).kind).toBe('upload');
    expect(await linkedTo()).toBeUndefined();
  });
});

describe('once linked', () => {
  it('sends a restored backup with the next push: the account matches the phone again', async () => {
    const { store, tables } = fakeStore();
    await replaceAll(snapshot());
    const plan = await planLink(store, USER);
    if (plan.kind !== 'upload') throw new Error(`expected upload, got ${plan.kind}`);
    await applyLink(store, plan, USER);
    await saveEntry(expense('e3'));

    // Restoring a backup replaces everything; the change tracking records what went and what came.
    const backup = { ...(await exportAll()), entries: [expense('only-in-backup')] };
    await replaceAll(backup);
    await push(store);
    expect(liveIds(tables.entries)).toEqual(['only-in-backup']);
  });
});

describe('linkPhone', () => {
  const noCode = async () => false;

  it('links on its own when one side is empty, and says what moved', async () => {
    const { store, tables } = fakeStore();
    await replaceAll(snapshot());
    expect(await linkPhone(store, USER, noCode)).toEqual({ kind: 'linked', fresh: true, note: "Your account now holds this phone's data." });
    expect(liveIds(tables.plans)).toEqual(['current']);
    expect(await linkPhone(store, USER, noCode)).toEqual({ kind: 'linked', fresh: false, note: null });

    await Promise.all(db.tables.map((table) => table.clear()));
    expect(await linkPhone(store, USER, noCode)).toEqual({
      kind: 'linked',
      fresh: true,
      note: 'Loaded from your account: 2 accounts, 3 entries and your plan.',
    });
    expect(await db.entries.count()).toBe(3);
  });

  it('leaves the choice to the person when both hold data, and writes nothing', async () => {
    const { store, calls } = fakeStore({ plans: { current: snapshot().plan } });
    await replaceAll(snapshot());
    calls.length = 0;
    expect((await linkPhone(store, USER, noCode)).kind).toBe('choose');
    expect(calls.filter((call) => !call.startsWith('list') && !call.startsWith('read'))).toEqual([]);
    expect(await linkedTo()).toBeUndefined();
  });

  it('writes nothing to an account that may only hide its rows until the code is given', async () => {
    const { store, calls } = fakeStore();
    await replaceAll(snapshot());
    expect(await linkPhone(store, USER, async () => true)).toEqual({ kind: 'code' });
    expect(calls.filter((call) => call.startsWith('upsert'))).toEqual([]);
    expect(await linkedTo()).toBeUndefined();
  });

  it('says calmly why it can’t link, and blocks another account', async () => {
    const half = fakeStore({ entries: { e1: expense('e1') } });
    expect(await linkPhone(half.store, USER, noCode)).toMatchObject({ kind: 'problem', problem: expect.stringMatching(/^Your account's last save didn't finish/) });
    await db.syncState.put({ id: 'current', userId: 'someone-else', cursor: 0, lastSyncedAt: null, problem: null });
    expect(await linkPhone(fakeStore().store, USER, noCode)).toEqual({ kind: 'other-account' });
  });

  it('runs one link at a time: a second call gets the first one’s outcome', async () => {
    const { store } = fakeStore();
    const first = linkPhone(store, USER, noCode);
    expect(linkPhone(store, USER, noCode)).toBe(first);
    await first;
  });
});
