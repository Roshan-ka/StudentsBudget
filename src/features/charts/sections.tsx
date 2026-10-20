'use client';

import { useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Entry } from '@/db/types';
import { categoryName, EXPENSE_CATEGORIES } from '@/features/entries/categories';
import type { Minor } from '@/lib/money';
import {
  BUCKET_ID,
  categoryOverPeriod,
  savingsByMonth,
  topWithBucket,
  type Period,
  type SpendingRow,
} from './aggregate';
import { HorizontalBars } from './bars';
import {
  amountText,
  ChartSection,
  DataTable,
  entriesHref,
  monthAndYear,
  monthDate,
  SegmentedControl,
  shortMonth,
  signedAmountText,
  type ChartRow,
} from './chart-parts';
import { BUCKET_LABEL, chartColor, chartLabel } from './colors';
import { Donut } from './donut';
import { MonthSeries } from './series';

const SHARE_STYLES = [
  { value: 'donut', text: 'Donut' },
  { value: 'bars', text: 'Bars' },
  { value: 'table', text: 'Table' },
] as const;

const SERIES_STYLES = [
  { value: 'columns', text: 'Columns' },
  { value: 'line', text: 'Line' },
  { value: 'table', text: 'Table' },
] as const;

type ShareStyle = (typeof SHARE_STYLES)[number]['value'];
type SeriesChoice = (typeof SERIES_STYLES)[number]['value'];


/** A category (or the bucket) as one slice, bar or table row, opening its entries for the period's last month. */
function categoryRow(
  categoryId: string,
  amountMinor: Minor,
  plannedMinor: Minor | null,
  endMonth: Period['endMonth'],
): ChartRow {
  const bucket = categoryId === BUCKET_ID;
  return {
    id: categoryId,
    label: bucket ? BUCKET_LABEL : categoryName(categoryId),
    shortLabel: chartLabel(categoryId),
    amountMinor,
    plannedMinor,
    color: chartColor(categoryId),
    href: bucket ? null : entriesHref(categoryId, endMonth),
  };
}

/** A donut's slices: the rows with something in them, the top 6, and a bucket when it folds 2 or more. */
function slicesOf<T extends { categoryId: string }>(
  rows: T[],
  amountOf: (row: T) => Minor,
  endMonth: Period['endMonth'],
): ChartRow[] {
  return topWithBucket(
    rows.filter((row) => amountOf(row) > 0),
    amountOf,
  ).map((row) => categoryRow(row.categoryId, amountOf(row), null, endMonth));
}

/**
 * Spending by category over the period. The donut is the overview: the top 6 by spent, and "Everything else" for
 * the rest. Bars and Table list every category, spent against planned. `note` is the line for the month the plan
 * was set up in ("Budget starts 16 Oct."), which explains why the planned amounts there are smaller than a full
 * month's and why earlier spending is left out. Where nothing is planned (a period before the setup month) it is
 * spending alone: no legend, no Planned column.
 */
export function SpendingSection({
  spending,
  period,
  periodText,
  note,
  noneText,
}: {
  spending: SpendingRow[];
  period: Period;
  periodText: string;
  note: string | null;
  noneText: string;
}) {
  const [style, setStyle] = useState<ShareStyle>('donut');
  const rows = spending.map((row) => categoryRow(row.categoryId, row.spentMinor, row.plannedMinor, period.endMonth));
  const withPlanned = rows.some((row) => row.plannedMinor !== null);
  const slices = slicesOf(spending, (row) => row.spentMinor, period.endMonth);
  const noteText = note ? `${note} ` : '';
  const table = {
    caption: `Spending by category, ${periodText}. ${noteText}Each category links to its entries.`,
    firstColumn: 'Category',
    columns: withPlanned ? ['Spent', 'Planned'] : ['Spent'],
    rows: rows.map((row) => ({ row, cells: spendingCells(row, withPlanned) })),
  };

  return (
    <ChartSection title="Spending by category">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{noneText}</p>
      ) : (
        <>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
          <SegmentedControl label="Spending chart style" options={SHARE_STYLES} value={style} onChange={setStyle} />
          {style === 'donut' &&
            (slices.length === 0 ? (
              <p className="text-muted-foreground">{`Nothing spent in ${periodText} yet.`}</p>
            ) : (
              <>
                <Donut
                  rows={slices}
                  valueLabel="Spent"
                  centreLabel="spent"
                  summary={`Donut chart of what was spent in ${periodText}: ${slices.map((s) => `${s.label} ${amountText(s.amountMinor)}`).join(', ')}. ${noteText}The same numbers are listed under it.`}
                />
                {/* Every category, planned and spent: what the donut folds into one slice is in the table. */}
                <DataTable {...table} />
              </>
            ))}
          {style === 'bars' && (
            <>
              <HorizontalBars
                rows={rows}
                seriesKey="spent"
                withPlanned={withPlanned}
                summary={`Bar chart of what was spent in each category in ${periodText}${withPlanned ? ', against what was planned' : ''}. ${noteText}The same numbers are in the table.`}
              />
              <DataTable {...table} />
            </>
          )}
          {style === 'table' && <DataTable visible {...table} />}
        </>
      )}
    </ChartSection>
  );
}

