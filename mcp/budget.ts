import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BackupData } from '@/db/bulk';
import type { Account } from '@/db/types';
import { accountBalance, sortAccounts, totalInEur } from '@/features/accounts/balances';
import { monthStatus, weekToSpend } from '@/lib/budget';
import { formatDate, monthOf, todayIso, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { RateMap } from '@/lib/fx';
import { formatMoney, type Minor } from '@/lib/money';
import { planDownload } from '@/sync/download';
import { AccountProblem, type ReadAccount } from './account.ts';
import { categoryName } from './catalog.ts';

// The user's own budget from their account, worked out by the app's own maths. Node loads these `@/` imports through
// ./app-imports.ts, so whoever imports this file registers that first.

export type BudgetFigures = {
  month: IsoMonth;
  /** Planned less spent over the month's envelopes, as Home's "left this month"; below zero when over. */
  leftMinor: Minor;
  envelopes: { categoryId: string; plannedMinor: Minor; spentMinor: Minor }[];
  /** Home's "This week": the week's share of what is left, less this week's spending. */
  week: { start: IsoDate; end: IsoDate; leftMinor: Minor };
};

/** This month's figures on `today`, as Home shows them; null before a plan exists. */
export function budgetFigures(data: BackupData, today: IsoDate): BudgetFigures | null {
  if (data.plan === null) return null;
  const month = monthOf(today);
  const envelopes = monthStatus(data.plan, data.entries, month);
  const week = weekToSpend(data.plan, data.entries, today);
  return {
    month,
    leftMinor: envelopes.reduce((n, e) => n + e.plannedMinor - e.spentMinor, 0),
    envelopes,
    week: { start: week.weekStart, end: week.weekEnd, leftMinor: week.totalMinor },
  };
}

/** "€12.40", or "€12.40 over" below zero: calm, as the app words it. */
function leftText(minor: Minor): string {
  return minor < 0 ? `${formatMoney(-minor, 'EUR')} over` : formatMoney(minor, 'EUR');
}

/** One rate per currency, a manual rate over an ECB one, as the app's `loadRates`. */
function ratesOf(data: BackupData): RateMap {
  const rates: RateMap = {};
  for (const rate of data.fxRates) if (rate.source === 'ecb') rates[rate.currency] = rate;
  for (const rate of data.fxRates) if (rate.source === 'manual') rates[rate.currency] = rate;
  return rates;
}

const amountShape = { amount: z.string(), minor: z.number().int() };
const budgetSchema = z.object({
  month: z.string(),
  leftThisMonth: z.object(amountShape),
  thisWeek: z.object({ start: z.string(), end: z.string(), ...amountShape }),
  envelopes: z.array(
    z.object({
      categoryId: z.string(),
      category: z.string(),
      planned: z.string(),
      spent: z.string(),
      left: z.string(),
      plannedMinor: z.number().int(),
      spentMinor: z.number().int(),
    }),
  ),
  accounts: z.array(
    z.object({ name: z.string(), kind: z.string(), currency: z.string(), balance: z.string(), balanceMinor: z.number().int() }),
  ),
  totalInEur: z.object({ ...amountShape, missingRates: z.array(z.string()) }),
});
const overviewShape = {
  note: z.string(),
  state: z.enum(['ready', 'empty', 'unfinished', 'invalid', 'not-set-up', 'sign-in-failed', 'unreachable']),
  savedAt: z.string().nullable(),
  budget: budgetSchema.nullable(),
};

export type BudgetOverview = z.infer<z.ZodObject<typeof overviewShape>>;

/** The phone's own data isn't here: the account is read on its own, with no ECB rates of a phone to keep. */
const NO_PHONE: BackupData = {
  accounts: [],
  categories: [],
  entries: [],
  plan: null,
  guesses: [],
  fxRates: [],
  weekResults: [],
  discountVotes: [],
  profile: null,
};

const READING_NOTE =
  'These are the user’s own figures, read from their StudentsBudget account: as of their last Save from the phone ' +
  '(savedAt), so anything entered on the phone since is missing; say so. Budget figures are in euros, each account ' +
  'balance in its own currency. Write a figure below zero as "€12 over", never as failed or a warning. thisWeek is ' +
  'Home’s "This week": the week’s share of what is left this month, less this week’s spending. totalInEur leaves ' +
  'out the currencies in missingRates: the account keeps only manual rates. Write dates as DD-MM-YYYY.';

function budgetOf(data: BackupData, today: IsoDate): z.infer<typeof budgetSchema> | null {
  const figures = budgetFigures(data, today);
  if (figures === null) return null;
  const rates = ratesOf(data);
  const total = totalInEur(data.accounts, data.entries, rates);
  return {
    month: figures.month,
    leftThisMonth: { amount: leftText(figures.leftMinor), minor: figures.leftMinor },
    thisWeek: { start: figures.week.start, end: figures.week.end, amount: leftText(figures.week.leftMinor), minor: figures.week.leftMinor },
    // A category the plan leaves at €0 and nothing was spent on says nothing.
    envelopes: figures.envelopes
      .filter((e) => e.plannedMinor !== 0 || e.spentMinor !== 0)
      .map((e) => ({
        categoryId: e.categoryId,
        category: categoryName(e.categoryId),
        planned: formatMoney(e.plannedMinor, 'EUR'),
        spent: formatMoney(e.spentMinor, 'EUR'),
        left: leftText(e.plannedMinor - e.spentMinor),
        plannedMinor: e.plannedMinor,
        spentMinor: e.spentMinor,
      })),
    accounts: sortAccounts(data.accounts).map((a: Account) => {
      const balance = accountBalance(a, data.entries);
      return { name: a.name, kind: a.kind, currency: a.currency, balance: formatMoney(balance, a.currency), balanceMinor: balance };
    }),
    totalInEur: { amount: formatMoney(total.totalMinor, 'EUR'), minor: total.totalMinor, missingRates: total.missingRates },
  };
}

/** Reads the account and works out the overview; a problem reading it is a state with a note, not an error. */
export async function budgetOverview(read: ReadAccount, today: IsoDate): Promise<BudgetOverview> {
  const empty = { savedAt: null, budget: null };
  try {
    return await read(async (reader) => {
      const download = await planDownload(reader.store, NO_PHONE);
      if (download.kind === 'empty') {
        return {
          note: 'The account has nothing saved yet. On the phone: Settings → Your account → Save to my account.',
          state: 'empty' as const,
          ...empty,
        };
      }
      if (download.kind === 'unfinished') {
        return {
          note: 'A save to the account stopped before the plan was written, so there is no budget to read. Save again from the phone.',
          state: 'unfinished' as const,
          ...empty,
        };
      }
      if (download.kind === 'invalid') {
        return {
          note: `The account holds data the app can't read (${download.problem}), so no figures are shown. Saving again from the phone puts it right.`,
          state: 'invalid' as const,
          ...empty,
        };
      }
      const savedAt = await reader.lastSavedAt();
      // The server's timestamp, as a local day.
      const saved = savedAt === null ? '' : ` Last saved on ${formatDate(todayIso(new Date(savedAt)))}.`;
      return { note: `${READING_NOTE}${saved}`, state: 'ready' as const, savedAt, budget: budgetOf(download.data, today) };
    });
  } catch (error) {
    if (error instanceof AccountProblem) return { note: error.message, state: error.state, ...empty };
    return {
      note: "Couldn't read the account. Check the connection and try again.",
      state: 'unreachable',
      ...empty,
    };
  }
}

export function overviewText(o: BudgetOverview): string {
  const lines = [o.note];
  if (o.budget !== null) {
    const b = o.budget;
    lines.push(
      '',
      `Left this month (${b.month}): ${b.leftThisMonth.amount}.`,
      `This week (${formatDate(b.thisWeek.start)} to ${formatDate(b.thisWeek.end)}): ${b.thisWeek.amount}.`,
      'Envelopes:',
      ...b.envelopes.map(
        (e) => `- ${e.category}: ${e.spent} of ${e.planned}, ${e.plannedMinor < e.spentMinor ? e.left : `${e.left} left`}`,
      ),
      'Accounts:',
      ...b.accounts.map((a) => `- ${a.name}: ${a.balance}`),
      `Total in euros: ${b.totalInEur.amount}${b.totalInEur.missingRates.length > 0 ? ` (without ${b.totalInEur.missingRates.join(', ')}: no rate in the account)` : ''}.`,
    );
  }
  return lines.join('\n');
}

export function registerBudgetOverview(server: McpServer, read: ReadAccount, today: () => IsoDate): void {
  server.registerTool(
    'budget_overview',
    {
      title: 'My StudentsBudget overview',
      description:
        'The user’s own budget from their StudentsBudget account, as Home shows it: what is left this month and this ' +
        'week, each envelope’s spending against its plan, and the account balances. Read-only, and only as fresh as ' +
        'the last Save from the phone. Use it for questions about the user’s own money ("how much can I still ' +
        'spend this week?"), not for general Regensburg prices.',
      inputSchema: {},
      outputSchema: overviewShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      const overview = await budgetOverview(read, today());
      return { content: [{ type: 'text', text: overviewText(overview) }], structuredContent: overview };
    },
  );
}
