import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Account } from '@/db/types';
import { defaultAccount, sortAccounts } from '@/features/accounts/balances';
import { buildEntry } from '@/features/entries/build-entry';
import { EXPENSE_CATEGORIES } from '@/features/entries/categories';
import { suggestCategory } from '@/features/entries/quick-add';
import { isIsoDate } from '@/features/recurring/schedule';
import { formatDate, type IsoDate } from '@/lib/dates';
import { formatMoney, parseAmount } from '@/lib/money';
import { newId } from '@/lib/new-id';
import { ROW_CHECKS } from '@/sync/rows';
import { StoreError } from '@/sync/store';
import { AccountProblem, type ReadAccount } from './account.ts';
import { ratesOf, readSaved } from './budget.ts';
import { categoryName } from './catalog.ts';

// The server's one write (docs/superpowers/plans/2026-11-16-mcp-add-expense.md): an expense added to the user's
// account, built and checked by the app's own rules, which a linked phone pulls at its next sync. Node loads these `@/`
// imports through ./app-imports.ts, so whoever imports this file registers that first.

/** Every entry this server adds has an id with this start, so a later undo can only touch those. */
export const ADDED_ID_PREFIX = 'mcp-';

const EXPENSE_IDS = EXPENSE_CATEGORIES.map((c) => c.id) as [string, ...string[]];

/** What add_expense can end in: `added`, a refusal of what was asked, or one of the budget tools' account states. */
export const addStateSchema = z.enum([
  'added',
  'invalid-amount',
  'future-date',
  'unknown-account',
  'needs-category',
  'no-rate',
  'not-writable',
  // The budget tools' states for an account that can't be read (stateSchema without `ready`).
  'empty',
  'unfinished',
  'invalid',
  'not-set-up',
  'sign-in-failed',
  'needs-second-step',
  'unreachable',
  'refused',
  'error',
]);

const addedSchema = z.object({
  date: z.string(),
  account: z.string(),
  categoryId: z.string(),
  category: z.string(),
  /** In the account's own currency. */
  amount: z.string(),
  amountMinor: z.number().int(),
  eur: z.string(),
  eurMinor: z.number().int(),
  note: z.string(),
});

const addShape = {
  note: z.string(),
  state: addStateSchema,
  added: addedSchema.nullable(),
};

export type AddExpenseResult = z.infer<z.ZodObject<typeof addShape>>;

export type AddExpenseInput = { amount: string; note?: string; date?: string; category?: string; account?: string };

const ADDED_NOTE =
  'Added to the user’s StudentsBudget account. Their phone shows it after its next sync: on opening the app, ' +
  'within a minute while it is open, or with Sync now. Write the date as DD.MM.YYYY.';

const refused = (state: AddExpenseResult['state'], note: string): AddExpenseResult => ({ note, state, added: null });

/** The account the input names (its name, any case), the default one without a name, or why neither. */
function accountFor(accounts: Account[], name: string | undefined): Account | AddExpenseResult {
  if (accounts.length === 0) return refused('unknown-account', 'The account has no money accounts yet: set one up on the phone first.');
  if (name === undefined || name.trim() === '') return defaultAccount(sortAccounts(accounts)) ?? accounts[0];
  const wanted = name.trim().toLocaleLowerCase();
  const found = accounts.find((a) => a.name.trim().toLocaleLowerCase() === wanted);
  if (found !== undefined) return found;
  const names = sortAccounts(accounts).map((a) => a.name).join(', ');
  return refused('unknown-account', `There is no account called "${name.trim()}". The accounts are: ${names}. Nothing was added.`);
}