function spendingCells(row: ChartRow, withPlanned: boolean): string[] {
  return withPlanned
    ? [amountText(row.amountMinor), row.plannedMinor === null ? 'Not planned' : amountText(row.plannedMinor)]
    : [amountText(row.amountMinor)];
}

/** Income by source over the period, as a donut (every source, up to 6), bars or a table. */
export function IncomeSection({
  income,
  period,
  periodText,
  noneText,
}: {
  income: { categoryId: string; amountMinor: Minor }[];
  period: Period;
  periodText: string;
  noneText: string;
}) {
  const [style, setStyle] = useState<ShareStyle>('donut');
  const rows = income.map((row) => categoryRow(row.categoryId, row.amountMinor, null, period.endMonth));
  const slices = slicesOf(income, (row) => row.amountMinor, period.endMonth);
  const caption = `Income by source, ${periodText}. Each source links to its entries.`;
  const tableRows = rows.map((row) => ({ row, cells: [amountText(row.amountMinor)] }));

  return (
    <ChartSection title="Income by source">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{noneText}</p>
      ) : (
        <>
          <SegmentedControl label="Income chart style" options={SHARE_STYLES} value={style} onChange={setStyle} />
          {style === 'donut' && (
            <>
              <Donut
                rows={slices}
                valueLabel="Income"
                centreLabel="income"
                summary={`Donut chart of the income in ${periodText} by source: ${slices.map((s) => `${s.label} ${amountText(s.amountMinor)}`).join(', ')}. The same numbers are listed under it.`}
              />
              <DataTable caption={caption} firstColumn="Source" columns={['Income']} rows={tableRows} />
            </>
          )}
          {style === 'bars' && (
            <>
              <HorizontalBars
                rows={rows}
                seriesKey="income"
                withPlanned={false}
                summary={`Bar chart of the income in ${periodText} by source. The same numbers are in the table.`}
              />
              <DataTable caption={caption} firstColumn="Source" columns={['Income']} rows={tableRows} />
            </>
          )}
          {style === 'table' && (
            <DataTable visible caption={caption} firstColumn="Source" columns={['Income']} rows={tableRows} />
          )}
        </>
      )}
    </ChartSection>
  );
}

/**
 * What was saved in each month of the period: income minus expenses, with a total for the period. A month that
 * spent more than it earned says so in words, not as a warning. Tapping a column opens that month's entries.
 * `subtitle` goes under the title when the months are not the period the other charts show.
 */
