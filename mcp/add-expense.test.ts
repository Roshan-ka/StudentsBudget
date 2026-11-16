import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BackupData } from '@/db/bulk';
import { parseBackup } from '@/features/backup/backup';
import { planDownload } from '@/sync/download';
import { ROW_CHECKS } from '@/sync/rows';
import type { UserDataStore } from '@/sync/store';
import { fakeStore } from '@/sync/test-helpers';
import { applyUpload, planUpload } from '@/sync/upload';
import { entryWriter, readOnly, type ReadAccount } from './account.ts';
import { ADDED_ID_PREFIX, type AddExpenseResult } from './add-expense.ts';
import { call, connect } from './test-client.ts';

// add_expense against a fake account holding the demo pack's everyday student, saved the way the app's Save writes it.
const TODAY = '2026-10-21';
const NOW = new Date('2026-10-21T12:00:00.000Z');

function demo(): BackupData {
  const parsed = parseBackup(readFileSync('fixtures/manual-demo/valid/01-everyday-student.json', 'utf8'));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

/** The account as the real server gets it: reads through `readOnly`, the one write through `entryWriter`. */
async function account(data: BackupData, writable = true): Promise<{ read: ReadAccount; store: UserDataStore; calls: string[] }> {
  const { store, calls } = fakeStore();
  await applyUpload(store, await planUpload(store, data));
  calls.length = 0;
  const read: ReadAccount = (task) =>
    task({
      store: readOnly(store),
      lastSavedAt: async () => '2026-10-21T09:30:00.000Z',
      checkSecondStep: async () => {},
      ...(writable ? { entries: entryWriter(store) } : {}),
    });
  return { read, store, calls };
}

async function add(read: ReadAccount, args: Record<string, unknown>) {
  return call<AddExpenseResult>(await connect(TODAY, read, NOW), 'add_expense', args);
}

/** The account's entries after the call, read as the phone's next pull would check them. */
async function entriesIn(store: UserDataStore) {
  return (await store.listRows('entries')).map((row) => ROW_CHECKS.entries(row));
}

describe('add_expense', () => {
  it('adds an expense on the default account, its category guessed from the account’s own notes', async () => {
    const { read, store, calls } = await account(demo());
    const before = (await entriesIn(store)).length;

    const { isError, text, data } = await add(read, { amount: '6,50', note: 'Lunch with classmates' });
    expect(isError).toBe(false);
    expect(data.state).toBe('added');
    expect(data.added).toEqual({
      date: TODAY,
      account: 'Local bank (demo)',
      categoryId: 'eating-out',
      category: 'Eating out',
      amount: '€6.50',
      amountMinor: 650,
      eur: '€6.50',
      eurMinor: 650,
      note: 'Lunch with classmates',
    });
    expect(text).toContain('Saved €6.50 · Lunch with classmates · Eating out · 21.10.2026, on Local bank (demo).');
    expect(text).toContain('after its next sync');

    // One row, added without overwriting anything, and nothing else written.
    expect(calls.filter((c) => /^(insert|upsert|tombstone)/.test(c))).toEqual([
      expect.stringMatching(new RegExp(`^insert entries ${ADDED_ID_PREFIX}[0-9a-f-]{36}$`)),
    ]);
    const entries = await entriesIn(store);
    expect(entries).toHaveLength(before + 1);
    const added = entries.find((e) => e.id.startsWith(ADDED_ID_PREFIX));
    expect(added).toMatchObject({ type: 'expense', date: TODAY, accountId: 'demo-local', amountMinor: 650, eurMinor: 650, createdAt: NOW.toISOString() });

    // The phone's link would load it: the account still reads as the app's data.
    const download = await planDownload(readOnly(store), { ...demo(), entries: [] });
    expect(download.kind).toBe('ready');
  });

  it('takes the account by its name, any case, and converts at the account’s own manual rate', async () => {
    const { read } = await account(demo());
    const { data } = await add(read, { amount: '950', note: 'Phone top-up', category: 'phone', account: 'home bank (DEMO)', date: '2026-10-20' });
    expect(data.state).toBe('added');
    expect(data.added).toMatchObject({ account: 'Home bank (demo)', amountMinor: 95000, eurMinor: 1000, eur: '€10.00', date: '2026-10-20' });
  });

  it('refuses what it can’t add as asked, and writes nothing', async () => {
    const cases: [Record<string, unknown>, AddExpenseResult['state'], RegExp][] = [
      [{ amount: 'six' }, 'invalid-amount', /isn’t an amount/],
      [{ amount: '0' }, 'invalid-amount', /above zero/],
      [{ amount: '5', date: '2026-10-22' }, 'future-date', /22\.10\.2026 is in the future/],
      [{ amount: '5', category: 'food', account: 'Revolut' }, 'unknown-account', /no account called "Revolut".*Local bank \(demo\)/],
      [{ amount: '5', note: 'something new' }, 'needs-category', /eating-out \(Eating out\)/],
    ];
    for (const [args, state, note] of cases) {
      const { read, calls } = await account(demo());
      const { data } = await add(read, args);
      expect(data.state, JSON.stringify(args)).toBe(state);
      expect(data.note, JSON.stringify(args)).toMatch(note);
      expect(data.note).toContain('Nothing was added.');
      expect(data.added).toBeNull();
      expect(calls.filter((c) => c.startsWith('insert') || c.startsWith('upsert') || c.startsWith('tombstone'))).toEqual([]);
    }
  });

  it('refuses an account in another currency without a manual rate in the account', async () => {
    const { read, calls } = await account({ ...demo(), fxRates: [] });
    const { data } = await add(read, { amount: '950', category: 'phone', account: 'Home bank (demo)' });
    expect(data.state).toBe('no-rate');
    expect(data.note).toContain('rates typed in by hand');
    expect(calls.some((c) => c.startsWith('insert'))).toBe(false);
  });

  it('says so when the account can’t be written', async () => {
    const { read } = await account(demo(), false);
    const { data } = await add(read, { amount: '5', category: 'food' });
    expect(data.state).toBe('not-writable');
  });

  it('refuses a date that isn’t one, by its schema', async () => {
    const { read } = await account(demo());
    const client = await connect(TODAY, read, NOW);
    const result = await client.callTool({ name: 'add_expense', arguments: { amount: '5', date: '2026-02-30' } });
    expect(result.isError).toBe(true);
  });
});

describe('entryWriter', () => {
  it('adds a new entry and never replaces one the account has', async () => {
    const { store } = fakeStore({ entries: { kept: { note: 'mine' } } });
    const writer = entryWriter(store);
    await expect(writer.add({ id: 'kept', data: { note: 'other' } })).rejects.toThrow('already holds');
    expect((await store.listRows('entries')).find((r) => r.id === 'kept')?.data).toEqual({ note: 'mine' });
  });
});
