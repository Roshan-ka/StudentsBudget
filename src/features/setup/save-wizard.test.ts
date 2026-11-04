import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAll } from '@/db/bulk';
import { db } from '@/db/db';
import { deleteAccount } from '@/db/repo';
import type { Account, Plan } from '@/db/types';
import { checkBackupData } from '@/features/backup/backup';
import { applyLineChange } from '@/features/recurring/lines';
import { updatePlan } from '@/features/recurring/update-plan';
import { draftFromPlan, draftToRecords, initialDraft, type AccountOption } from './draft';
import { saveWizard } from './save-wizard';

const TODAY = '2026-10-20';

function account(id: string): Account {
  return { id, name: id, kind: 'bank', currency: 'EUR', openingMinor: 0, createdAt: '2026-10-16T10:00:00.000Z' };
}

const option = (id: string): AccountOption => ({ id, name: id, currency: 'EUR', kind: 'bank' });

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
  envelopes: [],
  createdOn: '2026-10-16',
};

async function rentSchedule() {
  return (await db.plan.get('current'))?.fixed.find((l) => l.categoryId === 'rent')?.schedule;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.accounts.bulkAdd([account('local'), account('other')]);
  await db.plan.put(PLAN);
});

describe('saveWizard', () => {
  // The wizard keeps the account list it read when it opened, or follows the live one: both must save safely.
  it.each([
    ['the accounts it read when it opened', [option('local'), option('other')]],
    ['the accounts as they are now', [option('other')]],
  ])(
    'does not point rent at an account another tab deleted while the wizard was open (%s)',
    async (_name, storedAccounts) => {
      const opened = PLAN;
      const draft = draftFromPlan(opened);

      // Meanwhile, in another tab: rent moves to "other", then "local" is deleted.
      const toOther = { frequency: 'monthly', day: 1, accountId: 'other', amountMinor: 40000, currency: 'EUR' } as const;
      const accounts = [{ id: 'local' }, { id: 'other' }];
      await updatePlan((p) => applyLineChange(p, { categoryId: 'rent', auto: toOther, monthlyMinor: 0 }, TODAY, accounts));
      await deleteAccount('local');

      await saveWizard(draftToRecords(draft, TODAY, opened, storedAccounts), true);

      expect(await rentSchedule()).toMatchObject({ id: 'rent-s', accountId: 'other' });
      expect(checkBackupData(await exportAll())).toBeNull();
    },
  );

  it('saves a new setup’s accounts and plan together', async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const draft = { ...initialDraft(), rentMinor: 40000 };

    await saveWizard(draftToRecords(draft, TODAY), false);

    expect((await db.accounts.toArray()).map((a) => a.name).sort()).toEqual(['Cash', 'Home bank', 'Local bank']);
    expect(await db.plan.get('current')).toMatchObject({ createdOn: TODAY, fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }] });
  });
});
