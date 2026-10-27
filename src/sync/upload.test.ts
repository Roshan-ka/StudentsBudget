import { describe, expect, it } from 'vitest';
import { StoreError, type UserDataStore } from './store';
import { SERVER_TABLES, serverRowsOf } from './tables';
import { expense, fakeStore, liveIds, MANUAL, snapshot } from './test-helpers';
import { applyUpload, planUpload, saveErrorMessage, staleSummary, uploadSummary } from './upload';

describe('serverRowsOf', () => {
  it('gives every table its rows, keyed the way Dexie keys them, with the row itself as data', () => {
    const d = snapshot();
    const rows = serverRowsOf(d);
    expect(Object.keys(rows)).toEqual([...SERVER_TABLES]);
    expect(rows.accounts.map((r) => r.id)).toEqual(['local', 'home']);
    expect(rows.entries.map((r) => r.id)).toEqual(['e1', 'e2', 'rec:s1:2026-10-01']);
    expect(rows.entries[0].data).toBe(d.entries[0]);
    expect(rows.plans).toEqual([{ id: 'current', data: d.plan }]);
    expect(rows.guesses.map((r) => r.id)).toEqual(['food']);
    expect(rows.week_results.map((r) => r.id)).toEqual(['2026-10-12']);
    expect(rows.discount_votes.map((r) => r.id)).toEqual(['cinema-student']);
    expect(rows.profiles).toEqual([{ id: 'current', data: d.profile }]);
  });

  it('sends a manual rate, keyed by its currency, but never the ECB rates or the built-in categories', () => {
    const rows = serverRowsOf(snapshot());
    expect(rows.manual_rates).toEqual([{ id: 'INR', data: MANUAL }]);
    expect(JSON.stringify(rows)).not.toContain('"source":"ecb"');
    expect(Object.keys(rows)).not.toContain('categories');
  });

  it('has no plan or profile row before they exist', () => {
    const rows = serverRowsOf(snapshot({ plan: null, profile: null }));
    expect(rows.plans).toEqual([]);
    expect(rows.profiles).toEqual([]);
  });
});

describe('planUpload and applyUpload', () => {
  it('fill an empty account with every row, and write before deleting', async () => {
    const { store, tables, calls } = fakeStore();
    const plan = await planUpload(store, snapshot());
    expect(staleSummary(plan)).toBeNull();
    // Working out the save only reads.
    expect(calls.every((call) => call.startsWith('list '))).toBe(true);

    await applyUpload(store, plan);
    expect([...tables.entries.keys()]).toEqual(['e1', 'e2', 'rec:s1:2026-10-01']);
    expect([...tables.manual_rates.keys()]).toEqual(['INR']);
    expect(tables.plans.get('current')).toEqual(snapshot().plan);
    expect(calls.some((call) => call.startsWith('tombstone '))).toBe(false);
  });

  it('a second save of the same data writes the same rows again and deletes nothing', async () => {
    const { store, tables } = fakeStore();
    await applyUpload(store, await planUpload(store, snapshot()));
    const again = await planUpload(store, snapshot());
    expect(staleSummary(again)).toBeNull();
    await applyUpload(store, again);
    expect(tables.entries.size).toBe(3);
  });

  it('removes from the account what was deleted on the phone, after writing the rest', async () => {
    const { store, tables, calls } = fakeStore();
    await applyUpload(store, await planUpload(store, snapshot()));
    calls.length = 0;

    const plan = await planUpload(store, snapshot({ entries: [expense('e1')] }));
    expect(plan.stale.entries).toEqual(['e2', 'rec:s1:2026-10-01']);
    expect(staleSummary(plan)).toBe('2 entries');
    await applyUpload(store, plan);

    expect(liveIds(tables.entries)).toEqual(['e1']);
    // Deleted as tombstones: the rows stay without data, so other phones learn of the delete.
    expect(tables.entries.get('e2')).toBeNull();
    const firstRemove = calls.findIndex((call) => call.startsWith('tombstone '));
    const lastUpsert = calls.findLastIndex((call) => call.startsWith('upsert '));
    expect(firstRemove).toBeGreaterThan(lastUpsert);
  });

  it('writes the plan last, and deletes entries before the accounts they could point at', async () => {
    const { store, calls } = fakeStore({ accounts: { gone: {} }, entries: { old: {} } });
    await applyUpload(store, await planUpload(store, snapshot()));
    const writes = calls.filter((call) => call.startsWith('upsert ')).map((call) => call.split(' ')[1]);
    expect(writes.at(-1)).toBe('plans');
    const removes = calls.filter((call) => call.startsWith('tombstone '));
    expect(removes).toEqual(['tombstone entries old', 'tombstone accounts gone']);
  });

  it('counts what an empty phone would delete from an account saved elsewhere', async () => {
    const { store } = fakeStore({ entries: { x1: {}, x2: {}, x3: {} }, accounts: { a: {} }, plans: { current: {} } });
    const empty = snapshot({ accounts: [], entries: [], plan: null, guesses: [], fxRates: [], weekResults: [] });
    const plan = await planUpload(store, { ...empty, discountVotes: [], profile: null });
    expect(staleSummary(plan)).toBe('3 entries and 2 other items');
  });

  it('names one entry and one other item in the singular', async () => {
    const { store } = fakeStore({ entries: { x1: {} }, week_results: { '2026-10-05': {} } });
    expect(staleSummary(await planUpload(store, snapshot()))).toBe('1 entry and 1 other item');
  });

  it('stops at the first refused request, with the rows written so far kept and no plan yet', async () => {
    const { store, tables } = fakeStore();
    const failing: UserDataStore = {
      ...store,
      async upsert(table, rows) {
        if (table === 'guesses') throw new StoreError('guesses', 500, 'XX000', 'boom');
        return store.upsert(table, rows);
      },
    };
    const plan = await planUpload(failing, snapshot());
    await expect(applyUpload(failing, plan)).rejects.toThrow('guesses: boom');
    expect(tables.entries.size).toBe(3);
    expect(tables.profiles.size).toBe(0);
    // So another phone's load reads this as an unfinished save, not as a phone without a plan.
    expect(tables.plans.size).toBe(0);
  });
});

describe('the lines the save shows', () => {
  it('sums up a save', async () => {
    const { store } = fakeStore();
    expect(uploadSummary(await planUpload(store, snapshot()))).toBe(
      'Saved to your account: 2 accounts, 3 entries and your plan.',
    );
    expect(
      uploadSummary(await planUpload(store, snapshot({ accounts: [snapshot().accounts[0]], entries: [expense('e1')] }))),
    ).toBe('Saved to your account: 1 account, 1 entry and your plan.');
  });

  it('says calmly why a save did not work', () => {
    expect(saveErrorMessage(new StoreError('entries', 401, 'PGRST301', 'JWT expired'))).toBe(
      'Your sign-in has run out. Sign out, sign in again, then save.',
    );
    expect(saveErrorMessage(new StoreError('entries', 400, '22P05', 'unsupported Unicode escape sequence'))).toBe(
      "Your account couldn't take some of this phone's data, so the save stopped. Nothing on this phone changed.",
    );
    for (const other of [new StoreError('entries', 500, 'XX000', 'boom'), new TypeError('Failed to fetch'), null]) {
      expect(saveErrorMessage(other)).toBe("Couldn't save to your account. Check your connection and try again.");
    }
  });
});
