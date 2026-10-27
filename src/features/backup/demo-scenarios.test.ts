import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import { exportAll, replaceAll } from '@/db/bulk';
import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import { accountBalance, totalInEur } from '@/features/accounts/balances';
import { postDueRecurring } from '@/features/recurring/post-due';
import { guessVsReality } from '@/features/reveal/reveal';
import { monthStatus } from '@/lib/budget';
import { parseBackup } from './backup';

const directory = new URL('../../../fixtures/scenarios/', import.meta.url);
const files = readdirSync(directory).filter((name) => name.endsWith('.json'));
function read(name: string) {
  return parseBackup(readFileSync(new URL(name, directory), 'utf8'));
}
function valid(name: string) {
  const result = read(name);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result;
}

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('uploadable demo scenarios', () => {
  it.each(files)('%s restores and exports every row', async (name) => {
    const { data } = valid(name);
    await replaceAll(data);
    const result = await exportAll();
    for (const table of ['accounts', 'categories', 'entries', 'guesses', 'fxRates'] as const) {
      expect(result[table]).toHaveLength(data[table].length);
      expect(result[table]).toEqual(expect.arrayContaining<unknown>(data[table]));
    }
    expect(result.plan).toEqual(data.plan);
  });

  it('history covers twelve months and every category, with the reveal unlocked', () => {
    const { data, exportedAt } = valid(files[0]);
    expect(new Set(data.entries.map((e) => e.date.slice(0, 7))).size).toBe(12);
    expect(new Set(data.entries.flatMap((e) => e.type === 'transfer' ? [] : [e.categoryId])).size).toBe(CATEGORIES.length);
    expect(guessVsReality(data.guesses, data.entries, data.plan!.createdOn, exportedAt.slice(0, 10)).unlocked).toBe(true);
    expect(data.entries.every((e) => e.date <= exportedAt.slice(0, 10))).toBe(true);
  });

  it('the overspending scenario has a negative balance and an exceeded food envelope', () => {
    const { data, exportedAt } = valid('02-overspent-and-overdrawn.json');
    expect(accountBalance(data.accounts[0], data.entries)).toBeLessThan(0);
    const food = monthStatus(data.plan!, data.entries, exportedAt.slice(0, 7)).find((s) => s.categoryId === 'food')!;
    expect(food.spentMinor).toBeGreaterThan(food.plannedMinor);
  });

  it('the fresh plan keeps earlier flexible spending out of its budget and the reveal locked', () => {
    const { data, exportedAt } = valid('03-new-student-mid-month.json');
    expect(guessVsReality(data.guesses, data.entries, data.plan!.createdOn, exportedAt.slice(0, 10)).unlocked).toBe(false);
    expect(monthStatus(data.plan!, data.entries, exportedAt.slice(0, 7)).find((s) => s.categoryId === 'food')?.spentMinor).toBe(650);
  });

  it('manual rates cover every currency, while the missing-rate scenario excludes TRY', async () => {
    for (const name of ['04-all-currencies-and-transfers.json', '05-missing-exchange-rate.json']) {
      const { data } = valid(name);
      await replaceAll(data);
      const total = totalInEur(data.accounts, data.entries, await loadRates());
      expect(total.missingRates).toEqual(name.startsWith('04') ? [] : ['TRY']);
      expect(total.totalMinor).toBe(name.startsWith('04') ? 693000 : 594000);
    }
  });

  it('due schedules post once, paused and missing-rate schedules wait', async () => {
    const { data, exportedAt } = valid('06-recurring-due-paused-and-blocked.json');
    await replaceAll(data);
    const today = exportedAt.slice(0, 10);
    expect((await postDueRecurring(today)).posted).toBeGreaterThan(0);
    const posted = (await db.entries.toArray()).flatMap((e) => e.type !== 'transfer' && e.recurring ? [e.recurring.scheduleId] : []);
    expect(posted).toContain('monthly-rent');
    expect(posted).toContain('monthly-parents');
    expect(posted).not.toContain('paused-insurance');
    expect(posted).not.toContain('blocked-chf');
    expect(await postDueRecurring(today)).toEqual({ posted: 0 });
  });

  it.each(readdirSync(new URL('invalid/', directory)))('rejects invalid/%s', (name) => {
    expect(read(`invalid/${name}`).ok).toBe(false);
  });
});