export function SavingsSection({
  entries,
  period,
  periodText,
  subtitle,
}: {
  entries: Entry[];
  period: Period;
  periodText: string;
  subtitle?: string | null;
}) {
  const [style, setStyle] = useState<SeriesChoice>('columns');
  const months = savingsByMonth(entries, period);
  const total = months.reduce((sum, m) => sum + m.savedMinor, 0);
  const rows: ChartRow[] = months.map((m) => ({
    id: m.month,
    label: monthAndYear.format(monthDate(m.month)),
    shortLabel: shortMonth.format(monthDate(m.month)),
    amountMinor: m.savedMinor,
    plannedMinor: null,
    color: m.savedMinor < 0 ? 'var(--color-short)' : 'var(--color-saved)',
    href: entriesHref(null, m.month),
    valueLabel: m.savedMinor < 0 ? 'More spent than earned' : 'Saved',
    extra: [
      { label: 'Income', text: amountText(m.incomeMinor) },
      { label: 'Spent', text: amountText(m.expenseMinor) },
    ],
  }));
  const headline = total < 0 ? `${amountText(-total)} more spent than earned` : `${amountText(total)} saved`;
  const caption = `Income minus spending by month, ${periodText}. Each month links to its entries.`;

  return (
    <ChartSection title="Saved each month" subtitle={subtitle}>
      <div>
        <p className="text-2xl font-semibold">{headline}</p>
        <p className="text-sm text-muted-foreground">
          {`Income minus spending, ${periodText}. Money moved between your accounts is left out.`}
        </p>
      </div>
      <SegmentedControl label="Savings chart style" options={SERIES_STYLES} value={style} onChange={setStyle} />
      {style === 'table' ? (
        <DataTable
          visible
          caption={caption}
          firstColumn="Month"
          columns={['Income', 'Spent', 'Saved']}
          rows={savingsCells(rows, months)}
        />
      ) : (
        <>
          <MonthSeries
            rows={rows}
            style={style}
            ink="var(--color-saved)"
            valueLabel="Saved"
            summary={`${style === 'line' ? 'Line' : 'Column'} chart of income minus spending in each month of ${periodText}, ${headline}. The same numbers are in the table.`}
          />
          <DataTable
            caption={caption}
            firstColumn="Month"
            columns={['Income', 'Spent', 'Saved']}
            rows={savingsCells(rows, months)}
          />
        </>
      )}
    </ChartSection>
  );
}

function savingsCells(rows: ChartRow[], months: ReturnType<typeof savingsByMonth>) {
  return rows.map((row, i) => ({
    row,
    cells: [
      amountText(months[i]?.incomeMinor ?? 0),
      amountText(months[i]?.expenseMinor ?? 0),
      signedAmountText(row.amountMinor),
    ],
  }));
}

/**
 * One category month by month over the period: a picker for the category, then columns, a line or a table.
 * `subtitle` goes under the title when the months are not the period the other charts show.
 */
export function OverTimeSection({
  categoryId,
  onCategoryChange,
  entries,
  period,
  periodText,
  subtitle,
}: {
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  entries: Entry[];
  period: Period;
  periodText: string;
  subtitle?: string | null;
}) {
  const selectId = useId();
  const [style, setStyle] = useState<SeriesChoice>('columns');
  const name = chartLabel(categoryId);
  const color = chartColor(categoryId);
  const rows: ChartRow[] = categoryOverPeriod(entries, categoryId, period).map((m) => ({
    id: m.month,
    label: monthAndYear.format(monthDate(m.month)),
    shortLabel: shortMonth.format(monthDate(m.month)),
    amountMinor: m.spentMinor,
    plannedMinor: null,
    color,
    href: entriesHref(categoryId, m.month),
  }));
  const caption = `${categoryName(categoryId)} by month, ${periodText}. Each month links to its entries.`;
  const tableRows = rows.map((row) => ({ row, cells: [amountText(row.amountMinor)] }));

  return (
    <ChartSection title={`${name} over time`} subtitle={subtitle}>
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
      <SegmentedControl label="Category chart style" options={SERIES_STYLES} value={style} onChange={setStyle} />
      {style === 'table' ? (
        <DataTable visible caption={caption} firstColumn="Month" columns={['Spent']} rows={tableRows} />
      ) : (
        <>
          <MonthSeries
            rows={rows}
            style={style}
            ink={color}
            valueLabel="Spent"
            summary={`${style === 'line' ? 'Line' : 'Column'} chart of what was spent on ${categoryName(categoryId)} in each month of ${periodText}. The same numbers are in the table.`}
          />
          <DataTable caption={caption} firstColumn="Month" columns={['Spent']} rows={tableRows} />
        </>
      )}
    </ChartSection>
  );
}
