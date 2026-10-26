import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { db } from '@/db/db';
import { clearManualRate, setManualRate } from '@/db/rates';
import { deleteAccount, deleteEntry, ensureSeeded, saveEntry, saveGuesses } from '@/db/repo';
import type { Account, Entry, Plan, Rate } from '@/db/types';
import { setDefaultAccount } from '@/features/accounts/set-default-account';
import { setAway } from '@/features/badges/week-results';
import { postDueRecurring } from '@/features/recurring/post-due';
import { updatePlan } from '@/features/recurring/update-plan';
import { untracked } from './untracked';

// Every way the app writes, run through the real middleware (registered in db.ts) on fake-indexeddb. While the phone
// is linked, each one records exactly the rows it changed, by server table and id; unlinked, nothing is recorded.

const CREATED_AT = '2026-10-16T10:00:00.000Z';

function account(id: string): Account {
  return { id, name: id, kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: CREATED_AT };
}

function expense(id: string, accountId = 'local'): Entry {
  return {
    id,
    type: 'expense',
    date: '2026-10-16',
    accountId,
    categoryId: 'food',
    amountMinor: 650,
    eurMinor: 650,
    note: id,
    createdAt: CREATED_AT,
  };
}

const PLAN: Plan = {
  id: 'current',
  cityId: 'regensburg',
  incomes: [],
  fixed: [
    {
      categoryId: 'rent',
      monthlyMinor: 40000,
      schedule: {
        id: 'rent-s',
        frequency: 'monthly',
        day: 1,
        accountId: 'local',
        amountMinor: 40000,
        startOn: '2026-10-17',
        postedThrough: '2026-10-16',
      },
    },
  ],
  oneOffs: [],
  envelopes: [{ categoryId: 'food', monthlyMinor: 20000 }],
  createdOn: '2026-10-16',
};

