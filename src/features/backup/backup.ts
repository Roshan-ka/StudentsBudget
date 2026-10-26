import { z } from 'zod';
import { CATEGORIES } from '@/data/categories';
import type { BackupData } from '@/db/bulk';
import {
  accountRow,
  categoryRow,
  discountVoteRow,
  entryRow,
  guessRow,
  planRow,
  profileRow,
  rateRow,
  weekResultRow,
} from '@/db/schemas';
import type { Category, Plan, Schedule } from '@/db/types';
import { addDays, formatDateTime, todayIso, weekOf } from '@/lib/dates';

export type { BackupData };

/**
 * Bumped when the file's shape changes. A file with a higher number than this came from a newer app.
 * Version 2 adds the plan's schedules and the entries' `recurring` marker, both optional, so version 1 files read.
 * Version 3 adds `weekResults`, `discountVotes` and `profile`; a file without them reads with those empty.
 * The plan's `spendingBudgetMinor` is optional, so it did not need a version: a file without it reads as a plan with
 * no budget, and an older app that reads one with it ignores it. An account's `isDefault` is optional for the same reason.
 */
export const BACKUP_VERSION = 3;

const READABLE_VERSIONS = [1, 2, BACKUP_VERSION] as const;

const APP = 'studentsbudget';

const NOT_A_BACKUP = "This isn't a StudentsBudget backup file.";
const NEWER_VERSION = 'This backup is from a newer version of the app.';
const INCOMPLETE = 'This backup file is incomplete.';

// A file is data this app did not write, so every field of every row is checked (the row schemas: src/db/schemas.ts).
const backupData = z.object({
  accounts: z.array(accountRow),
  categories: z.array(categoryRow),
  entries: z.array(entryRow),
  plan: planRow.nullable(),
  guesses: z.array(guessRow),
  fxRates: z.array(rateRow),
  // Version 3. The defaults let a version 1 or 2 file, which has none of these keys, read as "nothing saved yet".
  weekResults: z.array(weekResultRow).default([]),
  discountVotes: z.array(discountVoteRow).default([]),
  profile: profileRow.nullable().default(null),
});

const backupFile = z.object({
  app: z.literal(APP),
  version: z.literal(READABLE_VERSIONS),
  exportedAt: z.iso.datetime(),
  data: backupData,
});

// z.object drops the keys it does not know, and parseBackup hands its output on as a BackupData, which only
// checks one direction: a field added to a type but not to the schema would be exported and then vanish on
// restore, with no error anywhere. These types fail `npm run typecheck` instead, naming the table that differs.

/** Whether two types are the same one. Strict: an optional field is not a required one, and an extra key counts. */
type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** The same type with every intersection flattened into one object, so `A & B` and `{ ...A, ...B }` compare equal. */
type Flat<T> = T extends readonly (infer Item)[] ? Flat<Item>[] : T extends object ? { [K in keyof T]: Flat<T[K]> } : T;

type SchemaData = z.infer<typeof backupData>;

/** Per table: true when the schema's type and BackupData's agree, false when they differ or only one has the table. */
type TableAgreement = {
  [Table in keyof BackupData | keyof SchemaData]: Table extends keyof BackupData & keyof SchemaData
    ? Identical<Flat<BackupData[Table]>, Flat<SchemaData[Table]>>
    : false;
};

type AllTrue<T extends Record<keyof T, true>> = T;

/** Compiles only when every table agrees. Exported only so the lint rule for unused types leaves it alone. */
export type BackupSchemaMatchesTypes = AllTrue<TableAgreement>;

const BUILT_IN_CATEGORY_IDS: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.id));

/** Every schedule of the plan's income and fixed lines. */
function schedulesOf(plan: Plan | null): Schedule[] {
  if (!plan) return [];
  return [...plan.incomes, ...plan.fixed].flatMap((line) => (line.schedule ? [line.schedule] : []));
}

function hasDuplicates(keys: readonly string[]): boolean {
  return new Set(keys).size !== keys.length;
}

/**
 * Whether a schedule is one the app could have made. A damaged one could post thousands of entries on the
 * next start (a watermark far behind its start) or on days that do not exist (day 40).
 */
function isPossibleSchedule(schedule: Schedule, planCreatedOn: string): boolean {
  const lastDay = schedule.frequency === 'monthly' ? 31 : 7;
  return (
    schedule.day >= 1 &&
    schedule.day <= lastDay &&
    schedule.amountMinor > 0 &&
    // ISO dates sort the way the days do, so plain comparison is enough.
    schedule.startOn >= planCreatedOn &&
    schedule.postedThrough >= addDays(schedule.startOn, -1)
  );
}

/**
 * What the rows of a file that has the right shape say about each other, as the first thing that cannot be
 * true: a row that points at one the file does not have, two rows with a key that must be unique, a saved week
 * that is not a Monday–Sunday week, an amount that cannot happen. Null when nothing is wrong. `openingMinor` is
 * free: an account can be overdrawn.
 */
