'use client';

import { parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, useId, useState, type PointerEvent, type ReactNode } from 'react';
import { Bar, BarChart, LabelList, Rectangle, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import type { Entry, Plan } from '@/db/types';
import { categoryName, EXPENSE_CATEGORIES } from '@/features/entries/categories';
import { firstOfMonth, monthOf, shiftMonth, type IsoDate, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { formatWeekAmount } from '@/lib/week-amount';
import { categoryHistory, incomeBySource, spendingByCategory } from './aggregate';

// One hue for every amount (slot 1 of the dataviz palette) and a lighter step of it for what was planned.
// The two steps were validated as an ordinal pair against the light and the dark surface.
const CHART_CONFIG = {
  spent: { label: 'Spent', theme: { light: '#2a78d6', dark: '#3987e5' } },
  planned: { label: 'Planned', theme: { light: '#86b6ef', dark: '#184f95' } },
  income: { label: 'Income', theme: { light: '#2a78d6', dark: '#3987e5' } },
} satisfies ChartConfig;

/** Whole euros; a non-zero amount under 50 cents keeps its cents, so it does not read as €0. */
const amountText = (minor: Minor): string => formatWeekAmount(minor).text;

/** Names that would not fit next to their bars; the table and the tooltip keep the full name. */
const AXIS_NAMES: Record<string, string> = { 'transport-pass': 'Semester ticket' };

const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });
const monthOnly = new Intl.DateTimeFormat('en-IE', { month: 'long' });
const shortMonth = new Intl.DateTimeFormat('en-IE', { month: 'short' });

const monthDate = (month: IsoMonth): Date => parseISO(firstOfMonth(month));

const dayAndMonth = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' });

/** "Budget starts 16 Oct.", for the month the plan was set up in, unless that was on the 1st; null otherwise. */
function budgetStartNote(plan: Plan, month: IsoMonth): string | null {
  const { createdOn } = plan;
  if (monthOf(createdOn) !== month || createdOn === firstOfMonth(month)) return null;
  return `Budget starts ${dayAndMonth.format(parseISO(createdOn))}.`;
}

/** "/entries?category=eating-out&month=2026-10": the entries behind one bar. */
function entriesHref(categoryId: string, month: IsoMonth): string {
  return `/entries?${new URLSearchParams({ category: categoryId, month }).toString()}`;
}

const LINK_CLASS = 'text-primary underline-offset-4 hover:underline';

/** One bar: a category in the month, or one month of a category. */
type BarRow = {
  /** The category id, or the month for the history. */
  id: string;
  /** The full name, for the table and the tooltip. */
  label: string;
  amountMinor: Minor;
  /** What was planned; null for a bar without a plan. */
  plannedMinor: Minor | null;
  /** The entries behind the bar. */
  href: string;
};

/** "€20 of €160", or just "€20" for what has no plan. Home writes the envelopes the same way. */
function rowText(row: BarRow): string {
  return row.plannedMinor === null
    ? amountText(row.amountMinor)
    : `${amountText(row.amountMinor)} of ${amountText(row.plannedMinor)}`;
}

/** The bar the pointer is on, and where the pointer is in the window. */
type HoverPoint = { row: BarRow; x: number; y: number };

type OnHover = (hover: HoverPoint | null) => void;

/**
 * Draws a bar and, behind it, a transparent target as big as the bar's whole row (or column), so a tap does not
 * have to land on a 10 px bar. A click opens the entries of the bar's row, and the row lights up under a pointer
 * and reports it to `onHover`. Bars that are zero long are still drawn through this, so every row stays tappable.
 * `band` is the thickness of one row or column, given the width and height of the chart. (The chart's own
 * tooltip is not used: it works out the row from the pointer on its own and was a row off in this layout.)
 */
