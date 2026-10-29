import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BackupData } from '@/db/bulk';
import type { Entry } from '@/db/types';
import { parseBackup } from '@/features/backup/backup';
import { weekLine, weekTotalLine } from '@/features/check-in/week-line';
import { weekRows } from '@/features/check-in/week-rows';
import { weekSwaps } from '@/features/check-in/week-swaps';
import { weekToSpend } from '@/lib/budget';
import { fakeStore } from '@/sync/test-helpers';
import { applyUpload, planUpload } from '@/sync/upload';
import type { ReadAccount } from './account.ts';
import type { WeekCheckIn } from './check-in.ts';
import { call, connect } from './test-client.ts';

// The demo pack's everyday student, saved to a fake account as the app's Save writes it; 21-10-2026 is a Wednesday.
const DEMO_DAY = '2026-10-21';

function demo(): BackupData {
  const parsed = parseBackup(readFileSync('fixtures/manual-demo/valid/01-everyday-student.json', 'utf8'));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

async function checkIn(data: BackupData | null, today = DEMO_DAY) {
  const { store } = fakeStore();
  if (data !== null) await applyUpload(store, await planUpload(store, data));
  const read: ReadAccount = (task) =>
    task({ store, lastSavedAt: async () => '2026-10-21T09:30:00.000Z', checkSecondStep: async () => {} });
  return call<WeekCheckIn>(await connect(today, read), 'week_check_in');
}

describe('week_check_in', () => {
  it('builds the week as the app’s check-in does: its lines, total and entries', async () => {
    const data = demo();
    const { isError, data: c } = await checkIn(data);
    expect(isError).toBe(false);
    expect(c.state).toBe('ready');
    expect(c.parts.map((p) => p.label)).toEqual(['This week']);

    const week = weekToSpend(data.plan!, data.entries, DEMO_DAY);
    const rows = weekRows(data.plan!, week.envelopes);
    const [part] = c.parts;
    expect([part.start, part.end]).toEqual([week.weekStart, week.weekEnd]);
    expect(part.envelopes.map((e) => [e.categoryId, e.line])).toEqual(rows.map((r) => [r.categoryId, weekLine(r, r.usedUp)]));
    expect(part.total).toEqual({ line: weekTotalLine(week.totalMinor), minor: week.totalMinor });
    const inWeek = data.entries.filter((e) => e.date >= week.weekStart && e.date <= week.weekEnd);
    expect(part.entries).toHaveLength(inWeek.length);
    expect(c.note).toContain('measured against its share of the week');
  });

  it('offers a swap only for an envelope over its share of the week, with both sources', async () => {
    const data = demo();
    const week = weekToSpend(data.plan!, data.entries, DEMO_DAY);
    const share = week.envelopes.find((e) => e.categoryId === 'eating-out')!;
    const template = data.entries.find((e) => e.type === 'expense' && e.accountId === 'demo-local')!;
    // A restaurant evening this week that takes eating out past its share.
    const dinner: Entry = {
      ...template,
      id: 'test-dinner',
      date: DEMO_DAY,
      type: 'expense',
      categoryId: 'eating-out',
      amountMinor: share.weekShareMinor + 2000,
      eurMinor: share.weekShareMinor + 2000,
      note: 'dinner',
    };
    const over = { ...data, entries: [...data.entries, dinner] };
    const { data: c } = await checkIn(over);
    const [part] = c.parts;
    const eatingOut = part.envelopes.find((e) => e.categoryId === 'eating-out')!;
    expect(eatingOut.over).toBe(true);
    expect(eatingOut.line).toMatch(/over$/);

    const expected = weekSwaps(weekRows(over.plan!, weekToSpend(over.plan!, over.entries, DEMO_DAY).envelopes), DEMO_DAY);
    expect(part.swaps.map((s) => s.categoryId).sort()).toEqual([...expected.keys()].sort());
    const mensa = part.swaps.find((s) => s.id === 'mensa-instead-of-restaurant');
    expect(mensa).toMatchObject({ source: expect.stringContaining('Numbeo'), toSource: expect.stringContaining('Mensa') });
    // Every swap belongs to an envelope over its share.
    for (const s of part.swaps) expect(part.envelopes.find((e) => e.categoryId === s.categoryId)?.over).toBe(true);
  });

  it('on the Sunday after a month began mid-week, reviews the earlier days first, without a total', async () => {
    // 01-11-2026 is a Sunday; that week began on Monday 26-10-2026.
    const { data: c } = await checkIn(demo(), '2026-11-01');
    expect(c.parts.map((p) => [p.label, p.start, p.end])).toEqual([
      ['Earlier this week', '2026-10-26', '2026-10-31'],
      ['This week', '2026-11-01', '2026-11-01'],
    ]);
    expect(c.parts[0].total).toBeNull();
    expect(c.parts[1].total).not.toBeNull();
  });

  it('shows nothing from an account it can’t read', async () => {
    const { data: c } = await checkIn(null);
    expect(c).toMatchObject({ state: 'empty', parts: [], savedAt: null });
  });
});