const ECB_INR: Rate = { currency: 'INR', perEur: 95, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' };

async function link() {
  await db.syncState.put({ id: 'current', userId: 'user-1', cursor: 0, lastSyncedAt: null, problem: null });
}

/** The outbox as "table:id", sorted. */
async function recorded(): Promise<string[]> {
  return (await db.outbox.toArray()).map((entry) => `${entry.table}:${entry.id}`).sort();
}

/** Empties the outbox, so a step's own records can be seen. */
async function forget() {
  await db.outbox.clear();
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('while the phone is not linked', () => {
  it('records nothing', async () => {
    await db.accounts.bulkAdd([account('local')]);
    await db.plan.put(PLAN);
    await saveEntry(expense('e1'));
    await deleteEntry('e1');
    await saveGuesses([{ categoryId: 'food', monthlyMinor: 20000, guessedOn: '2026-10-16' }]);
    await setManualRate('INR', 97, '2026-10-16');
    await db.profile.put({
      id: 'current',
      name: 'Roshan',
      university: 'ur',
      semesterStart: '',
      semesterEnd: '',
      updatedAt: CREATED_AT,
    });
    expect(await recorded()).toEqual([]);
  });
});

describe('while the phone is linked', () => {
  beforeEach(link);

  it('records an entry saved, changed and deleted (repo.ts), once per row', async () => {
    await db.accounts.bulkAdd([account('local')]);
    await forget();
    await saveEntry(expense('e1'));
    await saveEntry({ ...expense('e1'), note: 'changed' });
    await saveEntry(expense('e2'));
    await deleteEntry('e2');
    expect(await recorded()).toEqual(['entries:e1', 'entries:e2']);
  });

  it('records accounts added in setup (bulkAdd), a new default (modify) and a deleted account', async () => {
    await db.accounts.bulkAdd([account('local'), account('cash')]);
    expect(await recorded()).toEqual(['accounts:cash', 'accounts:local']);

    await forget();
    await setDefaultAccount('cash');
    // modify() rewrites every account it visits.
    expect(await recorded()).toEqual(['accounts:cash', 'accounts:local']);

    await forget();
    await deleteAccount('cash');
    expect(await recorded()).toEqual(['accounts:cash']);
  });

  it('records the plan put in setup, changed through updatePlan, and updated in place (suggested budget)', async () => {
    await db.plan.put(PLAN);
    expect(await recorded()).toEqual(['plans:current']);

    await forget();
    await updatePlan((plan) => ({ ...plan, envelopes: [{ categoryId: 'food', monthlyMinor: 25000 }] }));
    expect(await recorded()).toEqual(['plans:current']);

    await forget();
    await db.plan.update('current', { envelopes: [{ categoryId: 'food', monthlyMinor: 30000 }] });
    expect(await recorded()).toEqual(['plans:current']);
  });

  it('records the entries and the plan that posting recurring entries writes (post-due.ts)', async () => {
    await db.accounts.bulkAdd([account('local')]);
    await db.plan.put(PLAN);
    await forget();
    expect(await postDueRecurring('2026-11-01')).toEqual({ posted: 1 });
    expect(await recorded()).toEqual(['entries:rec:rent-s:2026-11-01', 'plans:current']);
  });

  it('records guesses, by category', async () => {
    await saveGuesses([
      { categoryId: 'food', monthlyMinor: 20000, guessedOn: '2026-10-16' },
      { categoryId: 'transport', monthlyMinor: 5000, guessedOn: '2026-10-16' },
    ]);
    expect(await recorded()).toEqual(['guesses:food', 'guesses:transport']);
  });

  it('records a manual rate set and cleared, by currency, but never ECB rates or the built-in categories', async () => {
    await db.fxRates.bulkPut([ECB_INR, { ...ECB_INR, currency: 'USD', perEur: 1.1 }]);
    await db.categories.bulkPut(CATEGORIES.slice(0, 2));
    await ensureSeeded();
    expect(await recorded()).toEqual([]);

    await setManualRate('INR', 97, '2026-10-16');
    expect(await recorded()).toEqual(['manual_rates:INR']);
    await forget();
    await clearManualRate('INR');
    expect(await recorded()).toEqual(['manual_rates:INR']);
  });

  it('records a week marked away (add), changed (update) and unmarked again (delete), by its Monday', async () => {
    await setAway('2026-10-21', true);
    expect(await recorded()).toEqual(['week_results:2026-10-19']);
    await forget();
    await setAway('2026-10-21', false);
    expect(await recorded()).toEqual(['week_results:2026-10-19']);
  });

  it('records a discount vote and the profile', async () => {
    await db.discountVotes.put({ discountId: 'cinema-student', vote: 'works', on: '2026-10-20' });
    await db.profile.put({
      id: 'current',
      name: 'Roshan',
      university: 'ur',
      semesterStart: '',
      semesterEnd: '',
      updatedAt: CREATED_AT,
    });
    expect(await recorded()).toEqual(['discount_votes:cinema-student', 'profiles:current']);
  });

  it('keeps one entry per row, with a later seq for a later change', async () => {
    await saveEntry(expense('e1'));
    const [first] = await db.outbox.toArray();
    await saveEntry({ ...expense('e1'), note: 'again' });
    const entries = await db.outbox.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].seq).toBeGreaterThan(first.seq);
  });

  it('records nothing for writes inside untracked(), and records again outside it', async () => {
    await untracked([db.entries, db.plan], async () => {
      await db.entries.put(expense('from-account'));
      await db.plan.put(PLAN);
    });
    expect(await recorded()).toEqual([]);
    expect(await db.entries.get('from-account')).toBeDefined();

    await saveEntry(expense('mine'));
    expect(await recorded()).toEqual(['entries:mine']);
  });

  it('records nothing for a write that fails, and the failed transaction leaves no outbox entry', async () => {
    await saveEntry(expense('e1'));
    await forget();
    await expect(db.entries.add(expense('e1'))).rejects.toThrow();
    await expect(
      db.transaction('rw', db.entries, async () => {
        await db.entries.put(expense('e2'));
        throw new Error('changed my mind');
      }),
    ).rejects.toThrow('changed my mind');
    expect(await recorded()).toEqual([]);
    expect(await db.entries.get('e2')).toBeUndefined();
  });
});
