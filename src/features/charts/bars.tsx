'use client';

import { useRouter } from 'next/navigation';
import { memo, type PointerEvent } from 'react';
import { Bar, BarChart, Rectangle, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { amountText, CHART_CONFIG, ChartFrame, type ChartRow, type OnHover } from './chart-parts';

/** "€20 of €160", or just "€20" for what has no plan. Home writes the envelopes the same way. */
function rowText(row: ChartRow): string {
  return row.plannedMinor === null
    ? amountText(row.amountMinor)
    : `${amountText(row.amountMinor)} of ${amountText(row.plannedMinor)}`;
}

/** What a bar does with the label that sits at its end: where it goes, and what it says; null for none. */
export type BarOptions = {
  /** Draws the bar itself. False leaves only the target, for a chart that draws its own marks over it. */
  drawn?: boolean;
  /** The text at the end of the bar (above a column, below one that points down). */
  label?: (row: ChartRow) => string | null;
};

/**
 * Draws a bar and, behind it, a transparent target as big as the bar's whole row (or column), so a tap does not
 * have to land on a 10 px bar. A click opens the entries of the bar's row, and the row lights up under a pointer
 * and reports it to `onHover`. Bars that are zero long are still drawn through this, so every row stays tappable.
 * `band` is the thickness of one row or column, given the width and height of the chart. (The chart's own
 * tooltip is not used: it works out the row from the pointer on its own and was a row off in this layout.)
 * A column below the baseline (a negative amount) hangs down from it, with its label under it.
 */
export function openableBar(
  direction: 'row' | 'column',
  band: (chart: { width: number; height: number }) => number,
  onOpen: (href: string) => void,
  onHover: OnHover,
  options: BarOptions = {},
) {
  const { drawn = true, label } = options;
  return function OpenableBar(props: BarShapeProps) {
    const row = props.payload as ChartRow | undefined;
    const { x, width, parentViewBox: chart } = props;
    // A negative value has a negative height, with `y` at its far end; draw from the top either way.
    const top = Math.min(props.y, props.y + props.height);
    const height = Math.abs(props.height);
    const size = band(chart);
    const hit =
      direction === 'row'
        ? { x: chart.x, y: top + height / 2 - size / 2, width: chart.width, height: size }
        : { x: x + width / 2 - size / 2, y: chart.y, width: size, height: chart.height };
    // A finger has no hover: a tap only opens the entries.
    const point = (event: PointerEvent<SVGGElement>) =>
      row && event.pointerType !== 'touch' ? { row, x: event.clientX, y: event.clientY } : null;
    const text = row && label ? label(row) : null;
    const down = row !== undefined && row.amountMinor < 0;
    return (
      <g
        className={row?.href ? 'group cursor-pointer' : 'group'}
        onClick={() => row?.href && onOpen(row.href)}
        onPointerMove={(event) => onHover(point(event))}
        onPointerLeave={() => onHover(null)}
      >
        <rect {...hit} className="fill-transparent group-hover:fill-muted/60" />
        {drawn && (
          <Rectangle
            x={x}
            y={top}
            width={width}
            height={height}
            radius={direction === 'row' ? [0, 4, 4, 0] : down ? [0, 0, 4, 4] : [4, 4, 0, 0]}
            fill={row?.color ?? props.fill}
          />
        )}
        {text && (
          <text
            x={x + width / 2}
            y={down ? top + height + 14 : top - 6}
            textAnchor="middle"
            fontSize={12}
            className="fill-foreground"
            pointerEvents="none"
          >
            {text}
          </text>
        )}
      </g>
    );
  };
}

const ROW_HEIGHT = 44;
const LEGEND_HEIGHT = 28;
const NAME_WIDTH = 96;
/** At least this wide; wider when a row like "€2,400 of €400" would not fit on one line (about 8 px a character, plus the tick gap). */
const MIN_VALUE_WIDTH = 96;
const CHARACTER_WIDTH = 8;
const TICK_GAP = 16;
const MARGIN_Y = 4;

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
  rows: ChartRow[];
  seriesKey: 'spent' | 'income';
  withPlanned: boolean;
  router: Router;
  onHover: OnHover;
}) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const max = Math.max(1, ...rows.flatMap((row) => [row.amountMinor, row.plannedMinor ?? 0]));
  const valueWidth = Math.max(MIN_VALUE_WIDTH, CHARACTER_WIDTH * Math.max(...rows.map((row) => rowText(row).length)) + TICK_GAP);
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
          tickFormatter={(id: string) => byId.get(id)?.shortLabel ?? id}
        />
        <YAxis
          yAxisId="values"
          orientation="right"
          type="category"
          dataKey="id"
          width={valueWidth}
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
 * Tapping a row opens its entries. Every bar is one colour, as the names say which category it is.
 */
export function HorizontalBars({
  rows,
  seriesKey,
  withPlanned,
  summary,
}: {
  rows: ChartRow[];
  seriesKey: 'spent' | 'income';
  withPlanned: boolean;
  summary: string;
}) {
  const router = useRouter();
  // The bars take the chart's one colour for an amount; the category colours are for the donut.
  const plain = rows.map((row) => ({ ...row, color: `var(--color-${seriesKey})` }));
  return (
    <ChartFrame summary={summary} valueLabel={seriesKey === 'spent' ? 'Spent' : 'Income'}>
      {(onHover) => (
        <RowsChart rows={plain} seriesKey={seriesKey} withPlanned={withPlanned} router={router} onHover={onHover} />
      )}
    </ChartFrame>
  );
}
