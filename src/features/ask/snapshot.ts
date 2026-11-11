import type { Entry, Plan, PlanMonth } from '@/db/types';
import { MAX_DATA } from '@/features/ai/contract';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { monthStatus, planSummary, setAsideBy, setAsideMonthly, weekToSpend } from '@/lib/budget';
import { monthOf, shiftMonth, weeksLeftInMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
// Read only: the function's own mask list (the AI phase, chunk 2). The function scrubs everything again.
import { scrub } from '../../../supabase/functions/_shared/ai/scrub';
import { planForMonth } from '@/lib/plan-history';

// What Ask tells the model about the student's budget (the AI phase, chunk 9, docs/superpowers/plans/2026-11-09-ai-phase-1.md):
// built on the phone when a conversation starts, from the app's own maths, so every figure equals what Home, the
// check-in and the recaps show. It goes to the function as `askRequest.snapshot`.
//
// The format is what the function's `unbackedAmounts` (chunk 8) reads:
// - every money value is in euros, a JSON number with at most two decimals, under a key ending in `Eur`;
// - no other number is money: counts and weeks are plain integers under other keys;
// - dates are ISO strings, categories go by id, and `categories` names each id used, in the phone's language.
//
// It never holds a balance, an account (its name, id or currency), the email or the username. Notes and one-off names
// are scrubbed here as well as on the server, and cut to NOTE_LENGTH.

/** The most recent expenses and incomes it lists, before the size bound. */
export const MAX_RECENT = 60;
/** The longest note or one-off name, in characters. */
export const NOTE_LENGTH = 60;
/** The month's largest expenses it lists. */
export const TOP_EXPENSES = 5;
/** The months before this one it lists per envelope. */
export const PAST_MONTHS = 2;
/** The one-offs it lists: the ones not yet due, soonest first. */
export const MAX_ONE_OFFS = 10;

type EnvelopeMonth = { categoryId: string; plannedEur: number; spentEur: number };

export type AskSnapshot = {
  month: IsoMonth;
  /** Each category id the snapshot uses, with its name in the phone's language. */
  categories: Record<string, string>;
  /** The plan this month, as Home's suggested budget weighs it (`planSummary`), with its lines. */
  plan: {
    incomeEur: number;
    fixedEur: number;
    setAsideEur: number;
    availableEur: number;
    envelopesEur: number;
    overByEur: number;
    spendingBudgetEur?: number;
    incomes: { categoryId: string; monthlyEur: number }[];
    fixed: { categoryId: string; monthlyEur: number }[];
  };
  /** Home's "Left this month": planned less spent over the envelopes, below zero when over, and each envelope. */
  thisMonth: {
    plannedEur: number;
    spentEur: number;
    leftEur: number;
    envelopes: (EnvelopeMonth & { leftEur: number })[];
  };
  /** Home's "This week" (`weekToSpend`), the weeks left in the month with this one, and each envelope's share. */
  thisWeek: {
    start: IsoDate;
    end: IsoDate;
    leftEur: number;
    weeksLeftInMonth: number;
    envelopes: { categoryId: string; shareEur: number; spentEur: number; safeEur: number }[];
  };
  /** The months before this one, newest first, from the month the plan began. */
  pastMonths: { month: IsoMonth; plannedEur: number; spentEur: number; envelopes: EnvelopeMonth[] }[];
  /** One-off costs not yet due: what this month sets aside for each, and what was set aside before it. */
  oneOffs: { name: string; amountEur: number; dueMonth: IsoMonth; setAsideThisMonthEur: number; setAsideBeforeEur: number }[];
  /** The month's largest expenses, largest first. */
  topExpenses: SnapshotEntry[];
  /** Expenses and incomes up to today, newest first: as many of MAX_RECENT as the size bound allows. */
  recent: SnapshotEntry[];
};

type SnapshotEntry = { date: IsoDate; type: 'expense' | 'income'; amountEur: number; categoryId: string; note?: string };

/** Cents to euros: a JSON number with at most two decimals. */
const eur = (minor: Minor): number => minor / 100;

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

/** Scrubbed, on one line and at most NOTE_LENGTH characters (whole code points, so no letter is cut in half). */
function shortText(text: string): string {
  return Array.from(scrub(text).replace(/\s+/g, ' ')).slice(0, NOTE_LENGTH).join('').trim();
}

function snapshotEntry(entry: Entry & { type: 'expense' | 'income' }): SnapshotEntry {
  const note = shortText(entry.note);
  return {
    date: entry.date,
    type: entry.type,
    amountEur: eur(entry.eurMinor),
    categoryId: entry.categoryId,
    ...(note !== '' && { note }),
  };
}

const isMoneyEntry = (entry: Entry): entry is Entry & { type: 'expense' | 'income' } => entry.type !== 'transfer';

/** Newest first: by date, then by when it was saved. */
const newestFirst = (a: Entry, b: Entry) =>
  a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date);

