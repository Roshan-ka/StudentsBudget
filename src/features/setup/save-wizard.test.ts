import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { deleteAccount } from '@/db/repo';
import type { Account, Plan } from '@/db/types';
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

/** Every schedule of the stored plan is added to an account that exists. */
async function expectNoOrphanedSchedule() {
  const ids = new Set((await db.accounts.toArray()).map((a) => a.id));
  const plan = await db.plan.get('current');
  const orphaned = [...(plan?.incomes ?? []), ...(plan?.fixed ?? [])].filter((l) => l.schedule && !ids.has(l.schedule.accountId));
  expect(orphaned).toEqual([]);
}

const toOther = { frequency: 'monthly', day: 1, accountId: 'other', amountMinor: 40000, currency: 'EUR' } as const;
const BOTH = [{ id: 'local' }, { id: 'other' }];

/** What another tab did to rent while the wizard was open, before it deleted "local". */
const moves: [string, () => Promise<void>][] = [
  ['moved rent to "other"', () => updatePlan((p) => applyLineChange(p, { categoryId: 'rent', auto: toOther, monthlyMinor: 0 }, TODAY, BOTH))],
  [
    'turned rent off and on again on "other"',
    async () => {
      await updatePlan((p) => applyLineChange(p, { categoryId: 'rent', auto: null, monthlyMinor: 40000 }, TODAY, BOTH));
      await updatePlan((p) => applyLineChange(p, { categoryId: 'rent', auto: toOther, monthlyMinor: 0 }, TODAY, BOTH));
    },
  ],
];

describe('saveWizard', () => {
  // The wizard keeps the account list it read when it opened, or follows the live one: both must save safely.
  const lists: [string, AccountOption[]][] = [
    ['the accounts it read when it opened', [option('local'), option('other')]],
    ['the accounts as they are now', [option('other')]],
  ];

  describe.each(moves)('when another tab %s and deleted "local" while the wizard was open', (_move, move) => {
    it.each(lists)('does not point rent at "local" again (%s)', async (_list, storedAccounts) => {
      const opened = PLAN;
      const draft = draftFromPlan(opened);

      await move();
      await deleteAccount('local');

      await saveWizard(draftToRecords(draft, TODAY, opened, storedAccounts), true);

      expect(await rentSchedule()).toMatchObject({ accountId: 'other' });
      await expectNoOrphanedSchedule();
    });
  });

  it('saves a new setup’s accounts and plan together', async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const draft = { ...initialDraft(), rentMinor: 40000 };

    await saveWizard(draftToRecords(draft, TODAY), false);

    expect((await db.accounts.toArray()).map((a) => a.name).sort()).toEqual(['Cash', 'Home bank', 'Local bank']);
    expect(await db.plan.get('current')).toMatchObject({ createdOn: TODAY, fixed: [{ categoryId: 'rent', monthlyMinor: 40000 }] });
  });
});
