'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { memo, type PointerEvent } from 'react';
import { Pie, PieChart, Sector, type PieSectorShapeProps } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { amountText, ChartFrame, type ChartRow, type OnHover } from './chart-parts';

const percentFormat = new Intl.NumberFormat('en-IE', { style: 'percent', maximumFractionDigits: 0 });

/** "38%", and "<1%" for a slice too small to round to anything. */
function percentText(part: number, whole: number): string {
  const share = part / whole;
  return share > 0 && share < 0.005 ? '<1%' : percentFormat.format(share);
}

type Router = ReturnType<typeof useRouter>;

/**
 * The ring itself, memoised for the reason `RowsChart` is (a click that is half done is lost when its slice is
 * replaced under it, and the tooltip following the pointer must not rebuild the slices). A slice with entries
 * behind it opens them; the bucket is only a slice.
 */
const Ring = memo(function Ring({
  rows,
  router,
  onHover,
}: {
  rows: ChartRow[];
  router: Router;
  onHover: OnHover;
}) {
  const slice = (props: PieSectorShapeProps) => {
    const row = props.payload as ChartRow | undefined;
    const point = (event: PointerEvent<SVGGElement>) =>
      row && event.pointerType !== 'touch' ? { row, x: event.clientX, y: event.clientY } : null;
    return (
      <g
        className={row?.href ? 'cursor-pointer' : undefined}
        onClick={() => row?.href && router.push(row.href)}
        onPointerMove={(event) => onHover(point(event))}
        onPointerLeave={() => onHover(null)}
      >
        <Sector
          cx={props.cx}
          cy={props.cy}
          innerRadius={props.innerRadius}
          outerRadius={props.outerRadius}
          startAngle={props.startAngle}
          endAngle={props.endAngle}
          fill={row?.color ?? props.fill}
          // A 2 px gap in the surface colour between touching slices, not a border around each.
          stroke="var(--background)"
          strokeWidth={2}
        />
      </g>
    );
  };

  return (
    <ChartContainer config={{}} className="absolute inset-0 aspect-auto">
      <PieChart accessibilityLayer={false} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Pie
          data={rows}
          dataKey="amountMinor"
          nameKey="id"
          innerRadius="62%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
          rootTabIndex={-1}
          shape={slice}
        />
      </PieChart>
    </ChartContainer>
  );
});

/**
 * A donut with the total in its middle, and under it one row per slice: the colour, the name, the amount and its
 * share. The rows are the legend and the text of the chart, and each is a link to the entries behind its slice
 * (the bucket's is plain text), at least 44 px high.
 */
export function Donut({
  rows,
  summary,
  valueLabel,
  centreLabel,
}: {
  rows: ChartRow[];
  summary: string;
  valueLabel: string;
  centreLabel: string;
}) {
  const router = useRouter();
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);

  return (
    <div className="flex flex-col gap-3">
      <ChartFrame summary={summary} valueLabel={valueLabel}>
        {(onHover) => (
          <div className="relative mx-auto aspect-square w-full max-w-56">
            <Ring rows={rows} router={router} onHover={onHover} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-2xl font-semibold">{amountText(total)}</p>
              <p className="text-xs text-muted-foreground">{centreLabel}</p>
            </div>
          </div>
        )}
      </ChartFrame>
      <ul className="flex flex-col divide-y">
        {rows.map((row) => {
          const content = (
            <>
              <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
              <span className="min-w-0 flex-1 truncate">{row.shortLabel}</span>
              <span className="font-medium tabular-nums">{amountText(row.amountMinor)}</span>
              <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">
                {percentText(row.amountMinor, total)}
              </span>
            </>
          );
          return (
            <li key={row.id}>
              {row.href === null ? (
                <div className="flex min-h-11 items-center gap-3">{content}</div>
              ) : (
                <Link href={row.href} className="flex min-h-11 items-center gap-3 hover:bg-muted/60">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
