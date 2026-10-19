import { db } from '@/db/db';
import { loadRates } from '@/db/rates';
import type { Account, Entry, PlanLine } from '@/db/types';
import { buildEntry } from '@/features/entries/build-entry';
import { categoryName } from '@/features/entries/categories';
import type { IsoDate } from '@/lib/dates';
import type { RateMap } from '@/lib/fx';
import { duePeriods, isIsoDate, isUsableSchedule, laterOf, occurrenceIn, periodOf } from './schedule';

/** The id of the entry a schedule posts for one period, so a period can only ever hold one. */
export function recurringEntryId(scheduleId: string, periodStart: IsoDate): string {
  return `rec:${scheduleId}:${periodStart}`;
}

type Context = {
  createdOn: IsoDate;
  today: IsoDate;
  accounts: Map<string, Account>;
  rates: RateMap;
  now: Date;
  /** Ids this run has added, in case two schedules share an id. */
  added: Set<string>;
};

/**
 * Whether a schedule already posted an entry of this type and category in the period: any schedule, so one that
 * replaced another for the same line finds what the old one posted. An entry logged by hand does not count.
 */
async function postedIn(
  period: { start: IsoDate; end: IsoDate },
  type: 'income' | 'expense',
  categoryId: string,
): Promise<boolean> {
  const found = await db.entries
    .where('date')
    .between(period.start, period.end, true, true)
    .filter((e) => e.type !== 'transfer' && e.type === type && e.categoryId === categoryId && e.recurring !== undefined)
    .first();
  return found !== undefined;
}

/**
 * Posts one line's due periods and returns the line with its watermark moved past them, or the line as it was.
 * Runs inside the caller's transaction.
 */
async function postLine(
  line: PlanLine,
  type: 'income' | 'expense',
  ctx: Context,
): Promise<{ line: PlanLine; posted: number }> {
  const s = line.schedule;
  if (!s || s.paused || !isUsableSchedule(s)) return { line, posted: 0 };
  // The account is gone: the editor asks for another, and nothing moves until then.
  const account = ctx.accounts.get(s.accountId);
  if (!account) return { line, posted: 0 };

  // Never before the plan existed, whatever a damaged or hand-edited schedule says.
  const periods = duePeriods({ ...s, startOn: laterOf(s.startOn, ctx.createdOn) }, ctx.today);
  // Every period handled, oldest first, and the entries to add for them (none for a period already posted).
  const handled: IsoDate[] = [];
  const toAdd: Entry[] = [];
  for (const start of periods) {
    // This line was posted in this period already, under the schedule it had before it was deleted and added again
    // or turned off and on: the new schedule's id would not find that entry, so the period itself is searched.
    if (await postedIn(periodOf(s, start), type, line.categoryId)) {
      handled.push(start);
      continue;
    }
    // The same path as a manual entry: the amount in the account's currency, converted with the rate in use.
    const result = buildEntry(
      {
        id: recurringEntryId(s.id, start),
        type,
        date: occurrenceIn(s, start),
        accountId: account.id,
        amountMinor: s.amountMinor,
        categoryId: line.categoryId,
        note: categoryName(line.categoryId),
      },
      account,
      ctx.rates,
      ctx.now,
    );
    // No rate for the account's currency: stop before this period and leave the watermark, so the next run retries.
    if (!result.ok || result.entry.type === 'transfer') break;
    handled.push(start);
    toAdd.push({ ...result.entry, recurring: { scheduleId: s.id } });
  }
  if (handled.length === 0) return { line, posted: 0 };

  // An entry whose id exists (restored from a backup, say, or moved to another day) is not added again.
  const existing = await db.entries.bulkGet(toAdd.map((e) => e.id));
  const fresh = toAdd.filter((entry, i) => existing[i] === undefined && !ctx.added.has(entry.id));
  if (fresh.length > 0) await db.entries.bulkAdd(fresh);
  for (const entry of fresh) ctx.added.add(entry.id);

  const through = periodOf(s, handled[handled.length - 1]).end;
  return {
    line: { ...line, schedule: { ...s, postedThrough: laterOf(s.postedThrough, through) } },
    posted: fresh.length,
  };
}

async function postDue(today: IsoDate): Promise<{ posted: number }> {
  return db.transaction('rw', db.plan, db.entries, db.accounts, db.fxRates, async () => {
    const plan = await db.plan.get('current');
    if (!plan || !isIsoDate(plan.createdOn) || !isIsoDate(today)) return { posted: 0 };

    const ctx: Context = {
      createdOn: plan.createdOn,
      today,
      accounts: new Map((await db.accounts.toArray()).map((a) => [a.id, a])),
      // Inside the transaction, so the rates are read in it too.
      rates: await loadRates(),
      now: new Date(),
      added: new Set(),
    };

    let posted = 0;
    const run = async (lines: PlanLine[], type: 'income' | 'expense'): Promise<PlanLine[]> => {
      const out: PlanLine[] = [];
      for (const line of lines) {
        const result = await postLine(line, type, ctx);
        posted += result.posted;
        out.push(result.line);
      }
      return out;
    };
    const incomes = await run(plan.incomes, 'income');
    const fixed = await run(plan.fixed, 'expense');

    const moved = incomes.some((l, i) => l !== plan.incomes[i]) || fixed.some((l, i) => l !== plan.fixed[i]);
    if (moved) await db.plan.put({ ...plan, incomes, fixed });
    return { posted };
  });
}

// Runs go one after another, so two calls from the same tab (start-up and a return to the app) never overlap. Two
// tabs each have their own queue; there the one read-write transaction over the plan and the entries does the same.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Adds the fixed costs and income that are due by `today` as entries: each income or fixed line whose schedule is
 * not paused gets one entry per due period, oldest first, and its watermark (`postedThrough`) moves to the end of the
 * last period handled. The plan is read and written in one read-write transaction with the entries. Resolves with how
 * many entries were added.
 */
export function postDueRecurring(today: IsoDate): Promise<{ posted: number }> {
  const run = queue.then(() => postDue(today));
  queue = run.catch(() => undefined);
  return run;
}
