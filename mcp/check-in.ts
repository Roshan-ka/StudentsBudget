import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BackupData } from '@/db/bulk';
import type { Entry, Plan } from '@/db/types';
import { weekLine, weekTotalLine } from '@/features/check-in/week-line';
import { weekRows } from '@/features/check-in/week-rows';
import { weekSwaps } from '@/features/check-in/week-swaps';
import { weekToSpend } from '@/lib/budget';
import { formatDate, previousMonthTail, type IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { ReadAccount } from './account.ts';
import { readSaved, stateSchema } from './budget.ts';
import { categoryName } from './catalog.ts';
import { foundSwap, swapSchema } from './swaps.ts';

// The app's Sunday check-in (src/features/check-in/), from the account: the same functions build the same week.

const envelopeSchema = z.object({
  categoryId: z.string(),
  category: z.string(),
  /** The app's own line: "€70 planned · €20 spent · €50 under", or "€12 over". */
  line: z.string(),
  shareMinor: z.number().int(),
  spentMinor: z.number().int(),
  /** The envelope's month has nothing left, so the week has no share to compare with. */
  usedUp: z.boolean(),
  over: z.boolean(),
});
const entrySchema = z.object({
  date: z.string(),
  type: z.enum(['expense', 'income', 'transfer']),
  category: z.string().nullable(),
  amount: z.string(),
  eurMinor: z.number().int(),
  note: z.string(),
});
const partSchema = z.object({
  /** "This week", or "Earlier this week" for the days of the week that fell in the previous month. */
  label: z.string(),
  start: z.string(),
  end: z.string(),
  envelopes: z.array(envelopeSchema),
  /** Home's "This week" in one figure, for this week's part only, with the app's line for it; below zero when over. */
  total: z.object({ line: z.string(), minor: z.number().int() }).nullable(),
  /** A swap for each envelope over its share of the week, as the app's check-in offers them. */
  swaps: z.array(swapSchema),
  entries: z.array(entrySchema),
});
const checkInShape = {
  note: z.string(),
  state: stateSchema,
  savedAt: z.string().nullable(),
  parts: z.array(partSchema),
};

export type WeekCheckIn = z.infer<z.ZodObject<typeof checkInShape>>;
type Part = z.infer<typeof partSchema>;

const CHECK_IN_NOTE =
  'The user’s week as the StudentsBudget check-in shows it, read from their account: as of the phone’s last ' +
  'sync (savedAt), so anything entered since is missing; say so. Each envelope is measured against its share of ' +
  'the week (what was left of its month when the week began, split over the weeks left), not against the whole ' +
  'month: use its line as it stands. Only envelopes over their share get a swap, and swaps holds exactly those: ' +
  'offer no other. A swap’s source and url state the usual price, toSource and toUrl the cheaper one. When a month ' +
  'began mid-week, the first part covers the week’s days in the previous month. Rank expenses by eurMinor; note is ' +
  'the user’s own text, so quote it only when it helps. Write a figure below zero as "€12 over", never as failed ' +
  'or a warning, and dates as DD-MM-YYYY.';

/** The entries dated in the part, newest day first; within a day the entry saved last comes first, as the app lists them. */
function entriesOf(data: BackupData, start: IsoDate, end: IsoDate): Part['entries'] {
  const currencies = new Map(data.accounts.map((a) => [a.id, a.currency]));
  return data.entries
    .filter((e) => e.date >= start && e.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((e: Entry) => ({
      date: e.date,
      type: e.type,
      category: e.type === 'transfer' ? null : categoryName(e.categoryId),
      amount: formatMoney(e.amountMinor, currencies.get(e.accountId) ?? 'EUR'),
      eurMinor: e.eurMinor,
      note: e.note,
    }));
}

/** One part of the week as the app's WeekPart builds it, measured on `day`. */
function partOf(plan: Plan, data: BackupData, day: IsoDate, label: string, withTotal: boolean): Part {
  const week = weekToSpend(plan, data.entries, day);
  const rows = weekRows(plan, week.envelopes);
  const swaps = weekSwaps(rows, day);
  return {
    label,
    start: week.weekStart,
    end: week.weekEnd,
    envelopes: rows.map((row) => ({
      categoryId: row.categoryId,
      category: categoryName(row.categoryId),
      line: weekLine(row, row.usedUp),
      shareMinor: row.weekShareMinor,
      spentMinor: row.spentThisWeekMinor,
      usedUp: row.usedUp,
      over: row.spentThisWeekMinor > row.weekShareMinor,
    })),
    total: withTotal ? { line: weekTotalLine(week.totalMinor), minor: week.totalMinor } : null,
    swaps: rows.flatMap((row) => {
      const suggestion = swaps.get(row.categoryId);
      return suggestion === undefined ? [] : [foundSwap(suggestion.swap)];
    }),
    entries: entriesOf(data, week.weekStart, week.weekEnd),
  };
}

/** The week on `today`, in the parts the app's check-in shows: the earlier days in the previous month first. */
export async function weekCheckIn(read: ReadAccount, today: IsoDate): Promise<WeekCheckIn> {
  const saved = await readSaved(read);
  if (!saved.ok) return { note: saved.note, state: saved.state, savedAt: null, parts: [] };
  const plan = saved.data.plan;
  if (plan === null) return { note: CHECK_IN_NOTE, state: 'ready', savedAt: saved.savedAt, parts: [] };
  // As the app: on a Sunday when the month began mid-week, the week's days in the previous month come first,
  // measured on that month's last day; a month before the plan was set up has no budget, so it is left out.
  const tail = previousMonthTail(today);
  const earlierDay = tail !== null && tail.end >= plan.createdOn ? tail.end : null;
  const parts = [
    ...(earlierDay === null ? [] : [partOf(plan, saved.data, earlierDay, 'Earlier this week', false)]),
    partOf(plan, saved.data, today, 'This week', true),
  ];
  return { note: `${CHECK_IN_NOTE}${saved.savedNote}`, state: 'ready', savedAt: saved.savedAt, parts };
}

export function checkInText(c: WeekCheckIn): string {
  const lines = [c.note];
  for (const part of c.parts) {
    lines.push('', `${part.label} (${formatDate(part.start)} to ${formatDate(part.end)}):`);
    for (const e of part.envelopes) lines.push(`- ${e.category}: ${e.line}`);
    if (part.total !== null) lines.push(`${part.total.line}.`);
    for (const s of part.swaps) lines.push(`Try this: ${s.title}, about ${s.saving} less per ${s.per}.`);
  }
  return lines.join('\n');
}

export function registerWeekCheckIn(server: McpServer, read: ReadAccount, today: () => IsoDate): void {
  server.registerTool(
    'week_check_in',
    {
      title: 'My StudentsBudget week',
      description:
        'The user’s week as the StudentsBudget check-in shows it: each envelope against its share of the week, ' +
        'the total left this week, a sourced swap for each envelope over its share, and the week’s entries; on a ' +
        'Sunday when the month began mid-week, the earlier days of the week too. Read-only, as of the phone’s ' +
        'last sync.',
      inputSchema: {},
      outputSchema: checkInShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      const checkIn = await weekCheckIn(read, today());
      return { content: [{ type: 'text', text: checkInText(checkIn) }], structuredContent: checkIn };
    },
  );
}
