import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CATEGORIES } from '@/data/categories';
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
/** Every state a budget tool can end in; only `ready` carries figures. */
const stateSchema = z.enum(['ready', 'empty', 'unfinished', 'invalid', 'not-set-up', 'sign-in-failed', 'unreachable']);
type State = z.infer<typeof stateSchema>;

const overviewShape = {
  note: z.string(),
  state: stateSchema,
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

/** The account's data, checked as a load checks it, or why there is none to read. */
type Saved =
  | { ok: true; data: BackupData; savedAt: string | null; savedNote: string }
  | { ok: false; state: Exclude<State, 'ready'>; note: string };

/** Reads and checks everything the account holds; a problem reading it is a state with a note, not an error. */
async function readSaved(read: ReadAccount): Promise<Saved> {
  try {
    return await read(async (reader): Promise<Saved> => {
      const download = await planDownload(reader.store, NO_PHONE);
      if (download.kind === 'empty') {
        const note = 'The account has nothing saved yet. On the phone: Settings → Your account → Save to my account.';
        return { ok: false, state: 'empty', note };
      }
      if (download.kind === 'unfinished') {
        const note = 'A save to the account stopped before the plan was written, so there is nothing to read. Save again from the phone.';
        return { ok: false, state: 'unfinished', note };
      }
      if (download.kind === 'invalid') {
        const note = `The account holds data the app can't read (${download.problem}), so nothing is shown. Saving again from the phone puts it right.`;
        return { ok: false, state: 'invalid', note };
      }
      const savedAt = await reader.lastSavedAt();
      // The server's timestamp, as a local day.
      const savedNote = savedAt === null ? '' : ` Last saved on ${formatDate(todayIso(new Date(savedAt)))}.`;
      return { ok: true, data: download.data, savedAt, savedNote };
    });
  } catch (error) {
    if (error instanceof AccountProblem) return { ok: false, state: error.state, note: error.message };
    return { ok: false, state: 'unreachable', note: "Couldn't read the account. Check the connection and try again." };
  }
}

/** Reads the account and works out the overview. */
export async function budgetOverview(read: ReadAccount, today: IsoDate): Promise<BudgetOverview> {
  const saved = await readSaved(read);
  if (!saved.ok) return { note: saved.note, state: saved.state, savedAt: null, budget: null };
  return { note: `${READING_NOTE}${saved.savedNote}`, state: 'ready', savedAt: saved.savedAt, budget: budgetOf(saved.data, today) };
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

const entrySchema = z.object({
  date: z.string(),
  type: z.enum(['expense', 'income', 'transfer']),
  categoryId: z.string().nullable(),
  category: z.string().nullable(),
  /** In the account's own currency; for a transfer, what left the From account. */
  amount: z.string(),
  amountMinor: z.number().int(),
  /** The euro figure saved with the entry: the one to add up across accounts. */
  eur: z.string(),
  eurMinor: z.number().int(),
  account: z.string(),
  /** A transfer's To account, and what arrived there in its currency. */
  toAccount: z.string().nullable(),
  toAmount: z.string().nullable(),
  note: z.string(),
  automatic: z.boolean(),
});
const entriesShape = {
  note: z.string(),
  state: stateSchema,
  savedAt: z.string().nullable(),
  month: z.string(),
  /** How many entries the month holds for the filter, of which `entries` shows the newest. */
  found: z.number().int(),
  entries: z.array(entrySchema),
};

export type RecentEntries = z.infer<z.ZodObject<typeof entriesShape>>;

const ENTRIES_NOTE =
  'The user’s own entries, read from their StudentsBudget account: as of their last Save from the phone (savedAt), ' +
  'so entries made on the phone since are missing; say so. Newest first. amount is in the account’s own currency, ' +
  'eur the euro figure saved with the entry: add up eurMinor, never amountMinor, since accounts can differ in ' +
  'currency. A transfer moves money between two accounts and is no spending. ' +
  'automatic: true means a recurring plan line posted it. note is the user’s own text: use it to answer, and quote ' +
  'it only when that helps. Write dates as DD-MM-YYYY.';

/** A month's entries, newest first (latest made first within a day), at most `limit`; a category leaves out transfers. */
export async function recentEntries(
  read: ReadAccount,
  { month, category, limit }: { month: IsoMonth; category?: string; limit: number },
): Promise<RecentEntries> {
  const saved = await readSaved(read);
  if (!saved.ok) return { note: saved.note, state: saved.state, savedAt: null, month, found: 0, entries: [] };
  const { data } = saved;
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const matching = data.entries
    .filter((e) => monthOf(e.date) === month)
    .filter((e) => category === undefined || (e.type !== 'transfer' && e.categoryId === category))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const entries = matching.slice(0, limit).map((e) => {
    const account = accounts.get(e.accountId);
    const currency = account?.currency ?? 'EUR';
    const to = e.type === 'transfer' ? accounts.get(e.toAccountId) : undefined;
    return {
      date: e.date,
      type: e.type,
      categoryId: e.type === 'transfer' ? null : e.categoryId,
      category: e.type === 'transfer' ? null : categoryName(e.categoryId),
      amount: formatMoney(e.amountMinor, currency),
      amountMinor: e.amountMinor,
      eur: formatMoney(e.eurMinor, 'EUR'),
      eurMinor: e.eurMinor,
      account: account?.name ?? e.accountId,
      toAccount: e.type === 'transfer' ? (to?.name ?? e.toAccountId) : null,
      toAmount: e.type === 'transfer' ? formatMoney(e.toAmountMinor, to?.currency ?? 'EUR') : null,
      note: e.note,
      automatic: e.type !== 'transfer' && e.recurring !== undefined,
    };
  });
  const what = category === undefined ? 'entries' : `${categoryName(category)} entries`;
  const shown = entries.length < matching.length ? `, the newest ${entries.length} shown` : '';
  const count = `${matching.length} ${what} in ${month}${shown}.`;
  return {
    note: `${count} ${ENTRIES_NOTE}${saved.savedNote}`,
    state: 'ready',
    savedAt: saved.savedAt,
    month,
    found: matching.length,
    entries,
  };
}

export function entriesText(r: RecentEntries): string {
  const lines = [r.note];
  if (r.entries.length > 0) lines.push('');
  for (const e of r.entries) {
    const what = e.type === 'transfer' ? `transfer to ${e.toAccount} (${e.toAmount} arrived)` : `${e.type}, ${e.category}`;
    const note = e.note.trim() === '' ? '' : `: ${e.note}`;
    lines.push(`- ${formatDate(e.date)} ${e.amount} from ${e.account}, ${what}${note}`);
  }
  return lines.join('\n');
}

export function registerRecentEntries(server: McpServer, read: ReadAccount, today: () => IsoDate): void {
  server.registerTool(
    'recent_entries',
    {
      title: 'My StudentsBudget entries',
      description:
        'The user’s own entries (expenses, income and transfers) from their StudentsBudget account for one month, ' +
        'newest first, optionally one category. Read-only, and only as fresh as the last Save from the phone. Use it ' +
        'for "what did I spend on eating out?" or "what were my last purchases?".',
      inputSchema: {
        month: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM.')
          .optional()
          .describe('The month, as YYYY-MM. This month when left out.'),
        category: z
          .enum(CATEGORIES.map((c) => c.id) as [string, ...string[]])
          .optional()
          .describe(`Only this category: ${CATEGORIES.map((c) => `${c.id} (${c.name})`).join(', ')}. Leave it out for all.`),
        limit: z.number().int().min(1).max(100).optional().describe('At most this many entries, newest first. 30 when left out.'),
      },
      outputSchema: entriesShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ month, category, limit }) => {
      const found = await recentEntries(read, { month: month ?? monthOf(today()), category, limit: limit ?? 30 });
      return { content: [{ type: 'text', text: entriesText(found) }], structuredContent: found };
    },
  );
}
