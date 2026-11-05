'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Entry } from '@/db/types';
import { EXPENSE_CATEGORIES } from '@/features/entries/categories';
import { categoryNameIn } from '@/i18n/category-name';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import type { Minor } from '@/lib/money';
import { useChoicePref } from '@/lib/phone-pref';
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
  SegmentedControl,
  shortMonth,
  signedAmountText,
  type ChartRow,
} from './chart-parts';
import { chartColor, chartLabel } from './colors';
import { Donut, EmptyDonut } from './donut';
import { MonthSeries } from './series';

const SHARE_STYLES = ['donut', 'bars', 'table'] as const;
const SERIES_STYLES = ['columns', 'line', 'table'] as const;


/** A segmented control's options for a list of chart styles, named in the dictionary's language. */
function styleOptions<T extends keyof Messages['charts']['styles']>(styles: readonly T[], t: Messages) {
  return styles.map((value) => ({ value, text: t.charts.styles[value] }));
}

/** A category (or the bucket) as one slice, bar or table row, opening its entries for the period's last month. */
function categoryRow(
  categoryId: string,
  amountMinor: Minor,
  plannedMinor: Minor | null,
  endMonth: Period['endMonth'],
  t: Messages,
): ChartRow {
  const bucket = categoryId === BUCKET_ID;
  return {
    id: categoryId,
    label: bucket ? t.charts.bucket : categoryNameIn(t, categoryId),
    shortLabel: chartLabel(categoryId, t),
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
  t: Messages,
): ChartRow[] {
  return topWithBucket(
    rows.filter((row) => amountOf(row) > 0),
    amountOf,
  ).map((row) => categoryRow(row.categoryId, amountOf(row), null, endMonth, t));
}

/** The slices in a sentence: "Food & groceries €120, Eating out €45". */
function slicesText(slices: ChartRow[], locale: string): string {
  return slices.map((s) => `${s.label} ${amountText(s.amountMinor, locale)}`).join(', ');
}

/**
 * Spending by category over the period. The donut is the overview: the top 6 by spent, and "Everything else" for
 * the rest. Bars and Table list every category, spent against planned. `note` is the line for the month the plan
 * was set up in ("Envelope spending counts from 16 Oct, the day you set up."), which explains why earlier spending
 * in the envelopes is left out. Where nothing is planned (a period before the setup month) it is spending alone: no
 * legend, no Planned column.
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
  const { t, locale } = useT();
  const text = t.charts.spending;
  const [style, setStyle] = useChoicePref('studentsbudget-chart-style-spending', SHARE_STYLES, 'donut');
  const rows = spending.map((row) => categoryRow(row.categoryId, row.spentMinor, row.plannedMinor, period.endMonth, t));
  const withPlanned = rows.some((row) => row.plannedMinor !== null);
  const slices = slicesOf(spending, (row) => row.spentMinor, period.endMonth, t);
  const table = {
    caption: text.caption(periodText, note),
    firstColumn: text.category,
    columns: withPlanned ? [t.charts.series.spent, t.charts.series.planned] : [t.charts.series.spent],
    rows: rows.map((row) => ({ row, cells: spendingCells(row, withPlanned, t, locale) })),
  };

  return (
    <ChartSection title={text.title}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{noneText}</p>
      ) : (
        <>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
          <SegmentedControl
            label={text.styleLabel}
            options={styleOptions(SHARE_STYLES, t)}
            value={style}
            onChange={setStyle}
          />
          {style === 'donut' &&
            (slices.length === 0 ? (
              <>
                <EmptyDonut summary={text.nothingSpent(periodText)} centreLabel={text.centre} />
                <DataTable {...table} />
              </>
            ) : (
              <>
                <Donut
                  rows={slices}
                  valueLabel={t.charts.series.spent}
                  centreLabel={text.centre}
                  summary={text.donutSummary(periodText, slicesText(slices, locale), note)}
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
                summary={text.barsSummary(periodText, withPlanned, note)}
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

function spendingCells(row: ChartRow, withPlanned: boolean, t: Messages, locale: string): string[] {
  const spent = amountText(row.amountMinor, locale);
  if (!withPlanned) return [spent];
  return [spent, row.plannedMinor === null ? t.charts.spending.notPlanned : amountText(row.plannedMinor, locale)];
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
  const { t, locale } = useT();
  const text = t.charts.income;
  const [style, setStyle] = useChoicePref('studentsbudget-chart-style-income', SHARE_STYLES, 'donut');
  const rows = income.map((row) => categoryRow(row.categoryId, row.amountMinor, null, period.endMonth, t));
  const slices = slicesOf(income, (row) => row.amountMinor, period.endMonth, t);
  const caption = text.caption(periodText);
  const columns = [t.charts.series.income];
  const tableRows = rows.map((row) => ({ row, cells: [amountText(row.amountMinor, locale)] }));

  return (
    <ChartSection title={text.title}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{noneText}</p>
      ) : (
        <>
          <SegmentedControl
            label={text.styleLabel}
            options={styleOptions(SHARE_STYLES, t)}
            value={style}
            onChange={setStyle}
          />
          {style === 'donut' && (
            <>
              <Donut
                rows={slices}
                valueLabel={t.charts.series.income}
                centreLabel={text.centre}
                summary={text.donutSummary(periodText, slicesText(slices, locale))}
              />
              <DataTable caption={caption} firstColumn={text.source} columns={columns} rows={tableRows} />
            </>
          )}
          {style === 'bars' && (
            <>
              <HorizontalBars rows={rows} seriesKey="income" withPlanned={false} summary={text.barsSummary(periodText)} />
              <DataTable caption={caption} firstColumn={text.source} columns={columns} rows={tableRows} />
            </>
          )}
          {style === 'table' && (
            <DataTable visible caption={caption} firstColumn={text.source} columns={columns} rows={tableRows} />
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
  const { t, locale } = useT();
  const text = t.charts.savings;
  const series = t.charts.series;
  const [style, setStyle] = useChoicePref('studentsbudget-chart-style-savings', SERIES_STYLES, 'columns');
  const months = savingsByMonth(entries, period);
  const total = months.reduce((sum, m) => sum + m.savedMinor, 0);
  const rows: ChartRow[] = months.map((m) => ({
    id: m.month,
    label: monthAndYear(m.month, locale),
    shortLabel: shortMonth(m.month, locale),
    amountMinor: m.savedMinor,
    plannedMinor: null,
    color: m.savedMinor < 0 ? 'var(--color-short)' : 'var(--color-saved)',
    href: entriesHref(null, m.month),
    valueLabel: m.savedMinor < 0 ? series.short : series.saved,
    extra: [
      { label: series.income, text: amountText(m.incomeMinor, locale) },
      { label: series.spent, text: amountText(m.expenseMinor, locale) },
    ],
  }));
  const headline = total < 0 ? text.short(amountText(-total, locale)) : text.saved(amountText(total, locale));
  const caption = text.caption(periodText);
  const columns = [series.income, series.spent, series.saved];
  const cells = savingsCells(rows, months, locale);

  return (
    <ChartSection title={text.title} subtitle={subtitle}>
      <div>
        <p className="text-2xl font-semibold">{headline}</p>
        <p className="text-sm text-muted-foreground">{text.explain(periodText)}</p>
      </div>
      <SegmentedControl
        label={text.styleLabel}
        options={styleOptions(SERIES_STYLES, t)}
        value={style}
        onChange={setStyle}
      />
      {style === 'table' ? (
        <DataTable visible caption={caption} firstColumn={text.month} columns={columns} rows={cells} />
      ) : (
        <>
          <MonthSeries
            rows={rows}
            style={style}
            ink="var(--color-saved)"
            valueLabel={series.saved}
            summary={text.summary(style === 'line', periodText, headline)}
          />
          <DataTable caption={caption} firstColumn={text.month} columns={columns} rows={cells} />
        </>
      )}
    </ChartSection>
  );
}

function savingsCells(rows: ChartRow[], months: ReturnType<typeof savingsByMonth>, locale: string) {
  return rows.map((row, i) => ({
    row,
    cells: [
      amountText(months[i]?.incomeMinor ?? 0, locale),
      amountText(months[i]?.expenseMinor ?? 0, locale),
      signedAmountText(row.amountMinor, locale),
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
  const { t, locale } = useT();
  const text = t.charts.overTime;
  const [style, setStyle] = useChoicePref('studentsbudget-chart-style-over-time', SERIES_STYLES, 'columns');
  const name = chartLabel(categoryId, t);
  const fullName = categoryNameIn(t, categoryId);
  const color = chartColor(categoryId);
  const rows: ChartRow[] = categoryOverPeriod(entries, categoryId, period).map((m) => ({
    id: m.month,
    label: monthAndYear(m.month, locale),
    shortLabel: shortMonth(m.month, locale),
    amountMinor: m.spentMinor,
    plannedMinor: null,
    color,
    href: entriesHref(categoryId, m.month),
  }));
  const caption = text.caption(fullName, periodText);
  const columns = [t.charts.series.spent];
  const tableRows = rows.map((row) => ({ row, cells: [amountText(row.amountMinor, locale)] }));
  const firstColumn = t.charts.savings.month;

  return (
    <ChartSection title={text.title(name)} subtitle={subtitle}>
      <div className="grid gap-1.5">
        <Label htmlFor={selectId}>{text.category}</Label>
        <NativeSelect
          id={selectId}
          className="w-full"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {categoryNameIn(t, c.id)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <SegmentedControl
        label={text.styleLabel}
        options={styleOptions(SERIES_STYLES, t)}
        value={style}
        onChange={setStyle}
      />
      {style === 'table' ? (
        <DataTable visible caption={caption} firstColumn={firstColumn} columns={columns} rows={tableRows} />
      ) : (
        <>
          <MonthSeries
            rows={rows}
            style={style}
            ink={color}
            valueLabel={t.charts.series.spent}
            summary={text.summary(style === 'line', fullName, periodText)}
          />
          <DataTable caption={caption} firstColumn={firstColumn} columns={columns} rows={tableRows} />
        </>
      )}
    </ChartSection>
  );
}