function openableBar(
  direction: 'row' | 'column',
  band: (chart: { width: number; height: number }) => number,
  onOpen: (href: string) => void,
  onHover: OnHover,
) {
  return function OpenableBar(props: BarShapeProps) {
    const row = props.payload as BarRow | undefined;
    const { x, y, width, height, parentViewBox: chart } = props;
    const size = band(chart);
    const hit =
      direction === 'row'
        ? { x: chart.x, y: y + height / 2 - size / 2, width: chart.width, height: size }
        : { x: x + width / 2 - size / 2, y: chart.y, width: size, height: chart.height };
    // A finger has no hover: a tap only opens the entries.
    const point = (event: PointerEvent<SVGGElement>) =>
      row && event.pointerType !== 'touch' ? { row, x: event.clientX, y: event.clientY } : null;
    return (
      <g
        className="group cursor-pointer"
        onClick={() => row && onOpen(row.href)}
        onPointerMove={(event) => onHover(point(event))}
        onPointerLeave={() => onHover(null)}
      >
        <rect {...hit} className="fill-transparent group-hover:fill-muted/60" />
        <Rectangle x={x} y={y} width={width} height={height} radius={props.radius} fill={props.fill} />
      </g>
    );
  };
}

/** The readout on hover. Everything in it is also printed on the chart and in the table, so it never gates a number. */
function BarTooltip({ row, valueLabel }: { row: BarRow; valueLabel: string }) {
  return (
    <div
      role="tooltip"
      className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
    >
      <p className="font-medium">{row.label}</p>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">{valueLabel}</span>
        <span className="font-medium tabular-nums">{amountText(row.amountMinor)}</span>
      </p>
      {row.plannedMinor !== null && (
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Planned</span>
          <span className="font-medium tabular-nums">{amountText(row.plannedMinor)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * One chart for a screen reader (an image, with the table next to it as its text) and the tooltip above the bar
 * the pointer is on. `children` gets the handler the bars report the pointer to.
 */
function ChartFrame({
  summary,
  valueLabel,
  children,
}: {
  summary: string;
  valueLabel: string;
  children: (onHover: OnHover) => ReactNode;
}) {
  const [hover, setHover] = useState<HoverPoint | null>(null);

  return (
    <div role="img" aria-label={summary}>
      {children(setHover)}
      {hover && (
        // Above the pointer, and never past either edge of the window.
        <div
          className="pointer-events-none fixed z-10 -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: `clamp(4.5rem, ${hover.x}px, calc(100vw - 4.5rem))`, top: hover.y }}
        >
          <BarTooltip row={hover.row} valueLabel={valueLabel} />
        </div>
      )}
    </div>
  );
}

const ROW_HEIGHT = 44;
const LEGEND_HEIGHT = 28;
const NAME_WIDTH = 96;
const VALUE_WIDTH = 96;
const MARGIN_Y = 4;
const COLUMN_MARGIN_X = 8;

type Router = ReturnType<typeof useRouter>;

/**
 * The horizontal bars themselves. Memoised on purpose: recharts rebuilds every bar each time it renders, and a
 * click that is half done (pressed, not yet released) is lost when its bar is replaced under it. So the tooltip
 * following the pointer, which re-renders the frame around this, must not re-render this.
 */
const RowsChart = memo(function RowsChart({
  rows,
  seriesKey,
  withPlanned,
  router,
  onHover,
}: {
  rows: BarRow[];
  seriesKey: 'spent' | 'income';
  withPlanned: boolean;
  router: Router;
  onHover: OnHover;
}) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const max = Math.max(1, ...rows.flatMap((row) => [row.amountMinor, row.plannedMinor ?? 0]));
  // The plot is exactly `rows.length * ROW_HEIGHT` high, so every row gets a band of ROW_HEIGHT.
  const height = rows.length * ROW_HEIGHT + 2 * MARGIN_Y + (withPlanned ? LEGEND_HEIGHT : 0);

  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-auto w-full" style={{ height }}>
      <BarChart
        accessibilityLayer={false}
        layout="vertical"
        data={rows}
        margin={{ top: MARGIN_Y, right: 0, bottom: MARGIN_Y, left: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide domain={[0, max]} />
        <YAxis
          yAxisId="names"
          type="category"
          dataKey="id"
          width={NAME_WIDTH}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tickFormatter={(id: string) => AXIS_NAMES[id] ?? byId.get(id)?.label ?? id}
        />
        <YAxis
          yAxisId="values"
          orientation="right"
          type="category"
          dataKey="id"
          width={VALUE_WIDTH}
          tickLine={false}
          axisLine={false}
          // The numbers are the point: the main text colour, where the names are muted.
          className="[&_.recharts-cartesian-axis-tick_text]:fill-foreground"
          tickFormatter={(id: string) => {
            const row = byId.get(id);
            return row ? rowText(row) : '';
          }}
        />
        {withPlanned && (
          <ChartLegend verticalAlign="top" height={LEGEND_HEIGHT} content={<ChartLegendContent nameKey="value" />} />
        )}
        {withPlanned && (
          <Bar
            yAxisId="names"
            dataKey="plannedMinor"
            name="planned"
            fill="var(--color-planned)"
            barSize={20}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        )}
        <Bar
          yAxisId="values"
          dataKey="amountMinor"
          name={seriesKey}
          fill={`var(--color-${seriesKey})`}
          barSize={withPlanned ? 10 : 16}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          shape={openableBar('row', () => ROW_HEIGHT, (href) => router.push(href), onHover)}
        />
      </BarChart>
    </ChartContainer>
  );
});

/**
 * Horizontal bars, one row per category, with the numbers in a column at the right edge (they never collide
 * with a bar or run off its end). With planned amounts it is a bullet chart: a thin dark bar for what was spent
 * on top of a thick light one for what was planned, so overspending reads as the dark bar sticking out.
 * Tapping a row opens its entries.
 */
function HorizontalBars({
  rows,
  seriesKey,
  withPlanned,
  summary,
}: {
  rows: BarRow[];
  seriesKey: 'spent' | 'income';
  withPlanned: boolean;
  summary: string;
}) {
  const router = useRouter();
  return (
    <ChartFrame summary={summary} valueLabel={seriesKey === 'spent' ? 'Spent' : 'Income'}>
      {(onHover) => (
        <RowsChart rows={rows} seriesKey={seriesKey} withPlanned={withPlanned} router={router} onHover={onHover} />
      )}
    </ChartFrame>
  );
}

/** The columns themselves; memoised for the reason `RowsChart` is. */
const ColumnsChart = memo(function ColumnsChart({
  rows,
  router,
  onHover,
}: {
  rows: BarRow[];
  router: Router;
  onHover: OnHover;
}) {
  const max = Math.max(1, ...rows.map((row) => row.amountMinor));
  const band = (chart: { width: number }) => (chart.width - 2 * COLUMN_MARGIN_X) / rows.length;

  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-auto h-52 w-full">
      <BarChart
        accessibilityLayer={false}
        data={rows}
        margin={{ top: 22, right: COLUMN_MARGIN_X, bottom: 0, left: COLUMN_MARGIN_X }}
      >
        <XAxis
          dataKey="id"
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tickFormatter={(month: IsoMonth) => shortMonth.format(monthDate(month))}
        />
        <YAxis hide domain={[0, max]} />
        <Bar
          dataKey="amountMinor"
          name="spent"
          fill="var(--color-spent)"
          barSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
          shape={openableBar('column', band, (href) => router.push(href), onHover)}
        >
          <LabelList
            dataKey="amountMinor"
            position="top"
            className="fill-foreground"
            fontSize={12}
            formatter={(value: unknown) => (typeof value === 'number' ? amountText(value) : '')}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
});

/** One column per month, the amount on its cap. Tapping a column opens that month's entries. */
function MonthColumns({ rows, summary }: { rows: BarRow[]; summary: string }) {
  const router = useRouter();
  return (
    <ChartFrame summary={summary} valueLabel="Spent">
      {(onHover) => <ColumnsChart rows={rows} router={router} onHover={onHover} />}
    </ChartFrame>
  );
}

/**
 * The numbers of a chart as a table, for screen readers and keyboards: every row links to its entries.
 * Out of sight until a link in it has focus, so a keyboard user sees where they are.
 */
function TextAlternative({
  caption,
  firstColumn,
  columns,
  rows,
}: {
  caption: string;
  firstColumn: string;
  columns: string[];
  rows: { row: BarRow; cells: string[] }[];
}) {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <table className="w-full text-sm">
        <caption className="py-1 text-left text-muted-foreground">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="py-1 text-left font-medium">
              {firstColumn}
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" className="py-1 text-right font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, cells }) => (
            <tr key={row.id}>
              <th scope="row" className="py-1 text-left font-normal">
                <Link href={row.href} className={LINK_CLASS}>
                  {row.label}
                </Link>
              </th>
              {cells.map((cell, i) => (
                <td key={columns[i]} className="py-1 text-right tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MonthSwitcher({ month, onChange }: { month: IsoMonth; onChange: (month: IsoMonth) => void }) {
  return (
    <div role="group" aria-label="Month" className="flex items-center justify-between gap-2">
      <Button variant="ghost" className="h-10 px-3" onClick={() => onChange(shiftMonth(month, -1))}>
        <span aria-hidden="true">‹</span> Previous
      </Button>
      <p aria-live="polite" className="font-medium">
        {monthAndYear.format(monthDate(month))}
      </p>
      <Button variant="ghost" className="h-10 px-3" onClick={() => onChange(shiftMonth(month, 1))}>
        Next <span aria-hidden="true">›</span>
      </Button>
    </div>
  );
}

/**
 * Spending by category. `note` is the line for the month the plan was set up in ("Budget starts 16 Oct."), which
 * explains why the planned amounts there are smaller than a full month's and why earlier spending is left out.
 * Where nothing is planned (a month before the setup month) it is spending alone: no legend, no Planned column.
 */
function SpendingSection({
  rows,
  monthLabel,
  note,
  noneText,
}: {
  rows: BarRow[];
  monthLabel: string;
  note: string | null;
  noneText: string;
}) {
  const withPlanned = rows.some((row) => row.plannedMinor !== null);
  return (
    <ChartSection title="Spending by category">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{noneText}</p>
      ) : (
        <>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
          <HorizontalBars
            rows={rows}
            seriesKey="spent"
            withPlanned={withPlanned}
            summary={`Bar chart of what was spent in each category in ${monthLabel}${withPlanned ? ', against what was planned' : ''}. ${note ? `${note} ` : ''}The same numbers are in the table.`}
          />
          <TextAlternative
            caption={`Spending by category, ${monthLabel}. ${note ? `${note} ` : ''}Each category links to its entries.`}
            firstColumn="Category"
            columns={withPlanned ? ['Spent', 'Planned'] : ['Spent']}
            rows={rows.map((row) => ({
              row,
              cells: withPlanned
                ? [amountText(row.amountMinor), row.plannedMinor === null ? 'Not planned' : amountText(row.plannedMinor)]
                : [amountText(row.amountMinor)],
            }))}
          />
        </>
      )}
    </ChartSection>
  );
}

function IncomeSection({ rows, monthLabel, noneText }: { rows: BarRow[]; monthLabel: string; noneText: string }) {
  return (
    <ChartSection title="Income by source">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{noneText}</p>
      ) : (
        <>
          <HorizontalBars
            rows={rows}
            seriesKey="income"
            withPlanned={false}
            summary={`Bar chart of the income in ${monthLabel} by source. The same numbers are in the table.`}
          />
          <TextAlternative
            caption={`Income by source, ${monthLabel}. Each source links to its entries.`}
            firstColumn="Source"
            columns={['Income']}
            rows={rows.map((row) => ({ row, cells: [amountText(row.amountMinor)] }))}
          />
        </>
      )}
    </ChartSection>
  );
}

function HistorySection({
  categoryId,
  onCategoryChange,
  entries,
  month,
  monthLabel,
}: {
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  entries: Entry[];
  month: IsoMonth;
  monthLabel: string;
}) {
  const selectId = useId();
  const name = categoryName(categoryId);
  const rows: BarRow[] = categoryHistory(entries, categoryId, month).map((m) => ({
    id: m.month,
    label: monthAndYear.format(monthDate(m.month)),
    amountMinor: m.spentMinor,
    plannedMinor: null,
    href: entriesHref(categoryId, m.month),
  }));

  return (
    <ChartSection title="Last 6 months">
      <div className="grid gap-1.5">
        <Label htmlFor={selectId}>Category</Label>
        <NativeSelect
          id={selectId}
          className="w-full"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <MonthColumns
        rows={rows}
        summary={`Bar chart of what was spent on ${name} in each of the six months up to ${monthLabel}. The same numbers are in the table.`}
      />
      <TextAlternative
        caption={`${name}, the six months up to ${monthLabel}. Each month links to its entries.`}
        firstColumn="Month"
        columns={['Spent']}
        rows={rows.map((row) => ({ row, cells: [amountText(row.amountMinor)] }))}
      />
    </ChartSection>
  );
}

/** The category the history starts on: the top spender, or with nothing spent the first row, or the first category. */
function defaultHistoryCategory(spending: ReturnType<typeof spendingByCategory>): string {
  return (spending.find((row) => row.spentMinor > 0) ?? spending[0])?.categoryId ?? EXPENSE_CATEGORIES[0].id;
}

function Charts({ plan, entries, today }: { plan: Plan; entries: Entry[]; today: IsoDate }) {
  // Null follows the clock to the current month; Previous and Next pin the month that was picked.
  const [pickedMonth, setPickedMonth] = useState<IsoMonth | null>(null);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);

  const month = pickedMonth ?? monthOf(today);
  const monthLabel = monthAndYear.format(monthDate(month));
  // The year only when it is not this one, so the usual line stays short: "Nothing logged in October yet."
  const monthIn = month.slice(0, 4) === today.slice(0, 4) ? monthOnly.format(monthDate(month)) : monthLabel;
  const logged = entries.some((entry) => entry.type !== 'transfer' && monthOf(entry.date) === month);

  const spending = spendingByCategory(entries, plan, month);
  const spendingRows: BarRow[] = spending.map((row) => ({
    id: row.categoryId,
    label: categoryName(row.categoryId),
    amountMinor: row.spentMinor,
    plannedMinor: row.plannedMinor,
    href: entriesHref(row.categoryId, month),
  }));
  const incomeRows: BarRow[] = incomeBySource(entries, month).map((row) => ({
    id: row.categoryId,
    label: categoryName(row.categoryId),
    amountMinor: row.amountMinor,
    plannedMinor: null,
    href: entriesHref(row.categoryId, month),
  }));

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher month={month} onChange={setPickedMonth} />
      {!logged ? (
        <p className="text-muted-foreground">{`Nothing logged in ${monthIn} yet.`}</p>
      ) : (
        <>
          <SpendingSection
            rows={spendingRows}
            monthLabel={monthLabel}
            note={budgetStartNote(plan, month)}
            noneText={`No spending logged in ${monthIn} yet.`}
          />
          <IncomeSection rows={incomeRows} monthLabel={monthLabel} noneText={`No income logged in ${monthIn} yet.`} />
          <HistorySection
            categoryId={pickedCategory ?? defaultHistoryCategory(spending)}
            onCategoryChange={setPickedCategory}
            entries={entries}
            month={month}
            monthLabel={monthLabel}
          />
        </>
      )}
    </div>
  );
}

/**
 * Where the money went in one month: spending by category against the plan, income by source, and one
 * category over the last six months. Every bar opens the entries behind it. It reads the whole database and
 * updates by itself when an entry is saved.
 */
export function ChartsView() {
  // The date is null until the browser runs this (never the date of the prerender).
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);

  if (today === null || plan === 'loading' || entries === undefined) return null;
  if (plan === null) {
    return (
      <p className="text-muted-foreground">
        Set up your plan to see where the money goes.{' '}
        <Link href="/setup" className={LINK_CLASS}>
          Start setup
        </Link>
      </p>
    );
  }
  return <Charts plan={plan} entries={entries} today={today} />;
}
