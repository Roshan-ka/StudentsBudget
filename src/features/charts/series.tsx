'use client';

import { useRouter } from 'next/navigation';
import { memo } from 'react';
import { Bar, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import type { IsoMonth } from '@/lib/dates';
import { openableBar } from './bars';
import {
  CHART_CONFIG,
  ChartFrame,
  monthDate,
  shortMonth,
  signedAmountText,
  type ChartRow,
  type OnHover,
} from './chart-parts';

export type SeriesStyle = 'columns' | 'line';

const MARGIN_X = 8;
/** Room above the highest column for its label. */
const MARGIN_TOP = 22;
const COLUMN_WIDTH = 24;
/** Points are labelled up to this many; with more, a label is wider than the space for it. */
const LABELLED_UP_TO = 6;

type Router = ReturnType<typeof useRouter>;

/** What recharts hands a line's dot: where it is, and the row behind it. */
type DotProps = { cx?: number; cy?: number; index?: number; payload?: ChartRow };

/**
 * The columns or the line themselves, one point per month; memoised for the reason `RowsChart` is. An amount can be
 * negative (a month that spent more than it earned): the plot then has room under the baseline, and a
 * `ReferenceLine` marks zero where the axis would have been.
 *
 * A line has no columns, but each month still has the target a column would have, so a tap or a pointer finds the
 * month without having to hit a 10 px dot: the bars are there, undrawn, and the line is drawn over them.
 */
const SeriesChart = memo(function SeriesChart({
  rows,
  style,
  ink,
  router,
  onHover,
}: {
  rows: ChartRow[];
  style: SeriesStyle;
  ink: string;
  router: Router;
  onHover: OnHover;
}) {
  const high = Math.max(0, ...rows.map((row) => row.amountMinor));
  const low = Math.min(0, ...rows.map((row) => row.amountMinor));
  // A label under a column that points down, or under a dot, needs room below the lowest value.
  const below = low < 0 ? (high - low) * 0.2 : 0;
  const domain: [number, number] = [low - below, Math.max(1, high)];
  const band = (chart: { width: number }) => (chart.width - 2 * MARGIN_X) / rows.length;
  const labelOf =
    rows.length <= LABELLED_UP_TO ? (row: ChartRow) => signedAmountText(row.amountMinor) : (): null => null;
  const open = (href: string) => router.push(href);

  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-auto h-56 w-full">
      <ComposedChart
        accessibilityLayer={false}
        data={rows}
        margin={{ top: MARGIN_TOP, right: MARGIN_X, bottom: 0, left: MARGIN_X }}
      >
        <XAxis
          dataKey="id"
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(month: IsoMonth) => shortMonth.format(monthDate(month))}
        />
        <YAxis hide domain={domain} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Bar
          dataKey="amountMinor"
          name="amount"
          fill={ink}
          barSize={COLUMN_WIDTH}
          isAnimationActive={false}
          shape={openableBar('column', band, open, onHover, {
            drawn: style === 'columns',
            label: style === 'columns' ? labelOf : undefined,
          })}
        />
        {style === 'line' && (
          <Line
            dataKey="amountMinor"
            type="linear"
            stroke={ink}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            activeDot={false}
            dot={({ cx, cy, index, payload }: DotProps) => {
              if (cx === undefined || cy === undefined || !payload) return <g key={index} />;
              const text = labelOf(payload);
              return (
                // 10 px across, ringed in the surface colour so the line does not run through it.
                <g key={payload.id} pointerEvents="none">
                  <circle cx={cx} cy={cy} r={5} fill={payload.color} stroke="var(--background)" strokeWidth={2} />
                  {text && (
                    <text
                      x={cx}
                      y={payload.amountMinor < 0 ? cy + 20 : cy - 12}
                      textAnchor="middle"
                      fontSize={12}
                      className="fill-foreground"
                    >
                      {text}
                    </text>
                  )}
                </g>
              );
            }}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
});

/**
 * One column (or one point of a line) per month. Tapping a month opens its entries. `valueLabel` is what the
 * tooltip calls the amount, where a row does not name its own, and `ink` is the colour of the line.
 */
export function MonthSeries({
  rows,
  style,
  ink,
  summary,
  valueLabel,
}: {
  rows: ChartRow[];
  style: SeriesStyle;
  ink: string;
  summary: string;
  valueLabel: string;
}) {
  const router = useRouter();
  return (
    <ChartFrame summary={summary} valueLabel={valueLabel}>
      {(onHover) => <SeriesChart rows={rows} style={style} ink={ink} router={router} onHover={onHover} />}
    </ChartFrame>
  );
}
