import { isValid, parseISO } from 'date-fns';
import { z } from 'zod';
import { hasSemesterYear } from '@/features/profile/profile';
import { CURRENCIES } from '@/lib/money';

// One schema per stored row, for data the app did not write itself on this phone: a backup file, and the rows that
// come back from the account. Every field is checked, not only its type. `backup.ts` builds the file's schema from
// these and checks at compile time that they match `types.ts`.

const text = z.string();
const id = z.string().min(1);
const minor = z.int();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)));
// A semester date also needs a year of four digits from 1000 on, which `semesterOn` builds its dates from.
const semesterDate = isoDate.refine(hasSemesterYear);
const isoMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)));
const currency = z.literal(CURRENCIES);

export const accountRow = z.object({
  id,
  name: text,
  kind: z.enum(['bank', 'cash']),
  currency,
  openingMinor: minor,
  createdAt: text,
  // Optional, like the plan's budget: a file from before the default account has none, and `Account.isDefault?: true`
  // must match for the type check in backup.ts.
  isDefault: z.literal(true).optional(),
});

export const categoryRow = z.object({
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

export const entryRow = z.discriminatedUnion('type', [
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

export const planRow = z.object({
  id: z.literal('current'),
  cityId: z.literal('regensburg'),
  incomes: z.array(planLine),
  fixed: z.array(planLine),
  oneOffs: z.array(
    z.object({ id, name: text, amountMinor: minor, createdMonth: isoMonth, dueMonth: isoMonth }),
  ),
  envelopes: z.array(amount),
  // Optional, as on `Plan`: older files have none, and the check in backup.ts needs the two types to agree.
  spendingBudgetMinor: minor.optional(),
  createdOn: isoDate,
});

export const guessRow = z.object({ categoryId: id, monthlyMinor: minor, guessedOn: isoDate });

export const rateRow = z.object({
  currency,
  perEur: z.number().positive(),
  rateDate: isoDate,
  fetchedOn: isoDate,
  source: z.enum(['ecb', 'manual']),
});

export const weekResultRow = z.object({
  weekStart: isoDate,
  weekEnd: isoDate,
  plannedMinor: minor,
  spentMinor: minor,
  foodSpentMinor: minor,
  eatingOutSpentMinor: minor,
  handLoggedCount: z.int().nonnegative(),
  paused: z.boolean(),
  recordedAt: text,
});

export const discountVoteRow = z.object({ discountId: id, vote: z.enum(['works', 'outdated']), on: isoDate });

// A field the user has not chosen yet is the empty string, not a missing key.
export const profileRow = z.object({
  id: z.literal('current'),
  name: text,
  university: z.enum(['ur', 'oth', 'other', '']),
  semesterStart: z.union([semesterDate, z.literal('')]),
  semesterEnd: z.union([semesterDate, z.literal('')]),
  updatedAt: text,
});
