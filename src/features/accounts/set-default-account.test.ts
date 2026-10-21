import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { deleteAccount } from '@/db/repo';
import type { Account } from '@/db/types';
import { defaultAccount, sortAccounts } from './balances';
import { setDefaultAccount } from './set-default-account';

function account(id: string, kind: Account['kind'], currency: Account['currency'], day: number): Account {
  return { id, name: id, kind, currency, openingMinor: 0, createdAt: `2026-10-0${day}T08:00:00.000Z` };
}

const localBank = account('local-bank', 'bank', 'EUR', 1);
const homeBank = account('home-bank', 'bank', 'INR', 2);
const cash = account('cash', 'cash', 'EUR', 3);

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.accounts.bulkAdd([localBank, homeBank, cash]);
});

/** The account the app would start a new entry on, read the way Settings and the forms read it. */
async function currentDefault() {
  return defaultAccount(sortAccounts(await db.accounts.toArray()));
}

describe('setDefaultAccount', () => {
  it('marks one account, and with none marked the rule still picks the first euro bank account', async () => {
    expect((await currentDefault())?.id).toBe('local-bank');

    await setDefaultAccount('cash');

    expect((await db.accounts.get('cash'))?.isDefault).toBe(true);
    expect((await currentDefault())?.id).toBe('cash');
  });

  it('clears the mark on the others, so only one account is ever marked', async () => {
    await setDefaultAccount('cash');
    await setDefaultAccount('home-bank');

    const marked = (await db.accounts.toArray()).filter((a) => a.isDefault);
    expect(marked.map((a) => a.id)).toEqual(['home-bank']);
    expect(await db.accounts.get('cash')).not.toHaveProperty('isDefault');
    expect((await currentDefault())?.id).toBe('home-bank');
  });

  it('can mark the account the rule already picks, and changes nothing else about the accounts', async () => {
    await setDefaultAccount('local-bank');

    expect(await db.accounts.get('local-bank')).toEqual({ ...localBank, isDefault: true });
    expect(await db.accounts.get('home-bank')).toEqual(homeBank);
    expect(await db.accounts.get('cash')).toEqual(cash);
  });

  it('does nothing for an account that is gone, and leaves the marked one marked', async () => {
    await setDefaultAccount('cash');
    await setDefaultAccount('deleted-in-another-tab');

    expect((await currentDefault())?.id).toBe('cash');
  });

  it('falls back to the rule when the default account is deleted', async () => {
    await setDefaultAccount('cash');
    await deleteAccount('cash');

    expect((await db.accounts.toArray()).some((a) => a.isDefault)).toBe(false);
    expect((await currentDefault())?.id).toBe('local-bank');
  });
});