/** Builds the expense by the app's rules and adds it, or says why it didn't. */
export async function addExpense(read: ReadAccount, input: AddExpenseInput, today: IsoDate, now: Date): Promise<AddExpenseResult> {
  const amountMinor = parseAmount(input.amount);
  if (amountMinor === null || amountMinor <= 0) {
    return refused('invalid-amount', `"${input.amount}" isn’t an amount above zero, such as 6.50 or 6,50. Nothing was added.`);
  }
  const date = input.date ?? today;
  if (date > today) return refused('future-date', `${formatDate(date)} is in the future: an expense is added on the day it was paid. Nothing was added.`);

  const saved = await readSaved(read);
  if (!saved.ok) return refused(saved.state, saved.note);
  const { data } = saved;

  const account = accountFor(data.accounts, input.account);
  if ('state' in account) return account;

  const note = (input.note ?? '').trim();
  const categoryId = input.category ?? suggestCategory(note, data.entries);
  if (categoryId === null) {
    const list = EXPENSE_CATEGORIES.map((c) => `${c.id} (${c.name})`).join(', ');
    return refused('needs-category', `The note doesn’t say which category this is. Ask the user, then call again with category, one of: ${list}. Nothing was added.`);
  }

  const built = buildEntry(
    { id: `${ADDED_ID_PREFIX}${newId()}`, type: 'expense', date, accountId: account.id, amountMinor, categoryId, note },
    account,
    ratesOf(data),
    now,
  );
  if (!built.ok) {
    // The only refusal left once the amount is above zero: no rate for the account's currency. The account keeps only
    // the rates typed in by hand; the phone's daily ECB rates stay on the phone.
    return refused('no-rate', `${built.error} The account keeps only rates typed in by hand (Settings → Accounts and transfers on the phone). Add one there, or choose a euro account. Nothing was added.`);
  }
  const row = { id: built.entry.id, data: built.entry };
  // The check a pull makes: an entry the app would refuse never reaches the account.
  ROW_CHECKS.entries(row);

  try {
    const written = await read(async (reader) => {
      if (reader.entries === undefined) return false;
      await reader.entries.add(row);
      return true;
    });
    if (!written) return refused('not-writable', 'This account can’t be written from here. Nothing was added.');
  } catch (error) {
    if (error instanceof AccountProblem) return refused(error.state, error.message);
    console.error('StudentsBudget MCP server: adding an expense:', error);
    if (error instanceof StoreError && error.status === 0) {
      return refused('unreachable', 'Couldn’t reach the account. Check the connection and try again. Nothing was added.');
    }
    const detail = error instanceof Error ? error.message : String(error);
    return refused('refused', `The account refused the new expense: ${detail}. Nothing was added.`);
  }

  const entry = built.entry;
  return {
    note: ADDED_NOTE,
    state: 'added',
    added: {
      date: entry.date,
      account: account.name,
      categoryId,
      category: categoryName(categoryId),
      amount: formatMoney(entry.amountMinor, account.currency),
      amountMinor: entry.amountMinor,
      eur: formatMoney(entry.eurMinor, 'EUR'),
      eurMinor: entry.eurMinor,
      note: entry.type === 'transfer' ? '' : entry.note,
    },
  };
}

/** "Saved €6.50 · döner · Eating out · 15.11.2026, on Local bank.", as the phone's Saved line, plus the note. */
export function addedText(r: AddExpenseResult): string {
  if (r.added === null) return r.note;
  const a = r.added;
  const parts = [`Saved ${a.amount}`, ...(a.note === '' ? [] : [a.note]), a.category, formatDate(a.date)];
  return `${parts.join(' · ')}, on ${a.account}.\n${r.note}`;
}

export function registerAddExpense(server: McpServer, read: ReadAccount, today: () => IsoDate, now: () => Date = () => new Date()): void {
  server.registerTool(
    'add_expense',
    {
      title: 'Add an expense to my StudentsBudget',
      description:
        'Adds one expense to the user’s StudentsBudget account, as quick add on the phone would: the amount, an ' +
        'optional note, date, category and account. It can only add, never change or delete. Use it when the user ' +
        'asks to log something they paid ("add €6.50 döner yesterday"), never on your own. Leave category out to let ' +
        'the app guess it from the note; if it can’t, ask the user.',
      inputSchema: {
        amount: z.string().min(1).describe('What was paid, as typed: 6.50, 6,50 or 12. In the account’s currency.'),
        note: z.string().max(200).optional().describe('What it was for, in the user’s words: "döner", "Mensa lunch".'),
        date: z
          .string()
          .refine(isIsoDate, 'Use YYYY-MM-DD.')
          .optional()
          .describe('The day it was paid, as YYYY-MM-DD. Today when left out; never a future day.'),
        category: z
          .enum(EXPENSE_IDS)
          .optional()
          .describe(`One of: ${EXPENSE_CATEGORIES.map((c) => `${c.id} (${c.name})`).join(', ')}. Leave it out to guess from the note.`),
        account: z.string().optional().describe('The account’s name, as the user calls it. The default account when left out.'),
      },
      outputSchema: addShape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      const result = await addExpense(read, input, today(), now());
      return { content: [{ type: 'text', text: addedText(result) }], structuredContent: result };
    },
  );
}
