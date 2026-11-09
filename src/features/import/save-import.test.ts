import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { db } from '@/db/db';
import type { Account, Plan } from '@/db/types';
import type { CurrencyCode } from '@/lib/money';
import { SPARKASSE_CAMT } from './fixtures';
import { saveImport, undoImport } from './save-import';
import { openStatement } from './statement';

// Saving an import and taking it back, on the phone's database (fake-indexeddb). The statement is the fixtures'
// Sparkasse file: five entries (two of them transfers, to Cash and to Revolut) and one pending row.

const NOW = new Date('2026-11-06T12:00:00');

function account(id: string, name: string, kind: Account['kind'] = 'bank', currency: CurrencyCode = 'EUR', createdAt = '2026-10-01T08:00:00'): Account {
  return { id, name, kind, currency, openingMinor: 50000, createdAt: new Date(createdAt).toISOString() };
}

const PLAN: Plan = { id: 'current', cityId: 'regensburg', incomes: [], fixed: [], oneOffs: [], envelopes: [], createdOn: '2026-10-05' };

function sparkasseRows() {
  const statement = openStatement(SPARKASSE_CAMT);
  if (statement.kind !== 'bank') throw new Error('not a bank statement');
  return statement.read;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.categories.bulkAdd(CATEGORIES);
  await db.accounts.bulkAdd([account('spk', 'Sparkasse'), account('rev', 'Revolut'), account('cash', 'Cash', 'cash')]);
  await db.plan.put(PLAN);
});

describe('saveImport', () => {
  it('saves the entries with their mark, in euros, and lists what it left out', async () => {
    const saved = await saveImport({ read: sparkasseRows(), accountId: 'spk', batchId: 'batch-1', now: NOW });

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.added).toHaveLength(5);
    expect(saved.skipped.map((row) => row.reason)).toEqual(['pending']);
    const stored = await db.entries.orderBy('date').toArray();
    expect(stored).toEqual(saved.added.toSorted((a, b) => a.date.localeCompare(b.date)));
    expect(stored.every((entry) => entry.imported?.batchId === 'batch-1' && entry.createdAt === NOW.toISOString())).toBe(true);
    expect(stored.find((entry) => entry.date === '2026-10-30')).toMatchObject({ type: 'expense', categoryId: 'food', amountMinor: 2345, eurMinor: 2345 });
  });

  it('adds nothing the second time: the same file is already in the app', async () => {
    const read = sparkasseRows();
    await saveImport({ read, accountId: 'spk', batchId: 'batch-1', now: NOW });
    const again = await saveImport({ read, accountId: 'spk', batchId: 'batch-2', now: NOW });

    expect(again.ok && again.added).toEqual([]);
    expect(again.ok && again.skipped.filter((row) => row.reason === 'duplicate')).toHaveLength(5);
    expect(await db.entries.count()).toBe(5);
  });

  it('adds nothing for two taps at once either', async () => {
    const read = sparkasseRows();
    await Promise.all([saveImport({ read, accountId: 'spk', now: NOW }), saveImport({ read, accountId: 'spk', now: NOW })]);
    expect(await db.entries.count()).toBe(5);
  });

  it('records every entry in the outbox on a linked phone', async () => {
    await db.syncState.put({ id: 'current', userId: 'user-1', cursor: 0, lastSyncedAt: null, problem: null });
    const saved = await saveImport({ read: sparkasseRows(), accountId: 'spk', now: NOW });

    const outbox = await db.outbox.toArray();
    expect(outbox.filter((entry) => entry.table === 'entries').map((entry) => entry.id).sort()).toEqual(
      (saved.ok ? saved.added : []).map((entry) => entry.id).sort(),
    );
    expect(outbox.every((entry) => !entry.auto)).toBe(true);
  });

  it('moves the start of an account added after some of the rows, so today’s balance stays', async () => {
    // Sparkasse added on 01.11.2026: the REWE payment (−23,45) and BAföG (+934,00) are already in its 500,00 € start.
    await db.accounts.put(account('spk', 'Sparkasse', 'bank', 'EUR', '2026-11-01T09:00:00'));
    const saved = await saveImport({ read: sparkasseRows(), accountId: 'spk', now: NOW });

    expect(saved.ok && saved.openingChanges).toEqual(new Map([['spk', -91055]]));
    expect((await db.accounts.get('spk'))?.openingMinor).toBe(50000 - 91055);
  });

  it('writes nothing when an account in another currency has no rate, or the account is gone', async () => {
    await db.accounts.put(account('spk', 'Sparkasse', 'bank', 'INR'));
    const statement = openStatement(SPARKASSE_CAMT);
    if (statement.kind !== 'bank') throw new Error('not a bank statement');
    // An INR account takes no EUR rows, so give the rows the account's currency.
    const read = { ...statement.read, rows: statement.read.rows.map((row) => ({ ...row, currency: 'INR' })) };

    expect(await saveImport({ read, accountId: 'spk', now: NOW })).toEqual({ ok: false, reason: 'noRate', currency: 'INR' });
    expect(await saveImport({ read: sparkasseRows(), accountId: 'gone', now: NOW })).toEqual({ ok: false, reason: 'noAccount' });
    expect(await db.entries.count()).toBe(0);
  });
});

describe('undoImport', () => {
  it('takes the import back: its entries go, other entries stay, and each start moves back', async () => {
    await db.accounts.put(account('spk', 'Sparkasse', 'bank', 'EUR', '2026-11-01T09:00:00'));
    await db.entries.put({
      id: 'typed',
      type: 'expense',
      date: '2026-11-05',
      accountId: 'spk',
      amountMinor: 450,
      eurMinor: 450,
      categoryId: 'eating-out',
      note: 'Mensa',
      createdAt: NOW.toISOString(),
    });
    const saved = await saveImport({ read: sparkasseRows(), accountId: 'spk', now: NOW });
    if (!saved.ok) throw new Error('not saved');

    expect(await undoImport(saved)).toEqual({ removed: 5 });
    expect((await db.entries.toArray()).map((entry) => entry.id)).toEqual(['typed']);
    expect((await db.accounts.get('spk'))?.openingMinor).toBe(50000);
  });

  it('changes nothing the second time', async () => {
    await db.accounts.put(account('spk', 'Sparkasse', 'bank', 'EUR', '2026-11-01T09:00:00'));
    const saved = await saveImport({ read: sparkasseRows(), accountId: 'spk', now: NOW });
    if (!saved.ok) throw new Error('not saved');

    await undoImport(saved);
    expect(await undoImport(saved)).toEqual({ removed: 0 });
    expect((await db.accounts.get('spk'))?.openingMinor).toBe(50000);
  });

  it('records the deletes on a linked phone, so the account learns of them', async () => {
    const saved = await saveImport({ read: sparkasseRows(), accountId: 'spk', now: NOW });
    if (!saved.ok) throw new Error('not saved');
    await db.syncState.put({ id: 'current', userId: 'user-1', cursor: 0, lastSyncedAt: null, problem: null });

    await undoImport(saved);
    const recorded = (await db.outbox.toArray()).filter((entry) => entry.table === 'entries').map((entry) => entry.id);
    expect(recorded.sort()).toEqual(saved.added.map((entry) => entry.id).sort());
  });
});
