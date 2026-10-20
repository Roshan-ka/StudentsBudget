import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';
import type { BackupData } from '@/db/bulk';
import { BACKUP_VERSION, backupFileName, backupSummary, parseBackup, serializeBackup } from './backup';

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
    // What version 3 adds. A paused week and a vote of each kind, and a profile that is filled in.
    weekResults: [
      {
        weekStart: '2026-10-05',
        weekEnd: '2026-10-11',
        plannedMinor: 7_000,
        spentMinor: 6_500,
        foodSpentMinor: 4_000,
        eatingOutSpentMinor: 900,
        handLoggedCount: 3,
        paused: false,
        recordedAt: '2026-10-12T08:00:00.000Z',
      },
      {
        weekStart: '2026-10-12',
        weekEnd: '2026-10-18',
        plannedMinor: 7_000,
        spentMinor: 0,
        foodSpentMinor: 0,
        eatingOutSpentMinor: 0,
        handLoggedCount: 0,
        paused: true,
        recordedAt: '2026-10-19T08:00:00.000Z',
      },
    ],
    discountVotes: [
      { discountId: 'cinema-student', vote: 'works', on: '2026-10-20' },
      { discountId: 'mensa-card', vote: 'outdated', on: '2026-10-21' },
    ],
    profile: {
      id: 'current',
      name: 'Roshan',
      university: 'ur',
      semesterStart: '2026-10-12',
      semesterEnd: '2027-02-12',
      updatedAt: '2026-10-20T08:00:00.000Z',
    },
  };
}

/** The keys version 3 added. */
const VERSION_3_KEYS = ['weekResults', 'discountVotes', 'profile'] as const;

/** What a file from before version 3 gives back where `sample()` has week results, votes and a profile. */
function noVersion3Data(): Pick<BackupData, (typeof VERSION_3_KEYS)[number]> {
  return { weekResults: [], discountVotes: [], profile: null };
}

/** The file of an older version: the data without the keys that version did not know. */
function olderFileOf(data: BackupData, version: 1 | 2): string {
  return fileOf((file) => {
    file.version = version;
    for (const key of VERSION_3_KEYS) delete file.data[key];
  }, data);
}

