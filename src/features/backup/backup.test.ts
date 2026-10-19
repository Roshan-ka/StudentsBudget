import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import type { BackupData } from '@/db/bulk';
import { BACKUP_VERSION, backupFileName, parseBackup, restoreQuestion, serializeBackup } from './backup';

const NOW = new Date('2026-10-16T10:00:00.000Z');

const DEMO = readFileSync(new URL('../../../fixtures/studentsbudget-demo-2026-10.json', import.meta.url), 'utf8');

const NOT_A_BACKUP = "This isn't a StudentsBudget backup file.";
const NEWER = 'This backup is from a newer version of the app.';
const INCOMPLETE = 'This backup file is incomplete.';

function sample(): BackupData {
  return {
    accounts: [
      { id: 'a1', name: 'Local bank', kind: 'bank', currency: 'EUR', openingMinor: 100_000, createdAt: '2026-10-16T08:00:00.000Z' },
      { id: 'a2', name: 'Home bank', kind: 'bank', currency: 'INR', openingMinor: 5_000_000, createdAt: '2026-10-16T08:00:00.000Z' },
    ],
    categories: CATEGORIES,
    entries: [
      {
        id: 'e1',
        type: 'expense',
        date: '2026-10-16',
        accountId: 'a1',
        categoryId: 'eating-out',
        amountMinor: 600,
        eurMinor: 600,
        note: 'döner',
        createdAt: '2026-10-16T10:00:00.000Z',
      },
      {
        id: 'e2',
        type: 'income',
        date: '2026-10-01',
        accountId: 'a1',
        categoryId: 'income-parents',
        amountMinor: 50_000,
        eurMinor: 50_000,
        note: '',
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'e3',
        type: 'transfer',
        date: '2026-10-05',
        accountId: 'a2',
        toAccountId: 'a1',
        amountMinor: 950_000,
        toAmountMinor: 10_000,
        eurMinor: 10_000,
        note: '',
        createdAt: '2026-10-05T08:00:00.000Z',
      },
    ],
    plan: {
      id: 'current',
      cityId: 'regensburg',
      incomes: [{ categoryId: 'income-parents', monthlyMinor: 50_000 }],
      fixed: [{ categoryId: 'rent', monthlyMinor: 40_000 }],
      oneOffs: [{ id: 'o1', name: 'Semester fee', amountMinor: 30_000, createdMonth: '2026-10', dueMonth: '2027-03' }],
      envelopes: [{ categoryId: 'food', monthlyMinor: 31_000 }],
      createdOn: '2026-10-16',
    },
    guesses: [{ categoryId: 'food', monthlyMinor: 20_000, guessedOn: '2026-10-16' }],
    fxRates: [
      { currency: 'INR', perEur: 95, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'ecb' },
      { currency: 'INR', perEur: 97.5, rateDate: '2026-10-16', fetchedOn: '2026-10-16', source: 'manual' },
    ],
  };
}

/** What version 2 adds: schedules on the plan's lines and the entries a schedule posted. `sample()` has none of it, like a version 1 file. */
function sampleV2(): BackupData {
  const data = sample();
  data.plan = {
    ...data.plan!,
    incomes: [
      {
        categoryId: 'income-parents',
        monthlyMinor: 50_000,
        schedule: { id: 's-income', frequency: 'weekly', day: 7, accountId: 'a2', amountMinor: 1_000_000, startOn: '2026-10-01', postedThrough: '2026-10-11' },
      },
    ],
    fixed: [
      {
        categoryId: 'rent',
        monthlyMinor: 40_000,
        schedule: { id: 's-rent', frequency: 'monthly', day: 31, accountId: 'a1', amountMinor: 40_000, startOn: '2026-10-01', postedThrough: '2026-09-30', paused: true },
      },
      { categoryId: 'phone', monthlyMinor: 2_500 },
    ],
  };
  data.entries = [
    ...data.entries,
    {
      id: 'e4',
      type: 'expense',
      date: '2026-10-31',
      accountId: 'a1',
      categoryId: 'rent',
      amountMinor: 40_000,
      eurMinor: 40_000,
      note: '',
      createdAt: '2026-10-31T05:00:00.000Z',
      recurring: { scheduleId: 's-rent' },
    },
  ];
  return data;
}

/** The backup as the file holds it, for tests that break one part of it. */
function fileOf(
  change: (file: Record<string, unknown> & { data: Record<string, unknown> }) => void,
  data: BackupData = sample(),
): string {
  const file = JSON.parse(serializeBackup(data, NOW)) as Record<string, unknown> & { data: Record<string, unknown> };
  change(file);
  return JSON.stringify(file);
}

