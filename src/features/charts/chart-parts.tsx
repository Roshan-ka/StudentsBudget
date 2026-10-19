'use client';

import { parseISO } from 'date-fns';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import type { ChartConfig } from '@/components/ui/chart';
import { firstOfMonth, type IsoMonth } from '@/lib/dates';
import type { Minor } from '@/lib/money';
import { formatWeekAmount } from '@/lib/week-amount';

/**
 * The colours of the charts that are not a category's: one hue for every amount (slot 1 of the dataviz palette)
 * with a lighter step of it for what was planned, and orange (slot 2) for a month that spent more than it earned.
 * The pair was validated as an ordinal pair against the light and the dark surface; the category colours are in
 * `globals.css`.
 */
export const CHART_CONFIG = {
  spent: { label: 'Spent', theme: { light: '#2a78d6', dark: '#3987e5' } },
  planned: { label: 'Planned', theme: { light: '#86b6ef', dark: '#184f95' } },
  income: { label: 'Income', theme: { light: '#2a78d6', dark: '#3987e5' } },
  saved: { label: 'Saved', theme: { light: '#2a78d6', dark: '#3987e5' } },
  short: { label: 'More spent than earned', theme: { light: '#eb6834', dark: '#d95926' } },
} satisfies ChartConfig;

/** Whole euros; a non-zero amount under 50 cents keeps its cents, so it does not read as €0. */
export const amountText = (minor: Minor): string => formatWeekAmount(minor).text;

/** `amountText` with a minus sign for a negative amount, for a number that stands on its own: "−€40". */
export const signedAmountText = (minor: Minor): string => (minor < 0 ? `−${amountText(-minor)}` : amountText(minor));

export const monthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' });
export const monthOnly = new Intl.DateTimeFormat('en-IE', { month: 'long' });
export const shortMonth = new Intl.DateTimeFormat('en-IE', { month: 'short' });
const shortMonthAndYear = new Intl.DateTimeFormat('en-IE', { month: 'short', year: 'numeric' });

export const monthDate = (month: IsoMonth): Date => parseISO(firstOfMonth(month));

/** "Aug – Oct 2026", or "Nov 2025 – Oct 2026" across years: the months a period of more than one month covers. */
export function rangeText(first: IsoMonth, last: IsoMonth): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const from = (sameYear ? shortMonth : shortMonthAndYear).format(monthDate(first));
  return `${from} – ${shortMonthAndYear.format(monthDate(last))}`;
}

/** "/entries?category=eating-out&month=2026-10": the entries behind one slice, bar or column; the whole month without a category. */
export function entriesHref(categoryId: string | null, month: IsoMonth): string {
  const params = new URLSearchParams(categoryId === null ? { month } : { category: categoryId, month });
  return `/entries?${params.toString()}`;
}

export const LINK_CLASS = 'text-primary underline-offset-4 hover:underline';

/** One slice, bar or column, with everything a chart, its tooltip and its table need. */
export type ChartRow = {
  /** The category id (or the bucket's), or the month for a chart over time. */
  id: string;
  /** The full name, for the table and the tooltip. */
  label: string;
  /** A name that fits beside a slice or under a bar. */
  shortLabel: string;
  /** What the chart is about; negative only for a month that spent more than it earned. */
  amountMinor: Minor;
  /** What was planned; null for a row without a plan. */
  plannedMinor: Minor | null;
  /** A CSS colour: the category's own, or one of the chart's. */
  color: string;
  /** The entries behind the row; null where there are none to open (the bucket of everything else). */
  href: string | null;
  /** Names the amount in the tooltip, where the chart's own name for it does not fit this row. */
  valueLabel?: string;
  /** More lines for the tooltip, below the amount and what was planned. */
  extra?: { label: string; text: string }[];
};

/** The row the pointer is on, and where the pointer is in the window. */
export type HoverPoint = { row: ChartRow; x: number; y: number };

export type OnHover = (hover: HoverPoint | null) => void;

/** The readout on hover. Everything in it is also printed on the chart or in the table, so it never gates a number. */
function RowTooltip({ row, valueLabel }: { row: ChartRow; valueLabel: string }) {
  return (
    <div
      role="tooltip"
      className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
    >
      <p className="font-medium">{row.label}</p>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">{row.valueLabel ?? valueLabel}</span>
        <span className="font-medium tabular-nums">{amountText(row.amountMinor)}</span>
      </p>
      {row.plannedMinor !== null && (
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Planned</span>
          <span className="font-medium tabular-nums">{amountText(row.plannedMinor)}</span>
        </p>
      )}
      {row.extra?.map((line) => (
        <p key={line.label} className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{line.label}</span>
          <span className="font-medium tabular-nums">{line.text}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * One chart for a screen reader (an image, with the table or the legend next to it as its text) and the tooltip
 * above the slice, bar or column the pointer is on. `children` gets the handler they report the pointer to.
 */
export function ChartFrame({
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
          <RowTooltip row={hover.row} valueLabel={valueLabel} />
        </div>
      )}
    </div>
  );
}

/**
 * The numbers of a chart as a table, every row linking to its entries. In `visible` form it is the chart itself
 * (the "Table" style); otherwise it is the text of a chart for screen readers and keyboards, out of sight until a
 * link in it has focus, so a keyboard user sees where they are.
 */
export function DataTable({
  caption,
  firstColumn,
  columns,
  rows,
  visible = false,
}: {
  caption: string;
  firstColumn: string;
  columns: string[];
  rows: { row: ChartRow; cells: string[] }[];
  visible?: boolean;
}) {
  return (
    <div className={visible ? undefined : 'sr-only focus-within:not-sr-only'}>
      <table className="w-full text-sm">
        <caption className="py-1 text-left text-muted-foreground">{caption}</caption>
        <thead>
          <tr className={visible ? 'border-b' : undefined}>
            <th scope="col" className="py-1 text-left font-medium">
              {firstColumn}
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" className="py-1 pl-3 text-right font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={visible ? 'divide-y' : undefined}>
          {rows.map(({ row, cells }) => (
            <tr key={row.id}>
              <th scope="row" className={`text-left font-normal ${visible ? 'py-3' : 'py-1'}`}>
                {row.href === null ? (
                  row.label
                ) : (
                  <Link href={row.href} className={LINK_CLASS}>
                    {row.label}
                  </Link>
                )}
              </th>
              {cells.map((cell, i) => (
                <td key={columns[i]} className={`pl-3 text-right tabular-nums ${visible ? 'py-3' : 'py-1'}`}>
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

/** A heading and what is under it; the section is named by the heading. */
export function ChartSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  /** A short line under the title, for a chart whose months differ from the period's: "Last 6 months". */
  subtitle?: string | null;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div>
        <h3 id={headingId} className="text-lg font-semibold">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A row of buttons of which one is on, for the style of a chart or the period of all of them. Each segment is at
 * least 44 px high, and the group takes the full width, so it works with a thumb at 375 px.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="min-h-11 flex-1 rounded-md px-2 text-sm font-medium whitespace-nowrap text-foreground/70 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}