/** What version 2 adds: schedules on the plan's lines and the entries a schedule posted. `sample()` has none of it, like a version 1 file. */
function sampleV2(): BackupData {
  const data = sample();
  data.plan = {
    ...data.plan!,
    createdOn: '2026-10-01',
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
    expect(BACKUP_VERSION).toBe(3);
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

  it('round-trips the week results, the votes and the profile, a paused week and both vote kinds included', () => {
    const data = sample();

    expect(parseBackup(serializeBackup(data, NOW))).toEqual({ ok: true, data, exportedAt: NOW.toISOString() });
    expect(data.weekResults.map((week) => week.paused)).toEqual([false, true]);
    expect(data.discountVotes.map((vote) => vote.vote)).toEqual(['works', 'outdated']);
  });

  it('round-trips the "I was away" marks of weeks not recorded yet: no amounts and an empty time', () => {
    const data = sample();
    const mark = (weekStart: string, weekEnd: string) => ({
      weekStart,
      weekEnd,
      plannedMinor: 0,
      spentMinor: 0,
      foodSpentMinor: 0,
      eatingOutSpentMinor: 0,
      handLoggedCount: 0,
      paused: true,
      recordedAt: '',
    });
    // Last week, waiting to be recorded, and the week still running.
    data.weekResults.push(mark('2026-10-19', '2026-10-25'), mark('2026-10-26', '2026-11-01'));

    expect(parseBackup(serializeBackup(data, NOW))).toEqual({ ok: true, data, exportedAt: NOW.toISOString() });
  });

  it('round-trips a profile that is still empty, and no week results or votes', () => {
    const data: BackupData = {
      ...sample(),
      ...noVersion3Data(),
      profile: { id: 'current', name: '', university: '', semesterStart: '', semesterEnd: '', updatedAt: '2026-10-20T08:00:00.000Z' },
    };

    expect(parseBackup(serializeBackup(data, NOW))).toEqual({ ok: true, data, exportedAt: NOW.toISOString() });
  });

  it('still reads a version 1 file, which has none of the new keys: they come back empty', () => {
    const text = olderFileOf(sample(), 1);

    expect(parseBackup(text)).toEqual({ ok: true, data: { ...sample(), ...noVersion3Data() }, exportedAt: NOW.toISOString() });
  });

  it('still reads a version 2 file, with its schedules but without week results, votes and profile', () => {
    const text = olderFileOf(sampleV2(), 2);

    expect(parseBackup(text)).toEqual({ ok: true, data: { ...sampleV2(), ...noVersion3Data() }, exportedAt: NOW.toISOString() });
  });

  it.each(VERSION_3_KEYS)('gives data.%s its empty value when only that key is missing', (key) => {
    const result = parseBackup(fileOf((file) => delete file.data[key]));

    expect(result).toEqual({ ok: true, data: { ...sample(), [key]: noVersion3Data()[key] }, exportedAt: NOW.toISOString() });
  });

  it('reads the demo backup, a version 1 file with 47 entries', () => {
    const result = parseBackup(DEMO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entries).toHaveLength(47);
    expect(result.data.accounts).toHaveLength(3);
    expect(result.data).toMatchObject(noVersion3Data());
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
    expect(parseBackup(fileOf((file) => (file.version = 4)))).toEqual({ ok: false, error: NEWER });
    const shapeUnknown = JSON.stringify({ app: 'studentsbudget', version: 4, exportedAt: NOW.toISOString(), data: { tomorrow: true } });
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

  type V3File = { data: { weekResults: Record<string, unknown>[]; discountVotes: Record<string, unknown>[]; profile: Record<string, unknown> } };

  it.each([
    ['a week that starts on no date', (file: V3File) => (file.data.weekResults[0].weekStart = '12/10/2026')],
    ['a week that ends on no date', (file: V3File) => (file.data.weekResults[0].weekEnd = '2026-02-30')],
    ['a week result without its start', (file: V3File) => delete file.data.weekResults[0].weekStart],
    ['a planned amount with decimals', (file: V3File) => (file.data.weekResults[0].plannedMinor = 70.5)],
    ['a spent amount that is text', (file: V3File) => (file.data.weekResults[0].spentMinor = '6500')],
    ['a food amount with decimals', (file: V3File) => (file.data.weekResults[0].foodSpentMinor = 4_000.5)],
    ['an eating-out amount with decimals', (file: V3File) => (file.data.weekResults[0].eatingOutSpentMinor = 0.5)],
    ['a hand-logged count with decimals', (file: V3File) => (file.data.weekResults[0].handLoggedCount = 2.5)],
    ['a hand-logged count below zero', (file: V3File) => (file.data.weekResults[0].handLoggedCount = -1)],
    ['a week result without its pause flag', (file: V3File) => delete file.data.weekResults[0].paused],
    ['a pause flag that is text', (file: V3File) => (file.data.weekResults[0].paused = 'yes')],
    ['a week result without its time', (file: V3File) => delete file.data.weekResults[0].recordedAt],
    ['a vote that is neither works nor outdated', (file: V3File) => (file.data.discountVotes[0].vote = 'maybe')],
    ['a vote without its discount', (file: V3File) => delete file.data.discountVotes[0].discountId],
    ['a vote with an empty discount id', (file: V3File) => (file.data.discountVotes[0].discountId = '')],
    ['a vote on no date', (file: V3File) => (file.data.discountVotes[0].on = 'today')],
    ['a profile that is not the current one', (file: V3File) => (file.data.profile.id = 'other')],
    ['a profile without its name', (file: V3File) => delete file.data.profile.name],
    ['an unknown university', (file: V3File) => (file.data.profile.university = 'mit')],
    ['a semester that starts on no date', (file: V3File) => (file.data.profile.semesterStart = '2026-13-01')],
    ['a semester that ends on no date', (file: V3File) => (file.data.profile.semesterEnd = 'March')],
    ['a profile that is not an object', (file: V3File) => (file.data.profile = 'Roshan' as never)],
    ['week results that are not a list', (file: V3File) => (file.data.weekResults = {} as never)],
  ])('says it is incomplete for %s', (_name, change) => {
    const text = fileOf((file) => change(file as unknown as V3File));

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

/** Rewrites the sample (or another base) in memory, writes it as a file and reads it back. */
function parseChanged(change: (data: BackupData) => void, base: () => BackupData = sample) {
  const data = base();
  change(data);
  return parseBackup(serializeBackup(data, NOW));
}

function damaged(reason: string): { ok: false; error: string } {
  return { ok: false, error: `This backup file is damaged: ${reason}.` };
}

function expenseRow(data: BackupData) {
  const row = data.entries[0];
  if (row.type === 'transfer') throw new Error('the first sample entry is an expense');
  return row;
}

function transferRow(data: BackupData) {
  const row = data.entries[2];
  if (row.type !== 'transfer') throw new Error('the third sample entry is a transfer');
  return row;
}

function rentSchedule(data: BackupData) {
  const found = data.plan?.fixed[0].schedule;
  if (!found) throw new Error('the version 2 sample has a rent schedule');
  return found;
}

function incomeSchedule(data: BackupData) {
  const found = data.plan?.incomes[0].schedule;
  if (!found) throw new Error('the version 2 sample has an income schedule');
  return found;
}

describe('parseBackup checks what the rows say about each other', () => {
  it('passes the sample, the version 2 sample and the demo backup', () => {
    expect(parseChanged(() => undefined).ok).toBe(true);
    expect(parseChanged(() => undefined, sampleV2).ok).toBe(true);
    expect(parseBackup(DEMO).ok).toBe(true);
  });

  describe('accounts', () => {
    it('refuses an entry that uses an account that is not in the file', () => {
      const result = parseChanged((data) => (data.entries[0].accountId = 'ghost'));

      expect(result).toEqual(damaged("an entry uses an account that isn't in the file"));
    });

    it('refuses a transfer that goes to an account that is not in the file', () => {
      const result = parseChanged((data) => (transferRow(data).toAccountId = 'ghost'));

      expect(result).toEqual(damaged("a transfer goes to an account that isn't in the file"));
    });

    it.each([
      ['a fixed cost', (data: BackupData) => (rentSchedule(data).accountId = 'ghost')],
      ['an income', (data: BackupData) => (incomeSchedule(data).accountId = 'ghost')],
    ])('refuses the schedule of %s that posts to an account that is not in the file', (_name, change) => {
      expect(parseChanged(change, sampleV2)).toEqual(damaged("a fixed cost or income uses an account that isn't in the file"));
    });

    it('passes a file with no accounts, no entries and no plan', () => {
      const result = parseChanged((data) => Object.assign(data, { accounts: [], entries: [], plan: null }));

      expect(result.ok).toBe(true);
    });
  });

  describe('categories', () => {
    it("refuses an entry in a category that is neither built in nor in the file's categories", () => {
      const result = parseChanged((data) => (expenseRow(data).categoryId = 'ghost'));

      expect(result).toEqual(damaged("an entry uses a category that isn't in the file"));
    });

    it('passes an entry in a built-in category the file does not list', () => {
      const result = parseChanged((data) => (data.categories = data.categories.filter((c) => c.id !== 'eating-out')));

      expect(result.ok).toBe(true);
    });

    it('passes an entry in a category of the file that is not built in', () => {
      const result = parseChanged((data) => {
        data.categories = [...data.categories, { id: 'pets', name: 'Pets', kind: 'flexible', order: 99 }];
        expenseRow(data).categoryId = 'pets';
      });

      expect(result.ok && result.data.categories).toHaveLength(27);
    });

    it.each([
      ['an income line', (data: BackupData) => (data.plan!.incomes[0].categoryId = 'ghost')],
      ['a fixed line', (data: BackupData) => (data.plan!.fixed[0].categoryId = 'ghost')],
      ['an envelope', (data: BackupData) => (data.plan!.envelopes[0].categoryId = 'ghost')],
      ['a guess', (data: BackupData) => (data.guesses[0].categoryId = 'ghost')],
    ])('refuses %s in an unknown category', (_name, change) => {
      expect(parseChanged(change)).toEqual(damaged('the plan or the guesses use an unknown category'));
    });

    it('passes a plan and guesses in built-in categories when the file lists no categories at all', () => {
      expect(parseChanged((data) => (data.categories = [])).ok).toBe(true);
    });
  });

  describe('ids that must be unique', () => {
    it.each([
      ['two accounts', (data: BackupData) => data.accounts.push({ ...data.accounts[0], name: 'Copy' })],
      ['two categories', (data: BackupData) => (data.categories = [...data.categories, { ...data.categories[0] }])],
      ['two entries', (data: BackupData) => (data.entries[1].id = data.entries[0].id)],
      ['two one-offs', (data: BackupData) => data.plan!.oneOffs.push({ ...data.plan!.oneOffs[0] })],
      ['two guesses for one category', (data: BackupData) => data.guesses.push({ ...data.guesses[0], monthlyMinor: 1 })],
      ['two rates of one currency and source', (data: BackupData) => data.fxRates.push({ ...data.fxRates[0], perEur: 96 })],
      ['two week results of one week', (data: BackupData) => data.weekResults.push({ ...data.weekResults[0], spentMinor: 1 })],
      ['two week results that start on one day', (data: BackupData) => (data.weekResults[1].weekStart = data.weekResults[0].weekStart)],
      ['two votes on one discount', (data: BackupData) => data.discountVotes.push({ ...data.discountVotes[0], vote: 'outdated' })],
    ])('refuses %s that share a key', (_name, change) => {
      expect(parseChanged(change)).toEqual(damaged('two rows share the same id'));
    });

    it('refuses two schedules with one id, across income and fixed or both on fixed', () => {
      const across = parseChanged((data) => (incomeSchedule(data).id = rentSchedule(data).id), sampleV2);
      const bothFixed = parseChanged((data) => {
        data.plan!.fixed[1].schedule = { ...rentSchedule(data) };
      }, sampleV2);

      expect(across).toEqual(damaged('two rows share the same id'));
      expect(bothFixed).toEqual(damaged('two rows share the same id'));
    });

    it('passes an ECB and a manual rate of one currency, which are two keys', () => {
      const data = sample();

      expect(data.fxRates.map((rate) => `${rate.currency}:${rate.source}`)).toEqual(['INR:ecb', 'INR:manual']);
      expect(parseBackup(serializeBackup(data, NOW)).ok).toBe(true);
    });

    it('passes the same week result as two different weeks, and the same vote kind on two discounts', () => {
      const result = parseChanged((data) => {
        data.weekResults.push({ ...data.weekResults[0], weekStart: '2026-10-19', weekEnd: '2026-10-25' });
        data.discountVotes.push({ ...data.discountVotes[0], discountId: 'bookshop' });
      });

      expect(result.ok && [result.data.weekResults.length, result.data.discountVotes.length]).toEqual([3, 3]);
    });

    it('passes a plan whose lines share a category, because the plan is one row', () => {
      const result = parseChanged((data) => data.plan!.fixed.push({ categoryId: 'rent', monthlyMinor: 1_000 }));

      expect(result.ok).toBe(true);
    });
  });

  describe('saved weeks that are not a Monday-Sunday week', () => {
    const OUT_OF_SHAPE = damaged("a saved week doesn't run from Monday to Sunday");

    it.each([
      // Tuesday 6 to Monday 12 October: six days on, but not from a Monday.
      ['a week that starts on a Tuesday', (data: BackupData) => Object.assign(data.weekResults[0], { weekStart: '2026-10-06', weekEnd: '2026-10-12' })],
      // Sunday 11 to Saturday 17 October: the Sunday before the week of 12 October, which the app would save too.
      ['a week keyed by its Sunday', (data: BackupData) => Object.assign(data.weekResults[1], { weekStart: '2026-10-11', weekEnd: '2026-10-17' })],
      ['a week that ends a day early', (data: BackupData) => (data.weekResults[0].weekEnd = '2026-10-10')],
      ['a week that ends a day late', (data: BackupData) => (data.weekResults[0].weekEnd = '2026-10-12')],
      ['a week that ends before it starts', (data: BackupData) => (data.weekResults[1].weekEnd = '2026-10-05')],
    ])('refuses %s', (_name, change) => {
      expect(parseChanged(change)).toEqual(OUT_OF_SHAPE);
    });

    it('passes weeks across a month end, the end of summer time and a year end', () => {
      const result = parseChanged((data) => {
        data.weekResults.push(
          { ...data.weekResults[0], weekStart: '2026-10-19', weekEnd: '2026-10-25' },
          { ...data.weekResults[0], weekStart: '2026-10-26', weekEnd: '2026-11-01' },
          { ...data.weekResults[0], weekStart: '2026-12-28', weekEnd: '2027-01-03' },
        );
      });

      expect(result.ok && result.data.weekResults.length).toBe(5);
    });

    it('reports two rows of one week as a shared key, before their shape', () => {
      expect(parseChanged((data) => (data.weekResults[1].weekStart = data.weekResults[0].weekStart))).toEqual(
        damaged('two rows share the same id'),
      );
    });
  });

  describe('amounts that must be above zero', () => {
    it.each([
      ['an entry of zero', (data: BackupData) => (data.entries[0].amountMinor = 0)],
      ['an entry below zero', (data: BackupData) => (data.entries[0].amountMinor = -600)],
      ['a transfer that arrives as zero', (data: BackupData) => (transferRow(data).toAmountMinor = 0)],
      ['a transfer that arrives below zero', (data: BackupData) => (transferRow(data).toAmountMinor = -1)],
      ['a one-off of zero', (data: BackupData) => (data.plan!.oneOffs[0].amountMinor = 0)],
      ['a one-off below zero', (data: BackupData) => (data.plan!.oneOffs[0].amountMinor = -30_000)],
    ])('refuses %s', (_name, change) => {
      expect(parseChanged(change)).toEqual(damaged('an amount is zero or negative'));
    });

    it.each([
      ['zero', 0],
      ['below zero', -40_000],
    ])('refuses a schedule amount of %s', (_name, amountMinor) => {
      const result = parseChanged((data) => (rentSchedule(data).amountMinor = amountMinor), sampleV2);

      expect(result).toEqual(damaged('an amount is zero or negative'));
    });
  });

  describe('amounts that may be zero but not negative', () => {
    it.each([
      ['an entry in EUR', (data: BackupData) => (data.entries[0].eurMinor = -1)],
      ['a transfer in EUR', (data: BackupData) => (transferRow(data).eurMinor = -1)],
      ['an income line', (data: BackupData) => (data.plan!.incomes[0].monthlyMinor = -1)],
      ['a fixed line', (data: BackupData) => (data.plan!.fixed[0].monthlyMinor = -1)],
      ['an envelope', (data: BackupData) => (data.plan!.envelopes[0].monthlyMinor = -1)],
      ['a guess', (data: BackupData) => (data.guesses[0].monthlyMinor = -1)],
      ['a planned week amount', (data: BackupData) => (data.weekResults[0].plannedMinor = -1)],
      ['a spent week amount', (data: BackupData) => (data.weekResults[0].spentMinor = -1)],
      ['a food week amount', (data: BackupData) => (data.weekResults[1].foodSpentMinor = -1)],
      ['an eating-out week amount', (data: BackupData) => (data.weekResults[1].eatingOutSpentMinor = -1)],
    ])('refuses %s below zero', (_name, change) => {
      expect(parseChanged(change)).toEqual(damaged('an amount is negative'));
    });

    it('passes zero envelopes, zero guesses, zero rent, zero income and a zero EUR value', () => {
      const result = parseChanged((data) => {
        data.plan!.envelopes = data.plan!.envelopes.map((line) => ({ ...line, monthlyMinor: 0 }));
        data.plan!.fixed = data.plan!.fixed.map((line) => ({ ...line, monthlyMinor: 0 }));
        data.plan!.incomes = data.plan!.incomes.map((line) => ({ ...line, monthlyMinor: 0 }));
        data.guesses = data.guesses.map((guess) => ({ ...guess, monthlyMinor: 0 }));
        data.entries[0].eurMinor = 0;
      });

      expect(result.ok).toBe(true);
    });

    it('passes a week of zeros, a plan of €0 and a count of 0, as a paused or empty week is', () => {
      const result = parseChanged((data) => {
        data.weekResults = data.weekResults.map((week) => ({
          ...week,
          plannedMinor: 0,
          spentMinor: 0,
          foodSpentMinor: 0,
          eatingOutSpentMinor: 0,
          handLoggedCount: 0,
        }));
      });

      expect(result.ok).toBe(true);
    });

    it('passes a negative opening balance, because an account can be overdrawn', () => {
      const result = parseChanged((data) => (data.accounts[0].openingMinor = -25_000));

      expect(result.ok).toBe(true);
    });
  });

  describe('schedules the app could not have made', () => {
    const IMPOSSIBLE = damaged('a fixed cost or income has an impossible schedule');

    it.each([
      ['a monthly day of 0', (data: BackupData) => (rentSchedule(data).day = 0)],
      ['a monthly day of 32', (data: BackupData) => (rentSchedule(data).day = 32)],
      ['a weekly day of 0', (data: BackupData) => (incomeSchedule(data).day = 0)],
      ['a weekly day of 8', (data: BackupData) => (incomeSchedule(data).day = 8)],
      ['a start before the plan was created', (data: BackupData) => (rentSchedule(data).startOn = '2026-09-30')],
      ['a watermark two days before the start', (data: BackupData) => (rentSchedule(data).postedThrough = '2026-09-29')],
      ['a watermark long before the start', (data: BackupData) => (incomeSchedule(data).postedThrough = '1999-01-01')],
    ])('refuses %s', (_name, change) => {
      expect(parseChanged(change, sampleV2)).toEqual(IMPOSSIBLE);
    });

    it('passes the edges: a start on the creation day, a watermark the day before the start, monthly day 31, weekly day 7', () => {
      const data = sampleV2();

      expect(data.plan?.createdOn).toBe('2026-10-01');
      expect(rentSchedule(data)).toMatchObject({ frequency: 'monthly', day: 31, startOn: '2026-10-01', postedThrough: '2026-09-30' });
      expect(incomeSchedule(data)).toMatchObject({ frequency: 'weekly', day: 7 });
      expect(parseBackup(serializeBackup(data, NOW)).ok).toBe(true);
    });

    it('passes day 1 of both kinds, and a watermark that has moved on', () => {
      const result = parseChanged((data) => {
        incomeSchedule(data).day = 1;
        rentSchedule(data).day = 1;
        rentSchedule(data).postedThrough = '2026-12-31';
      }, sampleV2);

      expect(result.ok).toBe(true);
    });
  });

  it('names the first problem when a file has several', () => {
    const result = parseChanged((data) => {
      data.entries[0].amountMinor = 0;
      data.entries[0].accountId = 'ghost';
    });

    expect(result).toEqual(damaged("an entry uses an account that isn't in the file"));
  });

  it('keeps the shape message for a file of the wrong shape: that is incomplete, not damaged', () => {
    expect(parseBackup(fileOf((file) => delete file.data.guesses))).toEqual({ ok: false, error: INCOMPLETE });
  });
});

describe('parseBackup fills in the built-in categories', () => {
  it('adds every built-in category a file does not have, so all 26 rows are there at once', () => {
    const result = parseChanged((data) => (data.categories = data.categories.filter((c) => c.kind !== 'income')));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.categories).toHaveLength(26);
    expect(result.data.categories.map((c) => c.id).sort()).toEqual(CATEGORIES.map((c) => c.id).sort());
    expect(result.data.categories.find((c) => c.id === 'income-job')).toEqual(CATEGORIES.find((c) => c.id === 'income-job'));
  });

  it('fills an empty list up to the 26', () => {
    const result = parseChanged((data) => (data.categories = []));

    expect(result.ok && result.data.categories).toEqual(CATEGORIES);
  });

  it("keeps the file's rows and their order when it lists every built-in category", () => {
    const reversed = [...CATEGORIES].reverse();
    const result = parseChanged((data) => (data.categories = reversed));

    expect(result.ok && result.data.categories).toEqual(reversed);
  });

  it('does not change a row the file has, even when its name differs from the built-in one', () => {
    const renamed = CATEGORIES.map((c) => (c.id === 'food' ? { ...c, name: 'Groceries' } : c));
    const result = parseChanged((data) => (data.categories = renamed));

    expect(result.ok && result.data.categories.find((c) => c.id === 'food')?.name).toBe('Groceries');
  });

  it('gives the demo backup, which lists 18 categories, all 26', () => {
    const result = parseBackup(DEMO);

    expect(result.ok && result.data.categories).toHaveLength(26);
  });
});

describe('backupFileName', () => {
  it('names the file after the local day', () => {
    expect(backupFileName(new Date(2026, 9, 16, 23, 59))).toBe('studentsbudget-backup-2026-10-16.json');
    expect(backupFileName(new Date(2026, 0, 5, 0, 1))).toBe('studentsbudget-backup-2026-01-05.json');
  });
});

describe('backupSummary', () => {
  it('gives the local date and time the backup was saved, and the counts of accounts and entries', () => {
    // Built from local parts, so the expectation holds in any time zone.
    const exportedAt = new Date(2026, 9, 19, 12, 0).toISOString();

    expect(backupSummary(sample(), exportedAt)).toBe('Saved 19-10-2026, 12:00 · 2 accounts · 3 entries');
  });

  it('says "1 account" and "1 entry" in the singular, and 0 as a plural', () => {
    const exportedAt = new Date(2026, 2, 2, 9, 5).toISOString();
    const one = { ...sample(), accounts: sample().accounts.slice(0, 1), entries: sample().entries.slice(0, 1) };
    const none = { ...sample(), accounts: [], entries: [] };

    expect(backupSummary(one, exportedAt)).toBe('Saved 02-03-2026, 09:05 · 1 account · 1 entry');
    expect(backupSummary(none, exportedAt)).toBe('Saved 02-03-2026, 09:05 · 0 accounts · 0 entries');
  });
});