describe('serializeBackup and parseBackup', () => {
  it('writes the app, the version, the time and the data', () => {
    const file: unknown = JSON.parse(serializeBackup(sample(), NOW));

    expect(file).toEqual({ app: 'studentsbudget', version: BACKUP_VERSION, exportedAt: NOW.toISOString(), data: sample() });
    expect(BACKUP_VERSION).toBe(2);
  });

  it('round-trips every table, the ECB and the manual rate included', () => {
    const result = parseBackup(serializeBackup(sample(), NOW));

    expect(result).toEqual({ ok: true, data: sample(), exportedAt: NOW.toISOString() });
  });

  it('round-trips schedules and the entries a schedule posted, whether or not a schedule is paused', () => {
    const data = sampleV2();

    expect(parseBackup(serializeBackup(data, NOW))).toEqual({ ok: true, data, exportedAt: NOW.toISOString() });
    expect(data.plan?.incomes[0].schedule).not.toHaveProperty('paused');
    expect(data.plan?.fixed[0].schedule?.paused).toBe(true);
  });

  it('still reads a version 1 file, which has none of the new keys', () => {
    const text = fileOf((file) => (file.version = 1));

    expect(parseBackup(text)).toEqual({ ok: true, data: sample(), exportedAt: NOW.toISOString() });
  });

  it('reads the demo backup, a version 1 file with 47 entries', () => {
    const result = parseBackup(DEMO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries).toHaveLength(47);
    expect(result.data.accounts).toHaveLength(3);
  });

  it('round-trips a backup without a plan', () => {
    const data = { ...sample(), plan: null, entries: [], guesses: [] };

    expect(parseBackup(serializeBackup(data, NOW))).toEqual({ ok: true, data, exportedAt: NOW.toISOString() });
  });

  it('says it is not a backup for text that is not JSON', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: NOT_A_BACKUP });
    expect(parseBackup('')).toEqual({ ok: false, error: NOT_A_BACKUP });
  });

  it.each([
    ['an object of another app', '{"hello":"world"}'],
    ['another app name', JSON.stringify({ app: 'other', version: 1, exportedAt: NOW.toISOString(), data: sample() })],
    ['an array', '[]'],
    ['null', 'null'],
    ['a string', '"studentsbudget"'],
  ])('says it is not a backup for %s', (_name, text) => {
    expect(parseBackup(text)).toEqual({ ok: false, error: NOT_A_BACKUP });
  });

  it('rejects a newer version, whatever else the file holds', () => {
    expect(parseBackup(fileOf((file) => (file.version = 3)))).toEqual({ ok: false, error: NEWER });
    const shapeUnknown = JSON.stringify({ app: 'studentsbudget', version: 3, exportedAt: NOW.toISOString(), data: { tomorrow: true } });
    expect(parseBackup(shapeUnknown)).toEqual({ ok: false, error: NEWER });
  });

  it.each([
    ['a missing version', (file: Record<string, unknown>) => delete file.version],
    ['a version of 0', (file: Record<string, unknown>) => (file.version = 0)],
    ['a version that is text', (file: Record<string, unknown>) => (file.version = '1')],
    ['a missing time', (file: Record<string, unknown>) => delete file.exportedAt],
    ['a time that is not a date', (file: Record<string, unknown>) => (file.exportedAt = 'yesterday')],
    ['missing data', (file: Record<string, unknown>) => delete file.data],
  ])('says it is incomplete for %s', (_name, change) => {
    expect(parseBackup(fileOf(change))).toEqual({ ok: false, error: INCOMPLETE });
  });

  it.each(['accounts', 'categories', 'entries', 'plan', 'guesses', 'fxRates'])('says it is incomplete without data.%s', (key) => {
    expect(parseBackup(fileOf((file) => delete file.data[key]))).toEqual({ ok: false, error: INCOMPLETE });
  });

  it('says it is incomplete for an entry date that is not YYYY-MM-DD', () => {
    const text = fileOf((file) => {
      const entries = file.data.entries as { date: string }[];
      entries[0].date = '16/10/2026';
    });

    expect(parseBackup(text)).toEqual({ ok: false, error: INCOMPLETE });
  });

  it.each(['2026-13-01', '2026-02-30', '2026-10-1', '2026-10-16T10:00:00'])('rejects the date %s', (date) => {
    const text = fileOf((file) => {
      (file.data.entries as { date: string }[])[0].date = date;
    });

    expect(parseBackup(text)).toEqual({ ok: false, error: INCOMPLETE });
  });

  it.each(['2026-3', '2026-13', '2026-03-01', 'March'])('rejects the month %s', (month) => {
    const text = fileOf((file) => {
      const plan = file.data.plan as { oneOffs: { dueMonth: string }[] };
      plan.oneOffs[0].dueMonth = month;
    });

    expect(parseBackup(text)).toEqual({ ok: false, error: INCOMPLETE });
  });

  it.each([
    ['an amount with decimals', (file: { data: Record<string, unknown> }) => ((file.data.entries as { amountMinor: number }[])[0].amountMinor = 6.5)],
    ['an amount that is text', (file: { data: Record<string, unknown> }) => ((file.data.entries as { amountMinor: unknown }[])[0].amountMinor = '600')],
    ['an unknown currency', (file: { data: Record<string, unknown> }) => ((file.data.accounts as { currency: string }[])[0].currency = 'XYZ')],
    ['an unknown rate source', (file: { data: Record<string, unknown> }) => ((file.data.fxRates as { source: string }[])[0].source = 'bank')],
    ['a rate of zero', (file: { data: Record<string, unknown> }) => ((file.data.fxRates as { perEur: number }[])[0].perEur = 0)],
    ['an unknown entry type', (file: { data: Record<string, unknown> }) => ((file.data.entries as { type: string }[])[0].type = 'refund')],
    ['a transfer without its target', (file: { data: Record<string, unknown> }) => delete (file.data.entries as Record<string, unknown>[])[2].toAccountId],
    ['an unknown account kind', (file: { data: Record<string, unknown> }) => ((file.data.accounts as { kind: string }[])[0].kind = 'crypto')],
    ['an unknown category kind', (file: { data: Record<string, unknown> }) => ((file.data.categories as { kind: string }[])[0].kind = 'secret')],
    ['an unknown city', (file: { data: Record<string, unknown> }) => ((file.data.plan as { cityId: string }).cityId = 'berlin')],
  ])('says it is incomplete for %s', (_name, change) => {
    expect(parseBackup(fileOf(change))).toEqual({ ok: false, error: INCOMPLETE });
  });

  it.each([
    ['a schedule with an unknown frequency', (schedule: Record<string, unknown>) => (schedule.frequency = 'daily')],
    ['a schedule without an account', (schedule: Record<string, unknown>) => delete schedule.accountId],
    ['a schedule amount with decimals', (schedule: Record<string, unknown>) => (schedule.amountMinor = 4.5)],
    ['a schedule that starts on no date', (schedule: Record<string, unknown>) => (schedule.startOn = '1st')],
    ['a watermark that is not a date', (schedule: Record<string, unknown>) => (schedule.postedThrough = '2026-02-30')],
    ['a pause flag that is text', (schedule: Record<string, unknown>) => (schedule.paused = 'yes')],
  ])('says it is incomplete for %s', (_name, change) => {
    const text = fileOf((file) => {
      const plan = file.data.plan as { fixed: { schedule: Record<string, unknown> }[] };
      change(plan.fixed[0].schedule);
    }, sampleV2());

    expect(parseBackup(text)).toEqual({ ok: false, error: INCOMPLETE });
  });

  it('says it is incomplete for a recurring marker without its schedule', () => {
    const text = fileOf((file) => {
      const posted = (file.data.entries as { recurring?: Record<string, unknown> }[]).at(-1);
      delete posted!.recurring!.scheduleId;
    }, sampleV2());

    expect(parseBackup(text)).toEqual({ ok: false, error: INCOMPLETE });
  });

  it('ignores fields it does not know', () => {
    const text = fileOf((file) => {
      file.extra = true;
      (file.data.accounts as Record<string, unknown>[])[0].colour = 'red';
    });

    expect(parseBackup(text)).toEqual({ ok: true, data: sample(), exportedAt: NOW.toISOString() });
  });
});

describe('backupFileName', () => {
  it('names the file after the local day', () => {
    expect(backupFileName(new Date(2026, 9, 16, 23, 59))).toBe('studentsbudget-backup-2026-10-16.json');
    expect(backupFileName(new Date(2026, 0, 5, 0, 1))).toBe('studentsbudget-backup-2026-01-05.json');
  });
});

describe('restoreQuestion', () => {
  it('names the day the backup was made', () => {
    expect(restoreQuestion('2026-10-16T10:00:00.000Z')).toBe('Replace all data on this device with the backup from 16 Oct?');
    expect(restoreQuestion('2026-03-02T09:30:00.000Z')).toBe('Replace all data on this device with the backup from 2 Mar?');
  });
});
