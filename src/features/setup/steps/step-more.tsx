import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A step's longer tips, folded under one question (Roshan, from the mockups, 13-11-2026), so the step shows its fields
 * first. The summary is at least 44 px high; its chevron points along the reading direction and down once open.
 */
export function StepMore({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:-rotate-90"
        />
        {summary}
      </summary>
      <div className="flex flex-col gap-2 pb-1 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}