function findProblem(d: BackupData): string | null {
  const accountIds = new Set(d.accounts.map((a) => a.id));
  // A built-in category does not have to be in the file: parseBackup adds the ones that are missing.
  const categoryIds = new Set([...BUILT_IN_CATEGORY_IDS, ...d.categories.map((c) => c.id)]);
  const schedules = schedulesOf(d.plan);
  const planLines = d.plan ? [...d.plan.incomes, ...d.plan.fixed, ...d.plan.envelopes] : [];

  if (d.entries.some((e) => !accountIds.has(e.accountId))) return "an entry uses an account that isn't in the file";
  if (d.entries.some((e) => e.type === 'transfer' && !accountIds.has(e.toAccountId))) {
    return "a transfer goes to an account that isn't in the file";
  }
  if (schedules.some((s) => !accountIds.has(s.accountId))) {
    return "a fixed cost or income uses an account that isn't in the file";
  }
  if (d.entries.some((e) => e.type !== 'transfer' && !categoryIds.has(e.categoryId))) {
    return "an entry uses a category that isn't in the file";
  }
  if ([...planLines, ...d.guesses].some((line) => !categoryIds.has(line.categoryId))) {
    return 'the plan or the guesses use an unknown category';
  }

  // The keys of the tables. Without this check, restoring would fail on the second row that has the same key.
  const keyLists = [
    d.accounts.map((a) => a.id),
    d.categories.map((c) => c.id),
    d.entries.map((e) => e.id),
    (d.plan?.oneOffs ?? []).map((o) => o.id),
    schedules.map((s) => s.id),
    d.guesses.map((g) => g.categoryId),
    d.fxRates.map((r) => `${r.currency}+${r.source}`),
    d.weekResults.map((w) => w.weekStart),
    d.discountVotes.map((v) => v.discountId),
  ];
  if (keyLists.some(hasDuplicates)) return 'two rows share the same id';

  // A saved week runs Monday to Sunday and is keyed by its Monday. A row keyed by another day would not stop the
  // app from saving the real Monday as well, and that week would count twice.
  const weekOutOfShape = d.weekResults.some(
    (w) => weekOf(w.weekStart).start !== w.weekStart || w.weekEnd !== addDays(w.weekStart, 6),
  );
  if (weekOutOfShape) return "a saved week doesn't run from Monday to Sunday";

  const moneyOut =
    d.entries.some((e) => e.amountMinor <= 0 || (e.type === 'transfer' && e.toAmountMinor <= 0)) ||
    (d.plan?.oneOffs ?? []).some((o) => o.amountMinor <= 0) ||
    schedules.some((s) => s.amountMinor <= 0);
  if (moneyOut) return 'an amount is zero or negative';
  // Zero is fine for these: an envelope, a guess, the rent or the everyday budget can be 0, and a small amount can
  // convert to €0.00.
  const budget = d.plan?.spendingBudgetMinor ?? 0;
  if (
    d.entries.some((e) => e.eurMinor < 0) ||
    [...planLines, ...d.guesses].some((line) => line.monthlyMinor < 0) ||
    budget < 0
  ) {
    return 'an amount is negative';
  }
  // A paused or empty week is all zeros, and a plan can be €0, so zero is fine here too.
  const weekAmounts = d.weekResults.flatMap((w) => [w.plannedMinor, w.spentMinor, w.foodSpentMinor, w.eatingOutSpentMinor]);
  if (weekAmounts.some((amount) => amount < 0)) return 'an amount is negative';

  // There are schedules only when there is a plan.
  const createdOn = d.plan?.createdOn ?? '';
  if (schedules.some((s) => !isPossibleSchedule(s, createdOn))) {
    return 'a fixed cost or income has an impossible schedule';
  }
  return null;
}

/** The file's categories and every built-in one it lacks, so a file from before a category existed still restores all 26. */
function withBuiltInCategories(categories: Category[]): Category[] {
  const present = new Set(categories.map((c) => c.id));
  const missing = CATEGORIES.filter((c) => !present.has(c.id)).map((c) => ({ ...c }));
  return missing.length === 0 ? categories : [...categories, ...missing];
}

/** The text of a backup file: the data, wrapped in the app name, the file version and the time it was made. */
export function serializeBackup(d: BackupData, now: Date): string {
  return JSON.stringify({ app: APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: d }, null, 2);
}

/**
 * Checks a file's text and gives back its data, or a message that says what is wrong with it.
 * The version is looked at before the rest, because a newer file may well have a shape this app does not know.
 * A file of the right shape is then checked for what its rows say about each other (see `findProblem`), and
 * the built-in categories it lacks are added to the data it gives back.
 */
export function parseBackup(
  fileText: string,
): { ok: true; data: BackupData; exportedAt: string } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(fileText);
  } catch {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (typeof raw !== 'object' || raw === null || !('app' in raw) || raw.app !== APP) {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if ('version' in raw && typeof raw.version === 'number' && raw.version > BACKUP_VERSION) {
    return { ok: false, error: NEWER_VERSION };
  }
  const parsed = backupFile.safeParse(raw);
  if (!parsed.success) return { ok: false, error: INCOMPLETE };
  const data = parsed.data.data;
  const problem = findProblem(data);
  if (problem) return { ok: false, error: `This backup file is damaged: ${problem}.` };
  return {
    ok: true,
    data: { ...data, categories: withBuiltInCategories(data.categories) },
    exportedAt: parsed.data.exportedAt,
  };
}

/** `studentsbudget-backup-2026-10-16.json`: the local day it was made. */
export function backupFileName(now: Date): string {
  return `${APP}-backup-${todayIso(now)}.json`;
}

/** What the confirmation says under the file name: "Saved 19-10-2026, 12:00 · 3 accounts · 47 entries". */
export function backupSummary(d: BackupData, exportedAt: string): string {
  const accounts = d.accounts.length;
  const entries = d.entries.length;
  return [
    `Saved ${formatDateTime(exportedAt)}`,
    `${accounts} ${accounts === 1 ? 'account' : 'accounts'}`,
    `${entries} ${entries === 1 ? 'entry' : 'entries'}`,
  ].join(' · ');
}
