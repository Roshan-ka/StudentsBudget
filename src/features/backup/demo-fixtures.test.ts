import 'fake-indexeddb/auto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { replaceAll } from '@/db/bulk';
import { db } from '@/db/db';
import type { Entry } from '@/db/types';
import { loadRates } from '@/db/rates';
import { accountBalance, defaultAccount, totalInEur } from '@/features/accounts/balances';
import { badgeHistory, badgesFrom, semesterWeeksFor } from '@/features/badges/badges';
import { recordCompletedWeeks } from '@/features/badges/week-results';
import { spendingByCategoryOver } from '@/features/charts/aggregate';
import { postDueRecurring } from '@/features/recurring/post-due';
import { monthStatus, planSummary, weekToSpend } from '@/lib/budget';
import type { RateMap } from '@/lib/fx';
import { parseBackup, serializeBackup } from './backup';

// The committed snapshot, or a pack made with `--out`: DEMO_FIXTURES_DIR=<that folder> npx vitest run <this file>.
const custom = process.env.DEMO_FIXTURES_DIR;
const root = custom ? pathToFileURL(resolve(custom) + sep) : new URL('../../../fixtures/manual-demo/', import.meta.url);
type Case = {
  path: string;
  error?: string;
  expected?: {
    accounts: number;
    entries: number;
    balances: Record<string, number>;
    leftMinor?: number;
    setAsideMinor?: number;
    availableMinor?: number;
    weekMinor?: number;
    weekAfterFoodMinor?: number;
    badgeTier?: string;
  };
};
const manifest: { generatedFor: string; month: string; cases: Case[] } = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const valid = manifest.cases.filter((c) => !c.error);
const invalid = manifest.cases.filter((c) => c.error);
function read(path: string) {
  const result = parseBackup(readFileSync(new URL(path, root), 'utf8'));
  if (!result.ok) throw new Error(`${path}: ${result.error}`);
  return result.data;
}
function named(prefix: string) {
  const c = valid.find((c) => c.path.startsWith(`valid/${prefix}`));
  if (!c) throw new Error(`Missing fixture ${prefix}`);
  return read(c.path);
}
function foodExpense(date: string): Entry {
  return { id: 'food-10', type: 'expense', date, accountId: 'bank', categoryId: 'food', amountMinor: 1000, eurMinor: 1000, note: 'Demo food', createdAt: `${date}T10:00:00.000Z` };
}
function rateMap(data: ReturnType<typeof read>): RateMap {
  const rates: RateMap = {};
  for (const r of data.fxRates) if (r.source === 'ecb') rates[r.currency] = r;
  for (const r of data.fxRates) if (r.source === 'manual') rates[r.currency] = r;
  return rates;
}