/** The bytes the function counts: UTF-8 JSON, as the contract's MAX_DATA. */
export function snapshotBytes(snapshot: AskSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

/**
 * The snapshot of the budget on `today`, with category names from `t` (the phone's dictionary). It fits MAX_DATA: when
 * it wouldn't, the oldest recent entries are left out first.
 */
export function askSnapshot(
  { plan, entries, planMonths = [] }: { plan: Plan; entries: Entry[]; planMonths?: readonly PlanMonth[] },
  today: IsoDate,
  t: Messages,
): AskSnapshot {
  const month = monthOf(today);
  const summary = planSummary(plan, month);
  const unpaused = <Line extends { schedule?: { paused?: boolean } }>(lines: Line[]) =>
    lines.filter((line) => !line.schedule?.paused);

  const status = monthStatus(plan, entries, month);
  const plannedMinor = sum(status.map((row) => row.plannedMinor));
  const spentMinor = sum(status.map((row) => row.spentMinor));
  // As Home: an envelope planned at €0 and never used would only add an empty row.
  const used = <Row extends { plannedMinor: Minor; spentMinor: Minor }>(rows: Row[]) =>
    rows.filter((row) => row.plannedMinor > 0 || row.spentMinor > 0);

  const week = weekToSpend(plan, entries, today);

  // A month before the plan began has no plan, so it says nothing.
  const firstMonth = monthOf(plan.createdOn);
  const pastMonths = Array.from({ length: PAST_MONTHS }, (_, i) => shiftMonth(month, -(i + 1)))
    .filter((past) => past >= firstMonth)
    .map((past) => {
      // Each past month against the plan it had (plan history).
      const rows = monthStatus(planForMonth(plan, planMonths, past, today), entries, past);
      return {
        month: past,
        plannedEur: eur(sum(rows.map((row) => row.plannedMinor))),
        spentEur: eur(sum(rows.map((row) => row.spentMinor))),
        envelopes: used(rows).map((row) => ({
          categoryId: row.categoryId,
          plannedEur: eur(row.plannedMinor),
          spentEur: eur(row.spentMinor),
        })),
      };
    });

  const oneOffs = plan.oneOffs
    .filter((o) => o.dueMonth >= month)
    .sort((a, b) => a.dueMonth.localeCompare(b.dueMonth))
    .slice(0, MAX_ONE_OFFS)
    .map((o) => ({
      name: shortText(o.name),
      amountEur: eur(o.amountMinor),
      dueMonth: o.dueMonth,
      setAsideThisMonthEur: eur(setAsideMonthly(o, month)),
      setAsideBeforeEur: eur(setAsideBy(o, month)),
    }));

  const money = entries.filter(isMoneyEntry);
  const topExpenses = money
    .filter((entry) => entry.type === 'expense' && monthOf(entry.date) === month)
    .sort((a, b) => b.eurMinor - a.eurMinor || newestFirst(a, b))
    .slice(0, TOP_EXPENSES)
    .map(snapshotEntry);
  const recent = money
    .filter((entry) => entry.date <= today)
    .sort(newestFirst)
    .slice(0, MAX_RECENT)
    .map(snapshotEntry);

  const snapshot: AskSnapshot = {
    month,
    categories: {},
    plan: {
      incomeEur: eur(summary.incomeMinor),
      fixedEur: eur(summary.fixedMinor),
      setAsideEur: eur(summary.setAsideMinor),
      availableEur: eur(summary.availableMinor),
      envelopesEur: eur(summary.envelopesMinor),
      overByEur: eur(summary.overByMinor),
      ...(plan.spendingBudgetMinor !== undefined && { spendingBudgetEur: eur(plan.spendingBudgetMinor) }),
      incomes: unpaused(plan.incomes).map((line) => ({ categoryId: line.categoryId, monthlyEur: eur(line.monthlyMinor) })),
      fixed: unpaused(plan.fixed).map((line) => ({ categoryId: line.categoryId, monthlyEur: eur(line.monthlyMinor) })),
    },
    thisMonth: {
      plannedEur: eur(plannedMinor),
      spentEur: eur(spentMinor),
      leftEur: eur(plannedMinor - spentMinor),
      envelopes: used(status).map((row) => ({
        categoryId: row.categoryId,
        plannedEur: eur(row.plannedMinor),
        spentEur: eur(row.spentMinor),
        leftEur: eur(row.plannedMinor - row.spentMinor),
      })),
    },
    thisWeek: {
      start: week.weekStart,
      end: week.weekEnd,
      leftEur: eur(week.totalMinor),
      weeksLeftInMonth: weeksLeftInMonth(today),
      envelopes: week.envelopes
        .filter((row) => row.weekShareMinor > 0 || row.spentThisWeekMinor > 0)
        .map((row) => ({
          categoryId: row.categoryId,
          shareEur: eur(row.weekShareMinor),
          spentEur: eur(row.spentThisWeekMinor),
          safeEur: eur(row.safeMinor),
        })),
    },
    pastMonths,
    oneOffs,
    topExpenses,
    recent,
  };

  // The size bound: the oldest recent entries go first, and the names go with what is left.
  snapshot.categories = namesOf(snapshot, t);
  while (snapshotBytes(snapshot) > MAX_DATA && snapshot.recent.length > 0) {
    snapshot.recent = snapshot.recent.slice(0, -1);
    snapshot.categories = namesOf(snapshot, t);
  }
  return snapshot;
}

/** Every category id the snapshot uses, named in the phone's language. */
function namesOf(snapshot: AskSnapshot, t: Messages): Record<string, string> {
  const ids = new Set<string>([
    ...snapshot.plan.incomes.map((line) => line.categoryId),
    ...snapshot.plan.fixed.map((line) => line.categoryId),
    ...snapshot.thisMonth.envelopes.map((row) => row.categoryId),
    ...snapshot.thisWeek.envelopes.map((row) => row.categoryId),
    ...snapshot.pastMonths.flatMap((past) => past.envelopes.map((row) => row.categoryId)),
    ...snapshot.topExpenses.map((entry) => entry.categoryId),
    ...snapshot.recent.map((entry) => entry.categoryId),
  ]);
  return Object.fromEntries([...ids].map((id) => [id, categoryNameIn(t, id)]));
}
