import { isValid, parseISO } from 'date-fns';
import { z } from 'zod';
import type { BackupData } from '@/db/bulk';
import { todayIso } from '@/lib/dates';
import { CURRENCIES } from '@/lib/money';

export type { BackupData };

/** Bumped when the file's shape changes. A file with a higher number than this came from a newer app. */
export const BACKUP_VERSION = 1;

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
  z.object({ ...entryBase, type: z.enum(['expense', 'income']), categoryId: id }),
  z.object({ ...entryBase, type: z.literal('transfer'), toAccountId: id, toAmountMinor: minor }),
]);

const amount = z.object({ categoryId: id, monthlyMinor: minor });

const plan = z.object({
  id: z.literal('current'),
  cityId: z.literal('regensburg'),
  incomes: z.array(amount),
  fixed: z.array(amount),
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

const backupFile = z.object({
  app: z.literal(APP),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  data: z.object({
    accounts: z.array(account),
    categories: z.array(category),
    entries: z.array(entry),
    plan: plan.nullable(),
    guesses: z.array(guess),
    fxRates: z.array(rate),
  }),
});

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