describe('uploadable manual demo files', () => {
  it('lists every upload file exactly once', () => {
    const files = ['valid', 'invalid'].flatMap((folder) => readdirSync(new URL(`${folder}/`, root)).map((f) => `${folder}/${f}`));
    expect(manifest.cases.map((c) => c.path).sort()).toEqual(files.sort());
    expect(new Set(manifest.cases.map((c) => c.path)).size).toBe(manifest.cases.length);
  });

  it.each(valid)('$path restores and agrees with the documented initial figures', (c) => {
    const data = read(c.path);
    const expected = c.expected!;
    expect(data.accounts).toHaveLength(expected.accounts);
    expect(data.entries).toHaveLength(expected.entries);
    expect(data.categories).toHaveLength(26);
    for (const account of data.accounts) expect(accountBalance(account, data.entries)).toBe(expected.balances[account.id]);
    if (data.plan) {
      const left = monthStatus(data.plan, data.entries, manifest.month).reduce((n, e) => n + e.plannedMinor - e.spentMinor, 0);
      expect(left).toBe(expected.leftMinor);
      const summary = planSummary(data.plan, manifest.month);
      if (expected.setAsideMinor !== undefined) expect(summary.setAsideMinor).toBe(expected.setAsideMinor);
      if (expected.availableMinor !== undefined) expect(summary.availableMinor).toBe(expected.availableMinor);
    }
    const roundTrip = parseBackup(serializeBackup(data, new Date(`${manifest.generatedFor}T12:00:00Z`)));
    expect(roundTrip.ok && roundTrip.data).toEqual(data);
  });

  it.each(invalid)('$path is rejected with its documented message', (c) => {
    expect(parseBackup(readFileSync(new URL(c.path, root), 'utf8'))).toEqual({ ok: false, error: c.error });
  });

  it('keeps the realistic demo total stable at its manual rate', () => {
    const data = named('01-');
    expect(totalInEur(data.accounts, data.entries, rateMap(data))).toEqual({ totalMinor: 361322, missingRates: [] });
  });

  it('covers every currency and handles a completely missing rate', () => {
    const data = named('06-');
    expect(new Set(data.accounts.map((a) => a.currency)).size).toBe(7);
    expect(totalInEur(data.accounts, data.entries, rateMap(data))).toEqual({ totalMinor: 168000, missingRates: [] });
    const missing = named('07-');
    expect(totalInEur(missing.accounts, [], {})).toEqual({ totalMinor: 0, missingRates: ['INR'] });
  });

  it('has the documented chart totals and excludes transfers', () => {
    const data = named('09-');
    for (const months of [1, 3, 6, 12] as const) {
      const rows = spendingByCategoryOver(data.entries, data.plan!, { endMonth: manifest.month, months });
      expect(rows.reduce((n, row) => n + row.spentMinor, 0)).toBe(20100 * months);
    }
    expect(data.entries.filter((e) => e.type === 'income').reduce((n, e) => n + e.eurMinor, 0)).toBe(1680000);
  });

  it('has the documented "This week" figure for the clean budget, before and after EUR 10 of Food', () => {
    const c = valid.find((c) => c.path.startsWith('valid/02-'))!;
    const data = read(c.path);
    expect(weekToSpend(data.plan!, data.entries, manifest.generatedFor).totalMinor).toBe(c.expected!.weekMinor);
    expect(weekToSpend(data.plan!, [...data.entries, foodExpense(manifest.generatedFor)], manifest.generatedFor).totalMinor).toBe(c.expected!.weekAfterFoodMinor);
  });

  it("shows the guide's snapshot figures for B01 on 21-10-2026, whatever day the pack was made for", () => {
    const data = named('02-');
    expect(weekToSpend(data.plan!, data.entries, '2026-10-21').totalMinor).toBe(25000);
    expect(weekToSpend(data.plan!, [...data.entries, foodExpense('2026-10-21')], '2026-10-21').totalMinor).toBe(24000);
  });

  it('actually restores each dataset into IndexedDB', async () => {
    for (const c of valid) {
      const data = read(c.path);
      await replaceAll(data);
      expect(await db.accounts.count(), c.path).toBe(data.accounts.length);
      expect(await db.entries.count(), c.path).toBe(data.entries.length);
      expect(await db.profile.get('current'), c.path).toEqual(data.profile ?? undefined);
    }
  });

  it('posts the three due occurrences once and leaves the paused line alone', async () => {
    await replaceAll(named('08-'));
    expect(await postDueRecurring(manifest.generatedFor)).toEqual({ posted: 3 });
    expect(await postDueRecurring(manifest.generatedFor)).toEqual({ posted: 0 });
    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.type !== 'transfer' && e.recurring !== undefined)).toBe(true);
    const bank = (await db.accounts.get('bank'))!;
    expect(accountBalance(bank, entries)).toBe(180000);
    expect(totalInEur(await db.accounts.toArray(), entries, await loadRates()).totalMinor).toBe(190000);
  });

  it.each(valid.filter((c) => c.expected?.badgeTier))('$path earns the documented badges after startup records missing weeks', async (c) => {
    const data = read(c.path);
    await replaceAll(data);
    await recordCompletedWeeks(manifest.generatedFor);
    const results = await db.weekResults.toArray();
    const badges = badgesFrom(results, semesterWeeksFor(data.profile), badgeHistory(data.plan!, data.entries, results, manifest.generatedFor));
    expect(badges[0].tier).toBe(c.expected!.badgeTier);
    expect(badges.every((badge) => badge.earnedOn !== null)).toBe(true);
  });

  it('keeps the streak paused in the away-week file', async () => {
    const data = named('13-');
    await replaceAll(data);
    await recordCompletedWeeks(manifest.generatedFor);
    const results = await db.weekResults.toArray();
    const badges = badgesFrom(results, semesterWeeksFor(data.profile), badgeHistory(data.plan!, data.entries, results, manifest.generatedFor));
    expect(badges.find((b) => b.id === 'logging-streak')?.progress).toContain('paused');
  });

  it('makes the explicit default cash account the default', () => {
    expect(defaultAccount(named('18-').accounts)?.id).toBe('cash');
  });
});
