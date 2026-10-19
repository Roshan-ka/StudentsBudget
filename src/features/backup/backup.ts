import { isValid, parseISO } from 'date-fns';
import { z } from 'zod';
import type { BackupData } from '@/db/bulk';
import { todayIso } from '@/lib/dates';
import { CURRENCIES } from '@/lib/money';

export type { BackupData };

/**
 * Bumped when the file's shape changes. A file with a higher number than this came from a newer app.
 * Version 2 adds the plan's schedules and the entries' `recurring` marker, both optional, so version 1 files read.
 */
export const BACKUP_VERSION = 2;

const READABLE_VERSIONS = [1, BACKUP_VERSION] as const;

const APP = 'studentsbudget';

const NOT_A_BACKUP = "This isn't a StudentsBudget backup file.";
const NEWER_VERSION = 'This backup is from a newer version of the app.';
const INCOMPLETE = 'This backup file is incomplete.';

// The file is the only input the app does not write itself, so every field is checked, not only its type.
const text = z.string();
const id = z.string().min(1);
const minor = z.int();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)));
const isoMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)));
const currency = z.literal(CURRENCIES);

const account = z.object({
  id,
  name: text,
  kind: z.enum(['bank', 'cash']),
  currency,
  openingMinor: minor,
  createdAt: text,
});

const category = z.object({
  id,
  name: text,
  kind: z.enum(['flexible', 'fixed', 'oneoff', 'income']),
  order: z.int(),
});

const entryBase = {
  id,
  date: isoDate,
  accountId: id,
  amountMinor: minor,
  eurMinor: minor,
  note: text,
  createdAt: text,
};

const entry = z.discriminatedUnion('type', [
  z.object({
    ...entryBase,
    type: z.enum(['expense', 'income']),
    categoryId: id,
    recurring: z.object({ scheduleId: id }).optional(),
  }),
  z.object({ ...entryBase, type: z.literal('transfer'), toAccountId: id, toAmountMinor: minor }),
]);

const amount = z.object({ categoryId: id, monthlyMinor: minor });

const schedule = z.object({
  id,
  frequency: z.enum(['monthly', 'weekly']),
  day: z.int(),
  accountId: id,
  amountMinor: minor,
  startOn: isoDate,
  postedThrough: isoDate,
  paused: z.boolean().optional(),
});

const planLine = z.object({ categoryId: id, monthlyMinor: minor, schedule: schedule.optional() });

const plan = z.object({
  id: z.literal('current'),
  cityId: z.literal('regensburg'),
  incomes: z.array(planLine),
  fixed: z.array(planLine),
  oneOffs: z.array(
    z.object({ id, name: text, amountMinor: minor, createdMonth: isoMonth, dueMonth: isoMonth }),
  ),
  envelopes: z.array(amount),
  createdOn: isoDate,
});

const guess = z.object({ categoryId: id, monthlyMinor: minor, guessedOn: isoDate });

const rate = z.object({
  currency,
  perEur: z.number().positive(),
  rateDate: isoDate,
  fetchedOn: isoDate,
  source: z.enum(['ecb', 'manual']),
});

const backupData = z.object({
  accounts: z.array(account),
  categories: z.array(category),
  entries: z.array(entry),
  plan: plan.nullable(),
  guesses: z.array(guess),
  fxRates: z.array(rate),
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

/** The text of a backup file: the data, wrapped in the app name, the file version and the time it was made. */
export function serializeBackup(d: BackupData, now: Date): string {
  return JSON.stringify({ app: APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: d }, null, 2);
}

/**
 * Checks a file's text and gives back its data, or a message that says what is wrong with it.
 * The version is looked at before the rest, because a newer file may well have a shape this app does not know.
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
  return { ok: true, data: parsed.data.data, exportedAt: parsed.data.exportedAt };
}

/** `studentsbudget-backup-2026-10-16.json`: the local day it was made. */
export function backupFileName(now: Date): string {
  return `${APP}-backup-${todayIso(now)}.json`;
}

const dayFormatter = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });

/** The question asked before a backup replaces what is on the device: "…the backup from 16 Oct?" */
export function restoreQuestion(exportedAt: string): string {
  return `Replace all data on this device with the backup from ${dayFormatter.format(new Date(exportedAt))}?`;
}
